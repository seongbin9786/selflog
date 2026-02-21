#!/usr/bin/env bash
# 역할: deploy.sh에서 사용하는 인자 파싱/환경 로드/검증/API URL 조회 공통 함수 모음.

DEPLOY_STAGE="prod"
DEPLOY_DNS_PROVIDER_ARG=""
DEPLOY_SHOW_HELP="false"

# deploy.sh 사용법/예시를 출력한다.
deploy_usage() {
  cat <<'EOF'
Usage: deploy.sh [prod|dev] [--dns-provider <none|porkbun>]
DNS sync runs only when UPDATE_DNS_RECORD=true.

Examples:
  deploy.sh
  deploy.sh prod
  deploy.sh dev --dns-provider porkbun
  deploy.sh --dns-provider porkbun prod
EOF
}

# CLI 인자를 파싱해 stage, dns-provider, help 플래그를 결정한다.
deploy_parse_args() {
  DEPLOY_STAGE="prod"
  DEPLOY_DNS_PROVIDER_ARG=""
  DEPLOY_SHOW_HELP="false"

  if [[ "${1:-}" == "--" ]]; then
    shift
  fi

  local stage_arg_count=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --)
        shift
        ;;
      prod | dev)
        DEPLOY_STAGE="$1"
        stage_arg_count=$((stage_arg_count + 1))
        if [[ ${stage_arg_count} -gt 1 ]]; then
          echo "Stage can only be specified once."
          deploy_usage
          exit 1
        fi
        shift
        ;;
      --dns-provider)
        if [[ -z "${2:-}" ]]; then
          echo "Missing value for --dns-provider"
          deploy_usage
          exit 1
        fi
        DEPLOY_DNS_PROVIDER_ARG="$2"
        shift 2
        ;;
      --dns-provider=*)
        DEPLOY_DNS_PROVIDER_ARG="${1#*=}"
        shift
        ;;
      -h | --help)
        DEPLOY_SHOW_HELP="true"
        shift
        ;;
      *)
        echo "Unknown argument: $1"
        deploy_usage
        exit 1
        ;;
    esac
  done
}

# stage 값이 허용된 범위(prod/dev)인지 검증한다.
deploy_validate_stage() {
  local stage="$1"
  if [[ "${stage}" != "prod" && "${stage}" != "dev" ]]; then
    echo "Invalid stage: ${stage}"
    echo "Allowed: prod | dev"
    exit 1
  fi
}

# 주어진 env 파일이 있으면 로드한다.
deploy_load_env_file() {
  local file="$1"
  if [[ -f "${file}" ]]; then
    echo "Load env: ${file}"
    set -a
    # shellcheck disable=SC1090
    source "${file}"
    set +a
  fi
}

# stage(prod/dev)에 맞는 루트 .env 계열 파일을 순서대로 로드한다.
deploy_load_stage_env() {
  local root_dir="$1"
  local stage="$2"
  local env_name

  if [[ "${stage}" == "prod" ]]; then
    env_name="production"
  else
    env_name="development"
  fi

  # Later files override earlier values.
  deploy_load_env_file "${root_dir}/.env"
  deploy_load_env_file "${root_dir}/.env.local"
  deploy_load_env_file "${root_dir}/.env.${env_name}"
  deploy_load_env_file "${root_dir}/.env.${env_name}.local"
}

# 필수 환경변수가 비어 있지 않은지 확인한다.
deploy_require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "${name} is required"
    exit 1
  fi
}

# ARN에서 region을 추출한다. 파싱 실패 시 빈 문자열을 반환한다.
deploy_extract_arn_region() {
  local arn="$1"
  local service=""
  local region=""
  # arn:partition:service:region:account-id:resource
  IFS=':' read -r _ _ service region _ _ <<< "${arn}"
  if [[ -z "${service}" || -z "${region}" ]]; then
    printf '%s' ""
    return 0
  fi
  printf '%s' "${region}"
}

# CloudFront custom domain에 필요한 ACM ARN 조건(us-east-1)을 검증한다.
deploy_validate_cloudfront_acm_arn() {
  local acm_arn="$1"
  local acm_region=""
  acm_region="$(deploy_extract_arn_region "${acm_arn}")"
  if [[ -z "${acm_region}" ]]; then
    echo "Invalid ACM_CERTIFICATE_ARN format: ${acm_arn}"
    exit 1
  fi
  if [[ "${acm_region}" != "us-east-1" ]]; then
    echo "Invalid ACM_CERTIFICATE_ARN region for CloudFront: ${acm_region}"
    echo "CloudFront custom domain requires ACM certificate in us-east-1."
    echo "Update ACM_CERTIFICATE_ARN to a us-east-1 certificate ARN."
    exit 1
  fi
}

# API 스택 Output에서 HttpApiUrl을 조회해 반환한다.
deploy_resolve_api_url() {
  local api_stack_name="$1"
  local region="$2"
  local api_url

  api_url="$(
    aws cloudformation describe-stacks \
      --stack-name "${api_stack_name}" \
      --region "${region}" \
      --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' \
      --output text
  )"

  if [[ -z "${api_url}" || "${api_url}" == "None" ]]; then
    echo "Failed to resolve HttpApiUrl from ${api_stack_name}"
    exit 1
  fi
  printf '%s' "${api_url}"
}
