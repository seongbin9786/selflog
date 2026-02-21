/**
 * 로컬 DynamoDB 테이블 삭제 스크립트
 * Usage: npx tsx scripts/delete-local-tables.ts
 */

import { DeleteTableCommand, DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

const STAGE = process.env.SLS_STAGE || 'local';

const client = new DynamoDBClient({
  region: 'ap-northeast-2',
  endpoint: 'http://localhost:8000',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

const tableNames = [`${STAGE}-my-commit-users`, `${STAGE}-my-commit-logs`];

async function deleteTables() {
  console.log('🔍 기존 테이블 확인 중...');

  const { TableNames = [] } = await client.send(new ListTablesCommand({}));

  for (const tableName of tableNames) {
    if (!TableNames.includes(tableName)) {
      console.log(`⏭️  테이블 "${tableName}" 없음 - 건너뜀`);
      continue;
    }

    console.log(`🗑️  테이블 "${tableName}" 삭제 중...`);
    try {
      await client.send(new DeleteTableCommand({ TableName: tableName }));
      console.log(`✅ 테이블 "${tableName}" 삭제 완료`);
    } catch (error) {
      console.error(`❌ 테이블 "${tableName}" 삭제 실패:`, error);
    }
  }

  console.log('\n🎉 로컬 DynamoDB 테이블 삭제 완료!');
}

deleteTables().catch(console.error);
