import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { getDynamoDb, LOG_BACKUPS_TABLE_NAME, LOGS_TABLE_NAME } from "./db";

export interface LogItem {
  userId: string;
  date: string;
  content: string;
  contentHash: string;
  parentHash: string | null;
  updatedAt?: string;
  version?: number;
}

export interface BackupItem {
  userId: string;
  backupId: string; // date#timestamp
  date: string;
  content: string;
  originalUpdatedAt?: string;
  originalVersion?: number;
  backedUpAt: string;
}

export const getAllLogs = async (userId: string): Promise<LogItem[]> => {
  const result = await getDynamoDb().send(
    new QueryCommand({
      TableName: LOGS_TABLE_NAME,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    }),
  );
  return (result.Items as LogItem[]) || [];
};

export const saveLog = async (
  userId: string,
  date: string,
  content: string,
  contentHash: string,
  parentHash: string | null,
) => {
  const db = getDynamoDb();

  // 1. Get current log to see if we need to backup
  const currentLog = await getLog(userId, date);

  const now = new Date().toISOString();
  let nextVersion = 1;

  if (currentLog) {
    // Check conflicts if necessary, but for now we prioritize saving.
    // If clientUpdatedAt is provided and is older than currentLog.updatedAt,
    // it means client is overwriting a newer server version.
    // However, since we are backing up, this is "safe" from a data loss perspective.

    // Create Backup
    const backupId = `${date}#${now}`; // or use UUID, but timestamp is sorts well

    await db.send(
      new PutCommand({
        TableName: LOG_BACKUPS_TABLE_NAME,
        Item: {
          userId,
          backupId,
          date,
          content: currentLog.content,
          originalUpdatedAt: currentLog.updatedAt,
          originalVersion: currentLog.version,
          backedUpAt: now,
        },
      }),
    );

    nextVersion = (currentLog.version || 0) + 1;
  }

  // 2. Save new log
  const newLog: LogItem = {
    userId,
    date,
    content,
    contentHash,
    parentHash,
    updatedAt: now,
    version: nextVersion,
  };

  await db.send(
    new PutCommand({
      TableName: LOGS_TABLE_NAME,
      Item: newLog,
    }),
  );

  return newLog;
};

export const getLog = async (
  userId: string,
  date: string,
): Promise<LogItem | undefined> => {
  const result = await getDynamoDb().send(
    new GetCommand({
      TableName: LOGS_TABLE_NAME,
      Key: {
        userId,
        date,
      },
    }),
  );
  return result.Item as LogItem;
};

export const getLogBackups = async (userId: string, date: string) => {
  // Query backups where userId = :userId AND backupId begins_with :date
  const result = await getDynamoDb().send(
    new QueryCommand({
      TableName: LOG_BACKUPS_TABLE_NAME,
      KeyConditionExpression:
        "userId = :userId AND begins_with(backupId, :date)",
      ExpressionAttributeValues: {
        ":userId": userId,
        ":date": date,
      },
      // ScanIndexForward: false, // Show newest backups first?
    }),
  );

  return result.Items as BackupItem[];
};

export interface BulkLogInput {
  date: string;
  content: string;
  contentHash: string;
  parentHash: string | null;
}

/**
 * 여러 로그를 한 번에 저장합니다.
 * 각 날짜별로 기존 데이터가 있으면 백업 후 새 데이터를 저장합니다.
 */
export const bulkSaveLogs = async (
  userId: string,
  logs: BulkLogInput[],
): Promise<LogItem[]> => {
  const savedLogs: LogItem[] = [];

  for (const log of logs) {
    const saved = await saveLog(
      userId,
      log.date,
      log.content,
      log.contentHash,
      log.parentHash,
    );
    savedLogs.push(saved);
  }

  return savedLogs;
};
