#!/usr/bin/env bash
# 역할: 전체 배포 오케스트레이션(API -> Web -> DNS 후처리) 실행 엔트리포인트.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${ROOT_DIR}/scripts/lib/deploy-common.sh"

# 배포 오케스트레이션 엔트리포인트:
# [1] API 배포 -> [2] Web 배포 -> [3] DNS 후처리
main() {
  deploy_parse_args "$@"
  if [[ "${DEPLOY_SHOW_HELP}" == "true" ]]; then
    deploy_usage
    exit 0
  fi

  deploy_validate_stage "${DEPLOY_STAGE}"
  deploy_load_stage_env "${ROOT_DIR}" "${DEPLOY_STAGE}"

  deploy_require_env "JWT_SECRET"
  deploy_require_env "WEB_DOMAIN_NAME"
  deploy_require_env "ACM_CERTIFICATE_ARN"
  deploy_validate_cloudfront_acm_arn "${ACM_CERTIFICATE_ARN}"

  local stage="${DEPLOY_STAGE}"
  local region="${AWS_REGION:-ap-northeast-2}"
  local api_stack_name="${API_STACK_NAME:-${stage}-my-commit-api}"
  local web_stack_name="${WEB_STACK_NAME:-${stage}-my-commit-web}"
  local resolved_dns_provider="${DEPLOY_DNS_PROVIDER_ARG:-${DNS_PROVIDER:-none}}"
  local web_origin="https://${WEB_DOMAIN_NAME}"
  local -a sls_profile_args=()

  if [[ -n "${AWS_PROFILE:-}" ]]; then
    sls_profile_args=(--aws-profile "${AWS_PROFILE}")
  fi

  # [1] API Serverless 배포
  echo "[1/3] Deploy API: pnpm --filter my-commit-api run sls:deploy"
  MY_COMMIT_ROOT_DEPLOY=1 WEB_ORIGIN="${web_origin}" JWT_SECRET="${JWT_SECRET}" \
  pnpm --filter my-commit-api run sls:deploy --stage "${stage}" --region "${region}" "${sls_profile_args[@]}"

  local api_url
  api_url="$(deploy_resolve_api_url "${api_stack_name}" "${region}")"

  # [2] S3, CloudFront 배포 (배포된 API 주소 주입)
  echo "[2/3] Deploy Web: pnpm --filter my-commit-client run deploy"
  MY_COMMIT_ROOT_DEPLOY=1 VITE_API_URL="${api_url}" \
  WEB_DOMAIN_NAME="${WEB_DOMAIN_NAME}" \
  ACM_CERTIFICATE_ARN="${ACM_CERTIFICATE_ARN}" \
  pnpm --filter my-commit-client run deploy --stage "${stage}" --region "${region}" "${sls_profile_args[@]}"

  # [3] DNS Provider API 활용해서 CloudFront 주소에 DNS 설정(등록/갱신)
  echo "[3/3] Post deploy DNS sync"
  UPDATE_DNS_RECORD="${UPDATE_DNS_RECORD:-false}" \
  DNS_PROVIDER="${resolved_dns_provider}" \
  WEB_DOMAIN_NAME="${WEB_DOMAIN_NAME}" \
  WEB_STACK_NAME="${web_stack_name}" \
  AWS_REGION="${region}" \
  bash "${ROOT_DIR}/scripts/sync-dns-after-deploy.sh"
}

main "$@"
