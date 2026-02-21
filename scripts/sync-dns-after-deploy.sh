#!/usr/bin/env bash
# 역할: 배포 완료 후 UPDATE_DNS_RECORD/DNS_PROVIDER 조건에 따라 DNS 동기화를 수행.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 문자열을 소문자로 정규화한다.
to_lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

# 다양한 true/false 표현을 표준 불리언 문자열로 변환한다.
parse_bool() {
  local value
  value="$(to_lower "${1:-}")"
  case "${value}" in
    1 | true | yes | on)
      echo "true"
      ;;
    0 | false | no | off | "")
      echo "false"
      ;;
    *)
      echo "invalid"
      ;;
  esac
}

# [1] UPDATE_DNS_RECORD 플래그 검증/판정
UPDATE_DNS_RECORD_ENABLED="$(parse_bool "${UPDATE_DNS_RECORD:-false}")"
if [[ "${UPDATE_DNS_RECORD_ENABLED}" == "invalid" ]]; then
  echo "Invalid UPDATE_DNS_RECORD value: ${UPDATE_DNS_RECORD:-}"
  echo "Allowed: true/false"
  exit 1
fi

if [[ "${UPDATE_DNS_RECORD_ENABLED}" != "true" ]]; then
  echo "Skip DNS sync (UPDATE_DNS_RECORD=false)"
  exit 0
fi

# [2] DNS provider 검증
DNS_PROVIDER_NORMALIZED="$(to_lower "${DNS_PROVIDER:-none}")"
if [[ "${DNS_PROVIDER_NORMALIZED}" != "porkbun" ]]; then
  if [[ "${DNS_PROVIDER_NORMALIZED}" == "none" ]]; then
    echo "UPDATE_DNS_RECORD=true but DNS_PROVIDER=none"
    echo "Set DNS_PROVIDER to a supported provider (e.g. porkbun)."
  else
    echo "Invalid dns provider: ${DNS_PROVIDER:-}"
    echo "Allowed: porkbun"
  fi
  exit 1
fi

REGION="${AWS_REGION:-ap-northeast-2}"
WEB_STACK_NAME="${WEB_STACK_NAME:-}"
WEB_DOMAIN_NAME="${WEB_DOMAIN_NAME:-}"

# [3] 실행 입력값 검증
if [[ -z "${WEB_STACK_NAME}" ]]; then
  echo "WEB_STACK_NAME is required for DNS sync"
  exit 1
fi

if [[ -z "${WEB_DOMAIN_NAME}" ]]; then
  echo "WEB_DOMAIN_NAME is required for DNS sync"
  exit 1
fi

# [4] Web 스택에서 CloudFront URL 조회
WEB_CLOUDFRONT_URL="$(
  aws cloudformation describe-stacks \
    --stack-name "${WEB_STACK_NAME}" \
    --region "${REGION}" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
    --output text
)"

if [[ -z "${WEB_CLOUDFRONT_URL}" || "${WEB_CLOUDFRONT_URL}" == "None" ]]; then
  echo "Failed to resolve CloudFrontURL from ${WEB_STACK_NAME}"
  exit 1
fi

# [5] DNS provider 실행기 호출
echo "Sync DNS via ${DNS_PROVIDER_NORMALIZED}: ${WEB_DOMAIN_NAME} -> ${WEB_CLOUDFRONT_URL}"
DNS_PROVIDER="${DNS_PROVIDER_NORMALIZED}" \
DNS_RECORD_NAME="${WEB_DOMAIN_NAME}" \
DNS_RECORD_CONTENT="${WEB_CLOUDFRONT_URL}" \
node "${ROOT_DIR}/scripts/dns-sync.mjs"
