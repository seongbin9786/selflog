// 역할: Porkbun DNS API를 사용해 대상 도메인 레코드를 조회/정리/생성한다.
export async function syncPorkbunDns({
  recordName,
  recordContent,
  env = process.env,
  fetchImpl = fetch,
}) {
  const apiKey = requireEnv(env, "PORKBUN_API_KEY");
  const secretApiKey = requireEnv(env, "PORKBUN_SECRET_API_KEY");
  const inferredRoot = inferRootDomain(recordName);
  const rootDomain = normalizeDomain(
    env.PORKBUN_ROOT_DOMAIN || inferredRoot,
    "PORKBUN_ROOT_DOMAIN"
  );
  const hostLabel = getHostLabel(recordName, rootDomain);

  const defaultRecordType = hostLabel === "" ? "ALIAS" : "CNAME";
  const recordType = (env.PORKBUN_RECORD_TYPE || defaultRecordType)
    .trim()
    .toUpperCase();
  const ttl = parseTtl(env.PORKBUN_TTL);
  const dryRun = parseBoolean(env.PORKBUN_DRY_RUN);

  if (hostLabel === "" && recordType === "CNAME") {
    throw new Error("Apex domain cannot use CNAME. Use ALIAS/A/AAAA.");
  }

  if (!env.PORKBUN_ROOT_DOMAIN) {
    console.log(`[dns-sync] PORKBUN_ROOT_DOMAIN inferred as ${rootDomain}`);
  }

  const porkbunRequest = createPorkbunRequest({
    apiKey,
    secretApiKey,
    fetchImpl,
  });

  const existingResponse = await porkbunRequest(`/dns/retrieve/${rootDomain}`);
  const existingRecords = Array.isArray(existingResponse.records)
    ? existingResponse.records
    : [];

  const conflictingTypes = new Set(["A", "AAAA", "CNAME", "ALIAS"]);
  const conflicts = existingRecords.filter((record) => {
    const type = String(record.type || "").toUpperCase();
    if (!conflictingTypes.has(type)) {
      return false;
    }
    const fqdn = recordNameToFqdn(record.name, rootDomain);
    return fqdn === recordName;
  });

  const expectedContent = normalizeRecordContent(recordContent);
  let keptMatchingRecord = null;
  const recordsToDelete = [];

  for (const record of conflicts) {
    if (isSameTargetRecord(record, recordType, expectedContent)) {
      // Keep one matching record and delete duplicates/other conflicting records only.
      if (keptMatchingRecord === null) {
        keptMatchingRecord = record;
        continue;
      }
    }
    recordsToDelete.push(record);
  }

  if (recordsToDelete.length > 0) {
    console.log(
      `[dns-sync] Removing ${recordsToDelete.length} existing DNS record(s).`
    );
  }

  for (const record of recordsToDelete) {
    const id = record.id;
    if (!id) {
      throw new Error("Porkbun API returned a record without id.");
    }
    console.log(
      `[dns-sync] delete id=${id} type=${String(record.type || "").toUpperCase()} name=${String(record.name || "")}`
    );
    if (!dryRun) {
      await porkbunRequest(`/dns/delete/${rootDomain}/${id}`);
    }
  }

  if (keptMatchingRecord) {
    const keptId = keptMatchingRecord.id ? `id=${keptMatchingRecord.id} ` : "";
    console.log(
      `[dns-sync] Existing record already matches target (${keptId}type=${recordType}).`
    );
  } else {
    console.log(
      `[dns-sync] create type=${recordType} name=${hostLabel || "(apex)"} content=${recordContent} ttl=${ttl}`
    );
    if (!dryRun) {
      await porkbunRequest(`/dns/create/${rootDomain}`, {
        name: hostLabel,
        type: recordType,
        content: recordContent,
        ttl,
      });
    }
  }

  if (dryRun) {
    console.log("[dns-sync] dry-run enabled: no changes were applied.");
  } else {
    if (keptMatchingRecord && recordsToDelete.length === 0) {
      console.log("[dns-sync] Porkbun DNS sync skipped: DNS record already up to date.");
    } else {
      console.log("[dns-sync] Porkbun DNS sync completed.");
    }
  }
}

// Porkbun API 요청 함수를 생성한다.
function createPorkbunRequest({ apiKey, secretApiKey, fetchImpl }) {
  return async (path, payload = {}) => {
    const url = `https://api.porkbun.com/api/json/v3${path}`;
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        apikey: apiKey,
        secretapikey: secretApiKey,
        ...payload,
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        `Porkbun API request failed (${response.status}): ${path}`
      );
    }
    if (body.status !== "SUCCESS") {
      const message = body.message || "Unknown error";
      throw new Error(`Porkbun API error for ${path}: ${message}`);
    }
    return body;
  };
}

// 도메인 문자열을 소문자/FQDN 형식으로 정규화한다.
function normalizeDomain(value, envName) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "");
  if (!normalized.includes(".")) {
    throw new Error(`${envName} must be a valid domain.`);
  }
  return normalized;
}

// FQDN에서 루트 도메인을 단순 추론한다.
function inferRootDomain(fqdn) {
  const parts = fqdn.split(".").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("DNS_RECORD_NAME must include a root domain.");
  }
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
}

// FQDN과 루트 도메인을 비교해 host 라벨(@ 제외)을 반환한다.
function getHostLabel(fqdn, rootDomain) {
  if (fqdn === rootDomain) {
    return "";
  }
  const suffix = `.${rootDomain}`;
  if (!fqdn.endsWith(suffix)) {
    throw new Error(
      `DNS_RECORD_NAME (${fqdn}) does not match PORKBUN_ROOT_DOMAIN (${rootDomain}).`
    );
  }
  return fqdn.slice(0, -suffix.length);
}

// Porkbun record name을 절대 FQDN 형태로 변환한다.
function recordNameToFqdn(name, rootDomain) {
  const raw = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "");
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

// TTL 입력값을 검증하고 기본값(600)을 적용한다.
function parseTtl(value) {
  if (value === undefined || value === null || value === "") {
    return 600;
  }
  const ttl = Number(value);
  if (!Number.isInteger(ttl) || ttl <= 0) {
    throw new Error("PORKBUN_TTL must be a positive integer.");
  }
  return ttl;
}

// 문자열 기반 불리언 표현을 true/false로 파싱한다.
function parseBoolean(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

// DNS 레코드 content 비교를 위해 소문자/끝점(.) 기준으로 정규화한다.
function normalizeRecordContent(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "");
}

// 대상 타입/값과 정확히 일치하는 기존 레코드인지 판단한다.
function isSameTargetRecord(record, expectedType, expectedContent) {
  const type = String(record.type || "").toUpperCase();
  if (type !== expectedType) {
    return false;
  }
  const currentContent = normalizeRecordContent(record.content);
  return currentContent === expectedContent;
}

// provider 환경변수에서 필수 키를 읽고 누락 시 오류를 던진다.
function requireEnv(env, name) {
  const value = env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} is required.`);
  }
  return value;
}
