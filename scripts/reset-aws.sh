#!/usr/bin/env bash
# 역할: stage 기준 API/Web 스택과 관련 버킷을 제거하고(기본) ACM까지 삭제해 AWS 리소스를 초기화한다.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${ROOT_DIR}/scripts/lib/deploy-common.sh"

STAGE="prod"
REMOVE_ACM="true"
ACM_ARN_ARG=""

# reset-aws.sh 사용법을 출력한다.
usage() {
  cat <<'EOF'
Usage: reset-aws.sh [prod|dev] [options]

Options:
  --remove-acm                 Delete ACM certificate (default behavior)
  --keep-acm                   Keep ACM certificate (skip deletion)
  --acm-arn <arn>              ACM ARN override (default: ACM_CERTIFICATE_ARN from env)
  -h, --help                   Show this help

Examples:
  reset-aws.sh prod
  reset-aws.sh dev --keep-acm
  reset-aws.sh prod --remove-acm --acm-arn arn:aws:acm:us-east-1:...
EOF
}

# CLI 인자를 파싱한다.
parse_args() {
  local stage_arg_count=0

  if [[ "${1:-}" == "--" ]]; then
    shift
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --)
        shift
        ;;
      prod | dev)
        STAGE="$1"
        stage_arg_count=$((stage_arg_count + 1))
        if [[ ${stage_arg_count} -gt 1 ]]; then
          echo "Stage can only be specified once."
          usage
          exit 1
        fi
        shift
        ;;
      --remove-acm)
        REMOVE_ACM="true"
        shift
        ;;
      --keep-acm)
        REMOVE_ACM="false"
        shift
        ;;
      --acm-arn)
        ACM_ARN_ARG="${2:-}"
        if [[ -z "${ACM_ARN_ARG}" ]]; then
          echo "Missing value for --acm-arn"
          usage
          exit 1
        fi
        shift 2
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1"
        usage
        exit 1
        ;;
    esac
  done
}

# CloudFormation 스택이 현재 존재하는지 확인한다.
stack_exists() {
  local stack_name="$1"
  local region="$2"
  local output
  if output="$(
    aws cloudformation describe-stacks \
      --stack-name "${stack_name}" \
      --region "${region}" 2>&1
  )"; then
    return 0
  fi

  if printf '%s' "${output}" | grep -qi "Stack with id ${stack_name} does not exist"; then
    # describe-stacks가 false-negative를 내는 환경(권한/정책/일시 이슈)을 대비해 list-stacks로 한 번 더 확인.
    if stack_exists_via_list "${stack_name}" "${region}"; then
      echo "Warning: describe-stacks reported not found, but list-stacks found ${stack_name}." >&2
      return 0
    fi
    return 1
  fi

  echo "Failed to query stack (${stack_name}) in region ${region}." >&2
  echo "AWS CLI error: ${output}" >&2
  return 2
}

# list-stacks 기반으로 스택 존재 여부를 보조 확인한다.
stack_exists_via_list() {
  local stack_name="$1"
  local region="$2"
  local count
  count="$(
    aws cloudformation list-stacks \
      --region "${region}" \
      --query "length(StackSummaries[?StackName=='${stack_name}' && StackStatus!='DELETE_COMPLETE'])" \
      --output text 2>/dev/null || echo "0"
  )"
  [[ "${count}" != "0" && "${count}" != "None" ]]
}

# 현재 실행되는 AWS 컨텍스트(profile/account)를 출력한다.
print_aws_context() {
  local profile="${AWS_PROFILE:-default}"
  local caller
  caller="$(aws sts get-caller-identity --output text --query 'join(`|`, [Account, Arn])' 2>/dev/null || true)"
  echo "AWS context: profile=${profile} region=${AWS_REGION:-ap-northeast-2}"
  if [[ -n "${AWS_ACCESS_KEY_ID:-}" ]]; then
    echo "AWS credential source: env(AWS_ACCESS_KEY_ID) overrides profile selection"
  else
    echo "AWS credential source: profile/default chain"
  fi
  if [[ -n "${caller}" ]]; then
    echo "AWS caller: ${caller}"
  fi
}

