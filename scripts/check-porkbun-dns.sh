#!/usr/bin/env bash
# 역할: Porkbun DNS 레코드를 조회하고 이름/타입 조건으로 필터링해 출력한다.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${ROOT_DIR}/scripts/lib/deploy-common.sh"

STAGE="prod"
DOMAIN_ARG=""
RECORD_NAME_FILTER=""
RECORD_TYPE_FILTER=""
OUTPUT_FORMAT="table"

# check-porkbun-dns.sh 사용법을 출력한다.
usage() {
  cat <<'EOF'
Usage: check-porkbun-dns.sh [prod|dev] [options]

Options:
  --domain <root-domain>   Root domain override (default: PORKBUN_ROOT_DOMAIN or inferred)
  --name <record-name>     Filter by record name (e.g. my-commit.com, dev.my-commit.com, @)
  --type <record-type>     Filter by record type (A|AAAA|CNAME|ALIAS|TXT|...)
  --json                   Output as JSON
  --table                  Output as table (default)
  -h, --help               Show this help

Examples:
  check-porkbun-dns.sh prod
  check-porkbun-dns.sh prod --name my-commit.com
  check-porkbun-dns.sh dev --name dev.my-commit.com --type CNAME --json
EOF
}

# 문자열을 소문자로 정규화한다.
to_lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

# 도메인 문자열을 끝점 없이 소문자로 정규화한다.
normalize_domain() {
  local value="$1"
  value="$(to_lower "${value}")"
  printf '%s' "${value}" | sed 's/[.]*$//'
}

# FQDN으로부터 루트 도메인을 단순 추론한다.
infer_root_domain_from_fqdn() {
  local fqdn="$1"
  IFS='.' read -r -a parts <<< "${fqdn}"
  local count="${#parts[@]}"
  if [[ "${count}" -lt 2 ]]; then
    return 1
  fi
  printf '%s.%s' "${parts[count-2]}" "${parts[count-1]}"
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
        DOMAIN_ARG="${2:-}"
        if [[ -z "${DOMAIN_ARG}" ]]; then
          echo "Missing value for --domain"
          usage
          exit 1
        fi
        shift 2
        ;;
      --name)
        RECORD_NAME_FILTER="${2:-}"
        if [[ -z "${RECORD_NAME_FILTER}" ]]; then
          echo "Missing value for --name"
          usage
          exit 1
        fi
        shift 2
        ;;
      --type)
        RECORD_TYPE_FILTER="${2:-}"
        if [[ -z "${RECORD_TYPE_FILTER}" ]]; then
          echo "Missing value for --type"
          usage
          exit 1
        fi
        shift 2
        ;;
      --json)
        OUTPUT_FORMAT="json"
        shift
        ;;
      --table)
        OUTPUT_FORMAT="table"
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

# Porkbun API로 루트 도메인 레코드 목록을 조회한다.
retrieve_records() {
  local root_domain="$1"
  curl -sS -X POST "https://api.porkbun.com/api/json/v3/dns/retrieve/${root_domain}" \
    -H "content-type: application/json" \
    -d "{\"apikey\":\"${PORKBUN_API_KEY}\",\"secretapikey\":\"${PORKBUN_SECRET_API_KEY}\"}"
}

