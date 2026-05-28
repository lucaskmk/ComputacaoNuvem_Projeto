// Lambda: cloudpay-list-payments
// Trigger: API Gateway GET /payments
// Query params: ?userId=xxx (opcional — filtra por usuário)
// Permissão: AmazonDynamoDBFullAccess

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  const userId = event.queryStringParameters?.userId;

  const params = userId
    ? { TableName: "cloudpay-payments", FilterExpression: "userId = :uid", ExpressionAttributeValues: { ":uid": userId } }
    : { TableName: "cloudpay-payments" };

  const result = await dynamo.send(new ScanCommand(params));

  const items = (result.Items || []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return { statusCode: 200, headers: CORS, body: JSON.stringify(items) };
};
