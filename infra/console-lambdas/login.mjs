// Lambda: cloudpay-login
// Trigger: API Gateway POST /login
// Permissão: AmazonDynamoDBFullAccess

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { createHash } from "crypto";

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

  const { email, password } = body;
  if (!email || !password)
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Email e senha obrigatórios" }) };

  // Admin hardcoded
  if (email === "admin@cloudpay.com" && password === "admin123") {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ userId: "admin", name: "Administrador", email, role: "admin" }) };
  }

  // Busca usuário no DynamoDB
  const result = await dynamo.send(new ScanCommand({
    TableName: "cloudpay-users",
    FilterExpression: "email = :e AND password = :p",
    ExpressionAttributeValues: { ":e": email, ":p": hash(password) },
  }));

  if (!result.Items?.length)
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Email ou senha incorretos" }) };

  const user = result.Items[0];
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ userId: user.userId, name: user.name, email: user.email, role: "user" }) };
};
