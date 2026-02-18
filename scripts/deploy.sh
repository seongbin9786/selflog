#!/usr/bin/env bash
set -euo pipefail
# NOTE: Bash strict mode
# -e: Exit immediately if any command fails
# -u: Treat unset variables as an error
# -o pipefail: Return exit code of the first failed command in a pipeline

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ "${1:-}" == "--" ]]; then
  shift
fi

STAGE="${1:-prod}"

if [[ $# -gt 1 ]]; then
  echo "Usage: deploy.sh [prod|dev]"
  exit 1
fi

if [[ "${STAGE}" != "prod" && "${STAGE}" != "dev" ]]; then
  echo "Invalid stage: ${STAGE}"
  echo "Allowed: prod | dev"
  exit 1
fi

load_env_file() {
  local file="$1"
  if [[ -f "${file}" ]]; then
    echo "Load env: ${file}"
    set -a
    # shellcheck disable=SC1090
    source "${file}"
    set +a
  fi
}

if [[ "${STAGE}" == "prod" ]]; then
  ENV_NAME="production"
else
  ENV_NAME="development"
fi

# Later files override earlier values.
load_env_file "${ROOT_DIR}/.env"
load_env_file "${ROOT_DIR}/.env.local"
load_env_file "${ROOT_DIR}/.env.${ENV_NAME}"
load_env_file "${ROOT_DIR}/.env.${ENV_NAME}.local"

REGION="${AWS_REGION:-ap-northeast-2}"
API_STACK_NAME="${API_STACK_NAME:-${STAGE}-my-time-api}"

if [[ -z "${JWT_SECRET:-}" ]]; then
  echo "JWT_SECRET is required"
  exit 1
fi

if [[ -z "${WEB_DOMAIN_NAME:-}" || -z "${ACM_CERTIFICATE_ARN:-}" ]]; then
  echo "Custom domain is required."
  echo "Set both WEB_DOMAIN_NAME and ACM_CERTIFICATE_ARN in env."
  exit 1
fi

WEB_ORIGIN="https://${WEB_DOMAIN_NAME}"

echo "Deploy API with WEB_ORIGIN=${WEB_ORIGIN}"
MY_TIME_ROOT_DEPLOY=1 WEB_ORIGIN="${WEB_ORIGIN}" JWT_SECRET="${JWT_SECRET}" \
pnpm --filter my-time-api run sls:deploy --stage "${STAGE}" --region "${REGION}"

API_URL="$(
  aws cloudformation describe-stacks \
    --stack-name "${API_STACK_NAME}" \
    --region "${REGION}" \
    --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' \
    --output text
)"

if [[ -z "${API_URL}" || "${API_URL}" == "None" ]]; then
  echo "Failed to resolve HttpApiUrl from ${API_STACK_NAME}"
  exit 1
fi

echo "Deploy Web with VITE_API_URL=${API_URL}"
MY_TIME_ROOT_DEPLOY=1 VITE_API_URL="${API_URL}" \
WEB_DOMAIN_NAME="${WEB_DOMAIN_NAME:-}" \
ACM_CERTIFICATE_ARN="${ACM_CERTIFICATE_ARN:-}" \
pnpm --filter my-time-client run deploy --stage "${STAGE}" --region "${REGION}"
