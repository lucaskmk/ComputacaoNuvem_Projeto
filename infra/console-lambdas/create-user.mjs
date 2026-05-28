// Lambda: cloudpay-create-user
// Trigger: API Gateway POST /users
// Permissão extra na role: AmazonDynamoDBFullAccess

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { name, email } = body;
  if (!name || !email) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "name e email são obrigatórios" }) };
  }

  const userId = randomUUID();
  const item = { userId, name, email, createdAt: new Date().toISOString() };

  await dynamo.send(new PutCommand({ TableName: "cloudpay-users", Item: item }));

  return {
    statusCode: 201,
    headers: CORS,
    body: JSON.stringify({ userId }),
  };
};
