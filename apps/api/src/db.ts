import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();

let docClient: DynamoDBDocumentClient | null = null;

// 로컬 DynamoDB 엔드포인트 결정
const getLocalEndpoint = () => {
  // DynamoDB Local 사용 시
  if (process.env.IS_OFFLINE === "true") {
    return "http://localhost:8000";
  }
  return undefined;
};

export const getDynamoDb = (): DynamoDBDocumentClient => {
  if (docClient) return docClient;

  const endpoint = getLocalEndpoint();

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "ap-northeast-2",
    ...(endpoint && {
      endpoint,
      credentials: {
        accessKeyId: "local",
        secretAccessKey: "local",
      },
    }),
  });

  docClient = DynamoDBDocumentClient.from(client);
  return docClient;
};

export const TABLE_NAME =
  process.env.DYNAMODB_TABLE_USERS ||
  `my-time-users-${process.env.SLS_STAGE || "dev"}`;
export const LOGS_TABLE_NAME =
  process.env.DYNAMODB_TABLE ||
  `my-time-logs-${process.env.SLS_STAGE || "dev"}`;
export const LOG_BACKUPS_TABLE_NAME =
  process.env.DYNAMODB_TABLE_BACKUPS ||
  `my-time-log-backups-${process.env.SLS_STAGE || "dev"}`;