# Node.js로 필터링/출력을 처리한다.
render_records() {
  ROOT_DOMAIN="${1}" \
  RECORD_NAME_FILTER="${RECORD_NAME_FILTER}" \
  RECORD_TYPE_FILTER="${RECORD_TYPE_FILTER}" \
  OUTPUT_FORMAT="${OUTPUT_FORMAT}" \
  PORKBUN_RESPONSE="${2}" \
  node - <<'NODE'
const body = JSON.parse(process.env.PORKBUN_RESPONSE || "{}");
if (body.status !== "SUCCESS") {
  const message = body.message || "Unknown error";
  throw new Error(`Porkbun API error: ${message}`);
}

const rootDomain = normalizeDomain(process.env.ROOT_DOMAIN || "");
const outputFormat = (process.env.OUTPUT_FORMAT || "table").toLowerCase();
const typeFilter = (process.env.RECORD_TYPE_FILTER || "").trim().toUpperCase();
const nameFilterRaw = (process.env.RECORD_NAME_FILTER || "").trim();

const records = Array.isArray(body.records) ? body.records : [];
const normalizedNameFilter = nameFilterRaw
  ? normalizeFilterName(nameFilterRaw, rootDomain)
  : "";

const filtered = records.filter((record) => {
  if (normalizedNameFilter) {
    const fqdn = recordNameToFqdn(record.name, rootDomain);
    if (fqdn !== normalizedNameFilter) {
      return false;
    }
  }
  if (typeFilter) {
    const type = String(record.type || "").toUpperCase();
    if (type !== typeFilter) {
      return false;
    }
  }
  return true;
});

if (outputFormat === "json") {
  console.log(JSON.stringify(filtered, null, 2));
  process.exit(0);
}

if (filtered.length === 0) {
  console.log("No DNS records matched.");
  process.exit(0);
}

console.table(
  filtered.map((record) => ({
    id: record.id,
    type: record.type,
    name: recordNameToFqdn(record.name, rootDomain),
    content: record.content,
    ttl: record.ttl,
    prio: record.prio,
    notes: record.notes || "",
  }))
);

function normalizeDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "");
}

function normalizeFilterName(raw, rootDomain) {
  const value = normalizeDomain(raw);
  if (value === "@" || value === "") {
    return rootDomain;
  }
  if (value === rootDomain) {
    return rootDomain;
  }
  if (value.endsWith(`.${rootDomain}`)) {
    return value;
  }
  if (value.includes(".")) {
    return value;
  }
  return `${value}.${rootDomain}`;
}

function recordNameToFqdn(name, rootDomain) {
  const raw = normalizeDomain(name);
  if (raw === "" || raw === "@") {
    return rootDomain;
  }
  if (raw === rootDomain) {
    return rootDomain;
  }
  if (raw.endsWith(`.${rootDomain}`)) {
    return raw;
  }
  return `${raw}.${rootDomain}`;
}
NODE
}

# 메인 실행 흐름:
# [1] 인자/환경 확인 -> [2] API 조회 -> [3] 필터링 출력
main() {
  parse_args "$@"
  deploy_validate_stage "${STAGE}"
  deploy_load_stage_env "${ROOT_DIR}" "${STAGE}"
  deploy_require_env "PORKBUN_API_KEY"
  deploy_require_env "PORKBUN_SECRET_API_KEY"

  local root_domain
  if [[ -n "${DOMAIN_ARG}" ]]; then
    root_domain="$(normalize_domain "${DOMAIN_ARG}")"
  elif [[ -n "${PORKBUN_ROOT_DOMAIN:-}" ]]; then
    root_domain="$(normalize_domain "${PORKBUN_ROOT_DOMAIN}")"
  elif [[ -n "${WEB_DOMAIN_NAME:-}" ]]; then
    root_domain="$(infer_root_domain_from_fqdn "$(normalize_domain "${WEB_DOMAIN_NAME}")" || true)"
    if [[ -z "${root_domain}" ]]; then
      echo "Failed to infer root domain from WEB_DOMAIN_NAME=${WEB_DOMAIN_NAME}"
      echo "Set PORKBUN_ROOT_DOMAIN or pass --domain"
      exit 1
    fi
  else
    echo "Root domain is required. Set PORKBUN_ROOT_DOMAIN or pass --domain"
    exit 1
  fi

  echo "[1/3] Resolve root domain: ${root_domain}"
  echo "[2/3] Retrieve DNS records from Porkbun"
  local response
  response="$(retrieve_records "${root_domain}")"

  echo "[3/3] Render records (${OUTPUT_FORMAT})"
  render_records "${root_domain}" "${response}"
}

main "$@"
