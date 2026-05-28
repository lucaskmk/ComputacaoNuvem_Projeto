// Lambda: cloudpay-worker
// Trigger: SQS cloudpay-payments (Batch size: 1)
// Permissão extra na role: AmazonDynamoDBFullAccess + AmazonSQSFullAccess

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function processPayment(message) {
  const { processId, userName, amount } = message;
  console.log(`[worker] processing ${processId} — ${userName} R$${amount}`);

  // Marca como processing
  await dynamo.send(new UpdateCommand({
    TableName: "cloudpay-payments",
    Key: { processId },
    UpdateExpression: "SET #s = :s, updatedAt = :t",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":s": "processing", ":t": new Date().toISOString() },
  }));

  // Simula chamada ao banco/gateway (1.5s)
  await new Promise((r) => setTimeout(r, 1500));

  const shouldFail = Math.random() < 0.2;
  const updateParams = {
    TableName: "cloudpay-payments",
    Key: { processId },
    UpdateExpression: shouldFail
      ? "SET #s = :s, updatedAt = :t, #e = :e"
      : "SET #s = :s, updatedAt = :t",
    ExpressionAttributeNames: shouldFail
      ? { "#s": "status", "#e": "error" }
      : { "#s": "status" },
    ExpressionAttributeValues: shouldFail
      ? { ":s": "failed", ":t": new Date().toISOString(), ":e": "Gateway timeout — retry eligible" }
      : { ":s": "completed", ":t": new Date().toISOString() },
  };

  await dynamo.send(new UpdateCommand(updateParams));
  console.log(`[worker] ${processId} → ${shouldFail ? "FAILED" : "completed"}`);
}

export const handler = async (event) => {
  console.log(`[worker] received ${event.Records.length} message(s)`);

  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    await processPayment(message);
  }
};
