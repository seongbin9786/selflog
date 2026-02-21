#!/usr/bin/env bash
# 역할: 이미 배포된 Web 스택 Output(CloudFrontURL)을 읽어 DNS(Porkbun)만 동기화한다.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${ROOT_DIR}/scripts/lib/deploy-common.sh"

STAGE="prod"
DNS_PROVIDER_ARG=""
SHOW_HELP="false"

# sync-dns.sh 사용법/예시를 출력한다.
usage() {
  cat <<'EOF'
Usage: sync-dns.sh [prod|dev] --dns-provider <porkbun>

Examples:
  sync-dns.sh prod --dns-provider porkbun
  sync-dns.sh dev --dns-provider porkbun
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
      --dns-provider)
        DNS_PROVIDER_ARG="${2:-}"
        if [[ -z "${DNS_PROVIDER_ARG}" ]]; then
          echo "Missing value for --dns-provider"
          usage
          exit 1
        fi
        shift 2
        ;;
      --dns-provider=*)
        DNS_PROVIDER_ARG="${1#*=}"
        shift
        ;;
      -h | --help)
        SHOW_HELP="true"
        shift
        ;;
      *)
        echo "Unknown argument: $1"
        usage
        exit 1
        ;;
    esac
  done
}

# 메인 실행 흐름:
# [1] stage env 로드 -> [2] CloudFront URL 기반 DNS 동기화 실행
main() {
  parse_args "$@"
  if [[ "${SHOW_HELP}" == "true" ]]; then
    usage
    exit 0
  fi

  deploy_validate_stage "${STAGE}"
  deploy_load_stage_env "${ROOT_DIR}" "${STAGE}"

  deploy_require_env "WEB_DOMAIN_NAME"

  local region="${AWS_REGION:-ap-northeast-2}"
  local web_stack_name="${WEB_STACK_NAME:-${STAGE}-my-commit-web}"
  local dns_provider="${DNS_PROVIDER_ARG:-}"

  if [[ -z "${dns_provider}" ]]; then
    echo "DNS provider is required."
    echo "Pass --dns-provider <provider>."
    exit 1
  fi

  echo "Sync DNS only: stage=${STAGE} provider=${dns_provider}"
  UPDATE_DNS_RECORD=true \
  DNS_PROVIDER="${dns_provider}" \
  WEB_DOMAIN_NAME="${WEB_DOMAIN_NAME}" \
  WEB_STACK_NAME="${web_stack_name}" \
  AWS_REGION="${region}" \
  bash "${ROOT_DIR}/scripts/sync-dns-after-deploy.sh"
}

main "$@"
