import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { getDynamoDb, TABLE_NAME } from "./db";

export interface User {
  username: string;
  passwordHash: string;
}

export const findUser = async (username: string): Promise<User | undefined> => {
  const result = await getDynamoDb().send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { username },
    })
  );
  return result.Item as User;
};

export const createUser = async (
  username: string,
  passwordHash: string
): Promise<User> => {
  const user: User = {
    username,
    passwordHash,
  };

  await getDynamoDb().send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: user,
      ConditionExpression: "attribute_not_exists(username)",
    })
  );

  return user;
};
