import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand, PutCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "eu-north-1" });
const db = DynamoDBDocumentClient.from(client);
const TABLE = "sple-questions";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,x-api-key",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,PATCH,OPTIONS"
};

async function getApiKey() {
  const result = await db.send(new GetCommand({ TableName: TABLE, Key: { id: "config" } }));
  return result.Item?.anthropic_key || null;
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = event.requestContext?.http?.path || event.path || "/";

  if (method === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {

    // POST /generate — Generate questions using Claude
    if (method === "POST" && path.includes("/generate")) {
      const apiKey = await getApiKey();
      if (!apiKey) return { statusCode: 400, headers, body: JSON.stringify({ error: "API key not configured. Add it in DynamoDB config item." }) };

      const body = JSON.parse(event.body || "{}");
      const { section, subcategory, difficulty, count } = body;

      const diffText = difficulty === "سهل" ? "Easy (recall-based factual)"
        : difficulty === "متوسط" ? "Medium (mechanism/pathophysiology-based)"
        : "Hard (clinical scenarios, complex interactions, calculations)";

      const prompt = `You are an expert pharmacist exam question writer for the Saudi Pharmacist Licensure Examination (SPLE) by SCHS.

Generate exactly ${count} high-quality multiple-choice questions:
- Section: ${section}
- Subcategory: ${subcategory}
- Difficulty: ${diffText}

Rules:
- Relevant to Saudi pharmacy practice and SCHS standards
- Exactly 4 options, ONE correct answer
- answer is 0-indexed (0=A, 1=B, 2=C, 3=D)
- Detailed clinical explanation

Respond ONLY with JSON array, no markdown:
[{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 3000,
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const text = data.content[0].text;
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("Failed to parse Claude response");

      const questions = JSON.parse(match[0]);
      return { statusCode: 200, headers, body: JSON.stringify({ questions }) };
    }

    // GET /questions — Get all questions
    if (method === "GET" && path.includes("/questions")) {
      const result = await db.send(new ScanCommand({ TableName: TABLE }));
      const questions = result.Items.filter(item => item.id !== "config");
      return { statusCode: 200, headers, body: JSON.stringify(questions) };
    }

    // POST /questions — Add a question
    if (method === "POST" && path.includes("/questions")) {
      const body = JSON.parse(event.body || "{}");
      const item = { id: "q_" + Date.now(), ...body };
      await db.send(new PutCommand({ TableName: TABLE, Item: item }));
      return { statusCode: 201, headers, body: JSON.stringify(item) };
    }

    // PATCH /questions/{id} — Update question fields (e.g. assign)
    if (method === "PATCH" && path.includes("/questions/")) {
      const id = path.split("/questions/")[1];
      const body = JSON.parse(event.body || "{}");
      
      const updateExpressions = [];
      const expressionValues = {};
      const expressionNames = {};

      for (const [key, value] of Object.entries(body)) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionNames[`#${key}`] = key;
        expressionValues[`:${key}`] = value;
      }

      if (updateExpressions.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "No fields to update" }) };
      }

      await db.send(new UpdateCommand({
        TableName: TABLE,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
      }));

      return { statusCode: 200, headers, body: JSON.stringify({ updated: id, ...body }) };
    }

    // DELETE /questions/{id}
    if (method === "DELETE" && path.includes("/questions/")) {
      const id = path.split("/questions/")[1];
      await db.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
      return { statusCode: 200, headers, body: JSON.stringify({ deleted: id }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
