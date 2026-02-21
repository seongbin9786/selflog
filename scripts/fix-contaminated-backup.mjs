#!/usr/bin/env node

/**
 * Backup JSON 오염 복구 스크립트.
 *
 * 배경:
 * - 일부 백업에서 logs[date] 값이 plain log 텍스트가 아니라
 *   {"content":"...","contentHash":"...","parentHash":...,"localUpdatedAt":"..."}
 *   형태의 storage wrapper 문자열로 저장될 수 있음.
 * - 이 wrapper가 중첩되면 {"content":"{\"content\":\"...\"}"} 형태로 커짐.
 *
 * 동작:
 * - 지정한 backup JSON 파일을 읽어 logs[*]의 문자열을 검사
 * - wrapper로 판단되는 값은 content를 반복적으로 벗겨 plain text로 정규화
 * - 정규화 결과를 같은 파일에 덮어씀(in-place)
 * - 날짜 키(YYYY-MM-DD)인 경우 logs를 오름차순 정렬
 *
 * 주의:
 * - 앱 localStorage를 직접 수정하지 않음 (백업 파일만 수정)
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const STORAGE_WRAPPER_KEYS = new Set([
  'content',
  'contentHash',
  'parentHash',
  'localUpdatedAt',
]);
const MAX_UNWRAP_DEPTH = 10;

const printUsage = () => {
  console.log(
    [
      'Usage:',
      '  node scripts/fix-contaminated-backup.mjs <backup-json-file>',
      '',
      'Example:',
      '  node scripts/fix-contaminated-backup.mjs ./my-commit-backup.json',
    ].join('\n'),
  );
};

const isObjectRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const unwrapStorageWrapperOnce = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return raw;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!isObjectRecord(parsed)) {
      return raw;
    }

    if (typeof parsed.content !== 'string') {
      return raw;
    }

    const keys = Object.keys(parsed);
    if (keys.length === 0 || !keys.every((key) => STORAGE_WRAPPER_KEYS.has(key))) {
      return raw;
    }

    return parsed.content;
  } catch {
    return raw;
  }
};

const normalizeContent = (raw) => {
  let current = raw;
  for (let i = 0; i < MAX_UNWRAP_DEPTH; i++) {
    const unwrapped = unwrapStorageWrapperOnce(current);
    if (unwrapped === current) {
      return current;
    }
    current = unwrapped;
  }
  return current;
};

const maybeSortLogs = (logs) => {
  const entries = Object.entries(logs);
  const isDateKey = (key) => /^\d{4}-\d{2}-\d{2}$/.test(key);

  if (!entries.every(([key]) => isDateKey(key))) {
    return logs;
  }

  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
};

const main = async () => {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const inputPath = args[0];
  if (!inputPath) {
    printUsage();
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), inputPath);
  const rawFile = await fs.readFile(resolvedPath, 'utf8');
  const parsed = JSON.parse(rawFile);

  if (!isObjectRecord(parsed)) {
    throw new Error('Backup JSON must be an object.');
  }

  if (!isObjectRecord(parsed.logs)) {
    throw new Error('Invalid backup format: "logs" object is required.');
  }

  const nextLogs = {};
  let changedCount = 0;
  let totalCount = 0;

  for (const [date, value] of Object.entries(parsed.logs)) {
    totalCount += 1;

    if (typeof value !== 'string') {
      nextLogs[date] = value;
      continue;
    }

    const normalized = normalizeContent(value);
    nextLogs[date] = normalized;

    if (normalized !== value) {
      changedCount += 1;
    }
  }

  parsed.logs = maybeSortLogs(nextLogs);

  await fs.writeFile(resolvedPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

  console.log(
    `[fix-contaminated-backup] done: ${path.basename(resolvedPath)} (changed ${changedCount}/${totalCount} logs)`,
  );
};

main().catch((error) => {
  console.error('[fix-contaminated-backup] failed:', error.message);
  process.exit(1);
});
