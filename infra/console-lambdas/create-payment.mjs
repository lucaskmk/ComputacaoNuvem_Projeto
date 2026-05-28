// Lambda: cloudpay-create-payment
// Trigger: API Gateway POST /payments
// Env vars: SQS_QUEUE_URL
// Permissão extra na role: AmazonSQSFullAccess + AmazonDynamoDBFullAccess

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const sqs = new SQSClient({});
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

  const { userId, userName, amount } = body;
  if (!userId || !userName || !amount || amount <= 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "userId, userName e amount são obrigatórios" }) };
  }

  const processId = `tr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();

  const item = { processId, userId, userName, amount: Number(amount), status: "pending", createdAt: now, updatedAt: now };

  // Grava no DynamoDB
  await dynamo.send(new PutCommand({ TableName: "cloudpay-payments", Item: item }));

  // Publica no SQS
  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    MessageBody: JSON.stringify(item),
  }));

  return {
    statusCode: 202,
    headers: CORS,
    body: JSON.stringify({ processId, status: "queued" }),
  };
};