# AWS 인증/권한 상태를 먼저 확인한다.
assert_aws_access() {
  if aws sts get-caller-identity >/dev/null 2>&1; then
    return 0
  fi
  echo "AWS credentials are not available or not authorized." >&2
  echo "Check aws login/profile/env before running undeploy." >&2
  return 1
}

# ACM ARN에서 region을 추출한다. 실패 시 빈 문자열을 반환한다.
extract_region_from_acm_arn() {
  local acm_arn="$1"
  local region=""
  # arn:partition:service:region:account-id:resource
  IFS=':' read -r _ _ service region _ _ <<< "${acm_arn}"
  if [[ "${service}" != "acm" || -z "${region}" ]]; then
    printf '%s' ""
    return 0
  fi
  printf '%s' "${region}"
}

# ACM ARN에서 account id를 추출한다. 실패 시 빈 문자열을 반환한다.
extract_account_from_acm_arn() {
  local acm_arn="$1"
  local account=""
  # arn:partition:service:region:account-id:resource
  IFS=':' read -r _ _ service _ account _ <<< "${acm_arn}"
  if [[ "${service}" != "acm" || -z "${account}" ]]; then
    printf '%s' ""
    return 0
  fi
  printf '%s' "${account}"
}

# 호출자 계정과 ACM ARN 계정이 다르면 즉시 중단해 오삭제를 방지한다.
validate_acm_account_alignment() {
  local acm_arn="$1"
  local caller_account="$2"
  local arn_account=""
  if [[ -z "${acm_arn}" || -z "${caller_account}" ]]; then
    return 0
  fi
  arn_account="$(extract_account_from_acm_arn "${acm_arn}")"
  if [[ -z "${arn_account}" ]]; then
    return 0
  fi
  if [[ "${arn_account}" != "${caller_account}" ]]; then
    echo "ACM ARN account mismatch." >&2
    echo "caller account: ${caller_account}" >&2
    echo "acm arn account: ${arn_account}" >&2
    return 1
  fi
}

# 스택 Output에서 특정 키 값을 조회한다.
get_stack_output() {
  local stack_name="$1"
  local output_key="$2"
  local region="$3"
  local value

  value="$(
    aws cloudformation describe-stacks \
      --stack-name "${stack_name}" \
      --region "${region}" \
      --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue | [0]" \
      --output text 2>/dev/null || true
  )"

  if [[ "${value}" == "None" ]]; then
    value=""
  fi
  printf '%s' "${value}"
}

# 버킷이 비어있지 않아 스택 삭제가 막히지 않도록 객체를 먼저 비운다.
empty_bucket_if_present() {
  local bucket_name="$1"
  local region="$2"
  if [[ -z "${bucket_name}" ]]; then
    return 0
  fi
  echo "Empty S3 bucket: s3://${bucket_name}"
  aws s3 rm "s3://${bucket_name}" --recursive --region "${region}" >/dev/null 2>&1 || true
}

