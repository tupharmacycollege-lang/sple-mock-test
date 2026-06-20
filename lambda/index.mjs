import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand, PutCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "eu-north-1" });
const db = DynamoDBDocumentClient.from(client);

const TABLES = {
  questions: "sple-questions",
  course:    "SPLE-Course-Bank",
  exam:      "SPLE-Exam-Bank",
  results:   "sple-results",
  users:     "sple-users",
};

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,x-api-key",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,PATCH,OPTIONS"
};

const ok  = (body) => ({ statusCode: 200, headers, body: JSON.stringify(body) });
const err = (msg, code=500) => ({ statusCode: code, headers, body: JSON.stringify({ error: msg }) });

async function scanTable(table) {
  const items = [];
  let last;
  do {
    const res = await db.send(new ScanCommand({ TableName: table, ExclusiveStartKey: last }));
    items.push(...res.Items);
    last = res.LastEvaluatedKey;
  } while (last);
  return items.filter(i => i.id !== "config");
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path   = event.requestContext?.http?.path   || event.path || "/";

  if (method === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {

    // ── COURSE BANK ──────────────────────────────────────────
    // GET /course-bank
    if (method === "GET" && path.endsWith("/course-bank")) {
      return ok(await scanTable(TABLES.course));
    }
    // POST /course-bank  (bulk upload array)
    if (method === "POST" && path.endsWith("/course-bank")) {
      const body = JSON.parse(event.body || "{}");
      const items = Array.isArray(body) ? body : [body];
      const { BatchWriteCommand } = await import("@aws-sdk/lib-dynamodb");
      for (let i = 0; i < items.length; i += 25) {
        const batch = items.slice(i, i+25).map(item => ({ PutRequest: { Item: { id: item.id || "q_"+Date.now()+"_"+i, ...item } } }));
        await db.send(new BatchWriteCommand({ RequestItems: { [TABLES.course]: batch } }));
      }
      return ok({ uploaded: items.length });
    }
    // DELETE /course-bank  (clear all)
    if (method === "DELETE" && path.endsWith("/course-bank")) {
      const all = await scanTable(TABLES.course);
      const { BatchWriteCommand } = await import("@aws-sdk/lib-dynamodb");
      for (let i = 0; i < all.length; i += 25) {
        const batch = all.slice(i, i+25).map(item => ({ DeleteRequest: { Key: { id: item.id } } }));
        await db.send(new BatchWriteCommand({ RequestItems: { [TABLES.course]: batch } }));
      }
      return ok({ deleted: all.length });
    }

    // ── EXAM BANK ────────────────────────────────────────────
    // GET /exam-bank
    if (method === "GET" && path.endsWith("/exam-bank")) {
      return ok(await scanTable(TABLES.exam));
    }
    // POST /exam-bank
    if (method === "POST" && path.endsWith("/exam-bank")) {
      const body = JSON.parse(event.body || "{}");
      const items = Array.isArray(body) ? body : [body];
      const { BatchWriteCommand } = await import("@aws-sdk/lib-dynamodb");
      for (let i = 0; i < items.length; i += 25) {
        const batch = items.slice(i, i+25).map(item => ({ PutRequest: { Item: { id: item.id || "q_"+Date.now()+"_"+i, ...item } } }));
        await db.send(new BatchWriteCommand({ RequestItems: { [TABLES.exam]: batch } }));
      }
      return ok({ uploaded: items.length });
    }
    // DELETE /exam-bank
    if (method === "DELETE" && path.endsWith("/exam-bank")) {
      const all = await scanTable(TABLES.exam);
      const { BatchWriteCommand } = await import("@aws-sdk/lib-dynamodb");
      for (let i = 0; i < all.length; i += 25) {
        const batch = all.slice(i, i+25).map(item => ({ DeleteRequest: { Key: { id: item.id } } }));
        await db.send(new BatchWriteCommand({ RequestItems: { [TABLES.exam]: batch } }));
      }
      return ok({ deleted: all.length });
    }

    // ── QUESTIONS (legacy) ───────────────────────────────────
    if (method === "GET" && path.includes("/questions") && !path.includes("/questions/")) {
      return ok(await scanTable(TABLES.questions));
    }
    if (method === "POST" && path.includes("/questions") && !path.includes("/questions/")) {
      const body = JSON.parse(event.body || "{}");
      const item = { id: "q_" + Date.now(), ...body };
      await db.send(new PutCommand({ TableName: TABLES.questions, Item: item }));
      return { statusCode: 201, headers, body: JSON.stringify(item) };
    }
    if (method === "PATCH" && path.includes("/questions/")) {
      const id = path.split("/questions/")[1];
      const body = JSON.parse(event.body || "{}");
      const exprs = []; const names = {}; const vals = {};
      for (const [k,v] of Object.entries(body)) {
        exprs.push(`#${k} = :${k}`); names[`#${k}`] = k; vals[`:${k}`] = v;
      }
      if (!exprs.length) return err("No fields", 400);
      await db.send(new UpdateCommand({ TableName: TABLES.questions, Key: { id }, UpdateExpression: `SET ${exprs.join(", ")}`, ExpressionAttributeNames: names, ExpressionAttributeValues: vals }));
      return ok({ updated: id, ...body });
    }
    if (method === "DELETE" && path.includes("/questions/")) {
      const id = path.split("/questions/")[1];
      await db.send(new DeleteCommand({ TableName: TABLES.questions, Key: { id } }));
      return ok({ deleted: id });
    }

    // ── GENERATE (Claude AI) ─────────────────────────────────
    if (method === "POST" && path.includes("/generate")) {
      const res = await db.send(new GetCommand({ TableName: TABLES.questions, Key: { id: "config" } }));
      const apiKey = res.Item?.anthropic_key;
      if (!apiKey) return err("API key not configured", 400);
      const { section, subcategory, difficulty, count } = JSON.parse(event.body || "{}");
      const diffText = difficulty==="سهل"?"Easy":difficulty==="متوسط"?"Medium":"Hard";
      const prompt = `Generate exactly ${count} SPLE MCQ questions. Section: ${section}, Sub: ${subcategory}, Difficulty: ${diffText}. Respond ONLY with JSON array: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]`;
      const r = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"}, body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:3000, messages:[{role:"user",content:prompt}] }) });
      const data = await r.json();
      if (data.error) throw new Error(data.error.message);
      const match = data.content[0].text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("Parse failed");
      return ok({ questions: JSON.parse(match[0]) });
    }

    return err("Not found", 404);

  } catch (e) {
    console.error(e);
    return err(e.message);
  }
};
