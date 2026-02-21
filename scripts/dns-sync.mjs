#!/usr/bin/env node
// 역할: DNS provider를 선택해 공통 입력을 검증한 뒤 provider 구현을 호출한다.

import { syncPorkbunDns } from "./dns-providers/porkbun.mjs";

// [1] Provider 선택
const provider = (process.env.DNS_PROVIDER || "none").trim().toLowerCase();

if (provider === "none") {
  console.log("DNS sync skipped (DNS_PROVIDER=none).");
  process.exit(0);
}

const dnsRecordName = normalizeDomain(
  requireEnv("DNS_RECORD_NAME"),
  "DNS_RECORD_NAME"
);
const dnsRecordContent = normalizeDomain(
  requireEnv("DNS_RECORD_CONTENT"),
  "DNS_RECORD_CONTENT"
);

// [2] Provider 구현 호출
try {
  if (provider === "porkbun") {
    await syncPorkbunDns({
      recordName: dnsRecordName,
      recordContent: dnsRecordContent,
      env: process.env,
    });
  } else {
    throw new Error(`Unsupported DNS_PROVIDER: ${provider}`);
  }
} catch (error) {
  console.error(`[dns-sync] ${error.message}`);
  process.exit(1);
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

// 필수 환경변수를 읽고 누락 시 오류를 던진다.
function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} is required.`);
  }
  return value;
}
