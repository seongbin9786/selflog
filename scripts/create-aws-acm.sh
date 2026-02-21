#!/usr/bin/env bash
# 역할: ACM 인증서를 생성하고, 선택적으로 DNS provider(Porkbun)로 검증 레코드를 자동 동기화한다.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${ROOT_DIR}/scripts/lib/deploy-common.sh"

STAGE="prod"
DOMAIN=""
DNS_PROVIDER="${DNS_PROVIDER:-none}"
ACM_REGION="${ACM_REGION:-us-east-1}"
WAIT_FOR_VALIDATION="false"
SAN_CSV="${ACM_SUBJECT_ALTERNATIVE_NAMES:-}"

# create-aws-acm.sh 사용법을 출력한다.
usage() {
  cat <<'EOF'
Usage: create-aws-acm.sh [prod|dev] [options]

Options:
  --domain <domain>              Target domain (default: WEB_DOMAIN_NAME from env)
  --dns-provider <none|porkbun>  DNS provider for validation record sync (default: none)
  --region <aws-region>          ACM region (default: us-east-1)
  --sans <csv>                   Subject Alternative Names, comma-separated
  --wait                         Wait until certificate status becomes ISSUED
  -h, --help                     Show this help

Examples:
  create-aws-acm.sh prod --domain my-commit.com
  create-aws-acm.sh prod --domain my-commit.com --dns-provider porkbun --wait
EOF
}

# 문자열을 소문자로 정규화한다.
to_lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
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
      --domain)
        DOMAIN="${2:-}"
        if [[ -z "${DOMAIN}" ]]; then
          echo "Missing value for --domain"
          usage
          exit 1
        fi
        shift 2
        ;;
      --dns-provider)
        DNS_PROVIDER="${2:-}"
        if [[ -z "${DNS_PROVIDER}" ]]; then
          echo "Missing value for --dns-provider"
          usage
          exit 1
        fi
        shift 2
        ;;
      --region)
        ACM_REGION="${2:-}"
        if [[ -z "${ACM_REGION}" ]]; then
          echo "Missing value for --region"
          usage
          exit 1
        fi
        shift 2
        ;;
      --sans)
        SAN_CSV="${2:-}"
        if [[ -z "${SAN_CSV}" ]]; then
          echo "Missing value for --sans"
          usage
          exit 1
        fi
        shift 2
        ;;
      --wait)
        WAIT_FOR_VALIDATION="true"
        shift
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

# ACM API가 검증 레코드를 노출할 때까지 대기 후 텍스트 목록을 반환한다.
fetch_validation_records() {
  local cert_arn="$1"
  local records=""
  local attempt
  for attempt in $(seq 1 30); do
    records="$(
      aws acm describe-certificate \
        --region "${ACM_REGION}" \
        --certificate-arn "${cert_arn}" \
        --query 'Certificate.DomainValidationOptions[?ResourceRecord!=null].[ResourceRecord.Name,ResourceRecord.Type,ResourceRecord.Value]' \
        --output text
    )"
    if [[ -n "${records}" ]]; then
      printf '%s' "${records}"
      return 0
    fi
    sleep 2
  done
  echo "Failed to fetch validation ResourceRecord from ACM." >&2
  return 1
}

# 검증 레코드를 DNS provider에 반영하거나, 수동 적용용으로 출력한다.
apply_validation_records() {
  local records="$1"
  local record_name=""
  local record_type=""
  local record_value=""

  while IFS=$'\t' read -r record_name record_type record_value; do
    [[ -z "${record_name}" ]] && continue
    if [[ "${DNS_PROVIDER}" == "none" ]]; then
      echo "Manual DNS record: type=${record_type} name=${record_name} value=${record_value}"
      continue
    fi

    echo "Sync validation record via ${DNS_PROVIDER}: ${record_name} -> ${record_value}"
    DNS_PROVIDER="${DNS_PROVIDER}" \
    DNS_RECORD_NAME="${record_name}" \
    DNS_RECORD_CONTENT="${record_value}" \
    PORKBUN_RECORD_TYPE="${record_type}" \
    node "${ROOT_DIR}/scripts/dns-sync.mjs"
  done <<< "${records}"
}