# 스택을 삭제하고, 버킷 이슈가 나면 한 번 더 정리 후 재시도한다.
delete_stack_with_cleanup() {
  local stack_name="$1"
  local region="$2"

  if stack_exists "${stack_name}" "${region}"; then
    :
  else
    local exists_status=$?
    if [[ ${exists_status} -eq 1 ]]; then
      echo "Skip: stack not found (${stack_name}) [region=${region}, profile=${AWS_PROFILE:-default}]"
      return 0
    fi
    return 1
  fi

  local deploy_bucket
  local website_bucket
  deploy_bucket="$(get_stack_output "${stack_name}" "ServerlessDeploymentBucketName" "${region}")"
  website_bucket="$(get_stack_output "${stack_name}" "WebsiteBucketName" "${region}")"

  empty_bucket_if_present "${deploy_bucket}" "${region}"
  empty_bucket_if_present "${website_bucket}" "${region}"

  echo "Delete stack: ${stack_name}"
  aws cloudformation delete-stack --stack-name "${stack_name}" --region "${region}" || true
  if aws cloudformation wait stack-delete-complete --stack-name "${stack_name}" --region "${region}"; then
    echo "Deleted: ${stack_name}"
    return 0
  fi

  echo "Retry stack deletion after bucket cleanup: ${stack_name}"
  empty_bucket_if_present "${deploy_bucket}" "${region}"
  empty_bucket_if_present "${website_bucket}" "${region}"
  aws cloudformation delete-stack --stack-name "${stack_name}" --region "${region}" || true
  if aws cloudformation wait stack-delete-complete --stack-name "${stack_name}" --region "${region}"; then
    echo "Deleted: ${stack_name}"
    return 0
  fi

  if stack_exists "${stack_name}" "${region}"; then
    :
  else
    local exists_status=$?
    if [[ ${exists_status} -eq 1 ]]; then
      echo "Deleted: ${stack_name}"
      return 0
    fi
    return 1
  fi

  echo "Failed to delete stack: ${stack_name}"
  aws cloudformation describe-stack-events \
    --stack-name "${stack_name}" \
    --region "${region}" \
    --max-items 20 \
    --query 'StackEvents[].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' \
    --output table || true
  return 1
}

# 설정에 따라 ACM 인증서를 제거하거나 유지한다.
delete_acm_if_requested() {
  local acm_arn="$1"
  local acm_region
  local describe_output
  if [[ "${REMOVE_ACM}" != "true" ]]; then
    echo "Skip ACM deletion (--keep-acm set)"
    return 0
  fi
  if [[ -z "${acm_arn}" ]]; then
    echo "ACM ARN is required for ACM deletion."
    echo "Use --acm-arn or set ACM_CERTIFICATE_ARN in env."
    return 1
  fi
  acm_region="$(extract_region_from_acm_arn "${acm_arn}")"
  if [[ -z "${acm_region}" ]]; then
    acm_region="us-east-1"
    echo "Warning: failed to parse ACM region from ARN. Fallback region=${acm_region}"
  fi

  if describe_output="$(
    aws acm describe-certificate \
      --region "${acm_region}" \
      --certificate-arn "${acm_arn}" 2>&1
  )"; then
    :
  else
    if printf '%s' "${describe_output}" | grep -qi 'ResourceNotFoundException'; then
      echo "Skip ACM deletion: certificate not found (region=${acm_region})"
      return 0
    fi
    echo "Failed to query ACM certificate before deletion." >&2
    echo "AWS CLI error: ${describe_output}" >&2
    return 1
  fi

  echo "Delete ACM certificate (${acm_region}): ${acm_arn}"
  aws acm delete-certificate --region "${acm_region}" --certificate-arn "${acm_arn}"
  echo "Deleted ACM certificate: ${acm_arn}"
}

# 메인 실행 흐름:
# [1] API 스택 제거 -> [2] Web 스택 제거 -> [3] ACM 제거(기본)
main() {
  parse_args "$@"
  deploy_validate_stage "${STAGE}"
  deploy_load_stage_env "${ROOT_DIR}" "${STAGE}"

  assert_aws_access

  local region="${AWS_REGION:-ap-northeast-2}"
  local api_stack_name="${API_STACK_NAME:-${STAGE}-my-commit-api}"
  local web_stack_name="${WEB_STACK_NAME:-${STAGE}-my-commit-web}"
  local acm_arn="${ACM_ARN_ARG:-${ACM_CERTIFICATE_ARN:-}}"
  local caller_account
  caller_account="$(aws sts get-caller-identity --query 'Account' --output text 2>/dev/null || true)"

  print_aws_context
  validate_acm_account_alignment "${acm_arn}" "${caller_account}"

  echo "[1/3] Remove API stack"
  delete_stack_with_cleanup "${api_stack_name}" "${region}"

  echo "[2/3] Remove Web stack"
  delete_stack_with_cleanup "${web_stack_name}" "${region}"

  echo "[3/3] Remove ACM (default)"
  delete_acm_if_requested "${acm_arn}"

  echo "Reset complete for stage=${STAGE}"
}

main "$@"
