// Lambda: cloudpay-create-user
// Trigger: API Gateway POST /users
// Permissão: AmazonDynamoDBFullAccess

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID, createHash } from "crypto";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const hash = (s) => createHash("sha256").update(s).digest("hex");

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { name, email, password } = body;
  if (!name || !email)
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "name e email são obrigatórios" }) };

  // Verifica se email já existe
  const existing = await dynamo.send(new ScanCommand({
    TableName: "cloudpay-users",
    FilterExpression: "email = :e",
    ExpressionAttributeValues: { ":e": email },
  }));
  if (existing.Items?.length)
    return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: "Email já cadastrado" }) };

  const userId = randomUUID();
  const item = {
    userId, name, email,
    ...(password && { password: hash(password) }),
    createdAt: new Date().toISOString(),
  };

  await dynamo.send(new PutCommand({ TableName: "cloudpay-users", Item: item }));

  return { statusCode: 201, headers: CORS, body: JSON.stringify({ userId }) };
};