# ACM 인증서를 생성하고 ARN을 반환한다.
request_certificate() {
  local domain="$1"
  local token
  token="$(to_lower "${domain}" | tr -cd 'a-z0-9' | cut -c1-32)"
  if [[ -z "${token}" ]]; then
    token="mycommitacm$(date +%s)"
  fi

  local -a args
  args=(
    acm request-certificate
    --region "${ACM_REGION}"
    --domain-name "${domain}"
    --validation-method DNS
    --idempotency-token "${token}"
    --query CertificateArn
    --output text
  )

  if [[ -n "${SAN_CSV}" ]]; then
    IFS=',' read -r -a san_items <<< "${SAN_CSV}"
    local san
    local -a sans
    sans=()
    for san in "${san_items[@]}"; do
      san="${san#"${san%%[![:space:]]*}"}"
      san="${san%"${san##*[![:space:]]}"}"
      [[ -z "${san}" ]] && continue
      sans+=("${san}")
    done
    if [[ ${#sans[@]} -gt 0 ]]; then
      args+=(--subject-alternative-names "${sans[@]}")
    fi
  fi

  aws "${args[@]}"
}

# 현재 인증서 상태를 출력한다.
print_certificate_status() {
  local cert_arn="$1"
  local status
  status="$(
    aws acm describe-certificate \
      --region "${ACM_REGION}" \
      --certificate-arn "${cert_arn}" \
      --query 'Certificate.Status' \
      --output text
  )"
  echo "Certificate status: ${status}"
}

# 생성된 ACM ARN을 어떤 env 파일에 반영해야 하는지 박스 형태로 안내한다.
print_env_update_box() {
  local cert_arn="$1"
  local env_file=""
  if [[ "${STAGE}" == "prod" ]]; then
    env_file=".env.production"
  else
    env_file=".env.development"
  fi

  cat <<EOF

+------------------------------------------------------------------+
| IMPORTANT: Update env before running deploy                      |
+------------------------------------------------------------------+
| Target file : ${env_file}
| Copy line   : ACM_CERTIFICATE_ARN=${cert_arn}
| Next command: pnpm run deploy:${STAGE}
+------------------------------------------------------------------+

EOF
}

# 메인 실행 흐름:
# [1] 인증서 생성 -> [2] 검증 레코드 반영 -> [3] 선택적 발급 대기
main() {
  parse_args "$@"
  deploy_validate_stage "${STAGE}"
  deploy_load_stage_env "${ROOT_DIR}" "${STAGE}"

  if [[ -z "${DOMAIN}" ]]; then
    DOMAIN="${WEB_DOMAIN_NAME:-}"
  fi
  if [[ -z "${DOMAIN}" ]]; then
    echo "Domain is required. Set --domain or WEB_DOMAIN_NAME."
    exit 1
  fi

  DNS_PROVIDER="$(to_lower "${DNS_PROVIDER}")"
  if [[ "${DNS_PROVIDER}" != "none" && "${DNS_PROVIDER}" != "porkbun" ]]; then
    echo "Invalid dns provider: ${DNS_PROVIDER}"
    echo "Allowed: none | porkbun"
    exit 1
  fi

  if [[ "${ACM_REGION}" != "us-east-1" ]]; then
    echo "Warning: CloudFront custom domain certificates should be in us-east-1."
  fi

  echo "[1/3] Request ACM certificate for ${DOMAIN} (${ACM_REGION})"
  local cert_arn
  cert_arn="$(request_certificate "${DOMAIN}")"
  if [[ -z "${cert_arn}" || "${cert_arn}" == "None" ]]; then
    echo "Failed to request ACM certificate."
    exit 1
  fi
  echo "Certificate ARN: ${cert_arn}"

  echo "[2/3] Resolve and apply ACM DNS validation records"
  local records
  records="$(fetch_validation_records "${cert_arn}")"
  apply_validation_records "${records}"

  echo "[3/3] Finalize"
  if [[ "${WAIT_FOR_VALIDATION}" == "true" ]]; then
    echo "Waiting for certificate validation..."
    aws acm wait certificate-validated \
      --region "${ACM_REGION}" \
      --certificate-arn "${cert_arn}"
    echo "Certificate validated."
  else
    echo "Skip wait. Use --wait to block until ISSUED."
  fi

  print_certificate_status "${cert_arn}"
  print_env_update_box "${cert_arn}"
}

main "$@"
