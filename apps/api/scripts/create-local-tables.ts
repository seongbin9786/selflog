/**
 * 로컬 DynamoDB 테이블 생성 스크립트
 * Usage: npx tsx scripts/create-local-tables.ts
 */

import {
  CreateTableCommand,
  DynamoDBClient,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";

const STAGE = process.env.SLS_STAGE || "dev";
const MAX_RETRIES = 10;
const RETRY_DELAY = 2000; // 2초

const client = new DynamoDBClient({
  region: "ap-northeast-2",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "local",
    secretAccessKey: "local",
  },
  requestHandler: {
    connectionTimeout: 3000,
    requestTimeout: 5000,
  },
});

const tables = [
  {
    TableName: `my-time-users-${STAGE}`,
    KeySchema: [{ AttributeName: "username", KeyType: "HASH" as const }],
    AttributeDefinitions: [
      { AttributeName: "username", AttributeType: "S" as const },
    ],
    BillingMode: "PAY_PER_REQUEST" as const,
  },
  {
    TableName: `my-time-logs-${STAGE}`,
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" as const },
      { AttributeName: "date", KeyType: "RANGE" as const },
    ],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" as const },
      { AttributeName: "date", AttributeType: "S" as const },
    ],
    BillingMode: "PAY_PER_REQUEST" as const,
  },
  {
    TableName: `my-time-log-backups-${STAGE}`,
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" as const },
      { AttributeName: "backupId", KeyType: "RANGE" as const },
    ],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" as const },
      { AttributeName: "backupId", AttributeType: "S" as const },
    ],
    BillingMode: "PAY_PER_REQUEST" as const,
  },
];

async function waitForDynamoDB() {
  console.log("⏳ DynamoDB Local 연결 대기 중...");

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await client.send(new ListTablesCommand({}));
      console.log("✅ DynamoDB Local 연결 성공!");
      return;
    } catch (error) {
      if (i === MAX_RETRIES - 1) {
        throw new Error(
          `DynamoDB Local에 연결할 수 없습니다. Docker 컨테이너가 실행 중인지 확인하세요.\n` +
          `명령어: docker ps | grep dynamodb`
        );
      }
      console.log(`⏳ 재시도 중... (${i + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

async function createTables() {
  await waitForDynamoDB();

  console.log("🔍 기존 테이블 확인 중...");

  const { TableNames = [] } = await client.send(new ListTablesCommand({}));

  for (const table of tables) {
    if (TableNames.includes(table.TableName)) {
      console.log(`⏭️  테이블 "${table.TableName}" 이미 존재`);
      continue;
    }

    console.log(`📦 테이블 "${table.TableName}" 생성 중...`);
    try {
      await client.send(new CreateTableCommand(table));
      console.log(`✅ 테이블 "${table.TableName}" 생성 완료`);
    } catch (error) {
      console.error(`❌ 테이블 "${table.TableName}" 생성 실패:`, error);
    }
  }

  console.log("\n🎉 로컬 DynamoDB 테이블 설정 완료!");
  console.log("📊 DynamoDB Admin UI: http://localhost:8001");
}

createTables().catch(console.error);
