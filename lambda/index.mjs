import { DynamoDBClient, CreateTableCommand, ListTablesCommand, DeleteTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand, UpdateCommand, BatchWriteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "eu-north-1" });
const db = DynamoDBDocumentClient.from(client);

const BANKS_TABLE   = "sple-banks";
const MAIN_TABLE    = "sple-questions";
const RESULTS_TABLE = "sple-results";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,x-api-key",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,PATCH,PUT,OPTIONS"
};

const ok  = (body)      => ({ statusCode:200, headers, body:JSON.stringify(body) });
const err = (msg, c=500)=> ({ statusCode:c,   headers, body:JSON.stringify({error:msg}) });

async function scanAll(table) {
  const items=[]; let last;
  do {
    const r = await db.send(new ScanCommand({TableName:table, ExclusiveStartKey:last}));
    items.push(...r.Items);
    last = r.LastEvaluatedKey;
  } while(last);
  return items.filter(i=>i.id!=="config");
}

async function batchPut(table, items) {
  for(let i=0;i<items.length;i+=25){
    const batch=items.slice(i,i+25).map(item=>({PutRequest:{Item:item}}));
    await db.send(new BatchWriteCommand({RequestItems:{[table]:batch}}));
  }
}

async function batchDel(table, items) {
  for(let i=0;i<items.length;i+=25){
    const batch=items.slice(i,i+25).map(item=>({DeleteRequest:{Key:{id:item.id}}}));
    await db.send(new BatchWriteCommand({RequestItems:{[table]:batch}}));
  }
}

async function ensureTable(tableName) {
  try {
    const list = await client.send(new ListTablesCommand({}));
    if(list.TableNames.includes(tableName)) return true;
    await client.send(new CreateTableCommand({
      TableName: tableName,
      KeySchema: [{AttributeName:"id", KeyType:"HASH"}],
      AttributeDefinitions: [{AttributeName:"id", AttributeType:"S"}],
      BillingMode: "PAY_PER_REQUEST"
    }));
    await new Promise(r=>setTimeout(r,3000));
    return true;
  } catch(e) { console.error("ensureTable error:", e); return false; }
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path   = event.requestContext?.http?.path   || event.path || "/";
  if(method==="OPTIONS") return {statusCode:200,headers,body:""};

  try {

    // ── BANKS LIST ── GET /banks (fast - uses stored count)
    if(method==="GET" && path.endsWith("/banks")) {
      const banks = await scanAll(BANKS_TABLE);
      return ok(banks.map(b => ({...b, count: b.count ?? 0})));
    }

    // ── REFRESH COUNTS ── GET /banks/refresh-counts
    if(method==="GET" && path.endsWith("/banks/refresh-counts")) {
      const banks = await scanAll(BANKS_TABLE);
      const updated = await Promise.all(banks.map(async b => {
        try {
          const items = await scanAll(b.tableName);
          await db.send(new UpdateCommand({
            TableName: BANKS_TABLE, Key: {id: b.id},
            UpdateExpression: "SET #c = :c",
            ExpressionAttributeNames: {"#c": "count"},
            ExpressionAttributeValues: {":c": items.length}
          }));
          return {...b, count: items.length};
        } catch { return {...b, count: b.count ?? 0}; }
      }));
      return ok(updated);
    }

    // ── CREATE BANK ── POST /banks
    if(method==="POST" && path.endsWith("/banks")) {
      const body = JSON.parse(event.body||"{}");
      const {name, description=""} = body;
      if(!name) return err("name required",400);
      const id = "bank_" + Date.now();
      const tableName = "sple-bank-" + name.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-").slice(0,30);
      await ensureTable(tableName);
      const bank = {id, name, description, tableName, createdAt: new Date().toISOString(), activeForStudy:false, activeForExam:false};
      await db.send(new PutCommand({TableName:BANKS_TABLE, Item:bank}));
      return ok(bank);
    }

    // ── DELETE BANK ── DELETE /banks/{id}
    if(method==="DELETE" && path.includes("/banks/") && !path.includes("/questions")) {
      const id = path.split("/banks/")[1].split("/")[0];
      const res = await db.send(new GetCommand({TableName:BANKS_TABLE, Key:{id}}));
      const bank = res.Item;
      if(!bank) return err("Bank not found",404);
      // Delete all questions in bank table
      try {
        const items = await scanAll(bank.tableName);
        if(items.length) await batchDel(bank.tableName, items);
      } catch(e) { console.log("table may not exist:", e.message); }
      await db.send(new DeleteCommand({TableName:BANKS_TABLE, Key:{id}}));
      return ok({deleted:id});
    }

    // ── SET ACTIVE BANK ── PATCH /banks/{id}
    if(method==="PATCH" && path.includes("/banks/") && !path.includes("/questions")) {
      const id = path.split("/banks/")[1].split("/")[0];
      const body = JSON.parse(event.body||"{}");
      // If setting activeForStudy, clear others
      if(body.activeForStudy===true) {
        const all = await scanAll(BANKS_TABLE);
        await Promise.all(all.map(b => b.id!==id ? db.send(new UpdateCommand({
          TableName:BANKS_TABLE, Key:{id:b.id},
          UpdateExpression:"SET activeForStudy = :f",
          ExpressionAttributeValues:{":f":false}
        })) : Promise.resolve()));
      }
      if(body.activeForExam===true) {
        const all = await scanAll(BANKS_TABLE);
        await Promise.all(all.map(b => b.id!==id ? db.send(new UpdateCommand({
          TableName:BANKS_TABLE, Key:{id:b.id},
          UpdateExpression:"SET activeForExam = :f",
          ExpressionAttributeValues:{":f":false}
        })) : Promise.resolve()));
      }
      const exprs=[]; const names={}; const vals={};
      for(const [k,v] of Object.entries(body)){
        exprs.push(`#${k}=:${k}`); names[`#${k}`]=k; vals[`:${k}`]=v;
      }
      await db.send(new UpdateCommand({
        TableName:BANKS_TABLE, Key:{id},
        UpdateExpression:`SET ${exprs.join(",")}`,
        ExpressionAttributeNames:names, ExpressionAttributeValues:vals
      }));
      return ok({updated:id});
    }

    // ── GET BANK QUESTIONS ── GET /banks/{id}/questions
    if(method==="GET" && path.includes("/banks/") && path.endsWith("/questions")) {
      const id = path.split("/banks/")[1].split("/")[0];
      const res = await db.send(new GetCommand({TableName:BANKS_TABLE, Key:{id}}));
      if(!res.Item) return err("Bank not found",404);
      const items = await scanAll(res.Item.tableName);
      return ok(items);
    }

    // ── UPLOAD TO BANK ── POST /banks/{id}/questions
    if(method==="POST" && path.includes("/banks/") && path.endsWith("/questions")) {
      const id = path.split("/banks/")[1].split("/")[0];
      const res = await db.send(new GetCommand({TableName:BANKS_TABLE, Key:{id}}));
      if(!res.Item) return err("Bank not found",404);
      const body = JSON.parse(event.body||"[]");
      const items = (Array.isArray(body)?body:[body]).map((q,i)=>({...q, id:q.id||`${id}_${Date.now()}_${i}`, bankId:id}));
      await batchPut(res.Item.tableName, items);
      // Update count in sple-banks
      try {
        const allItems = await scanAll(res.Item.tableName);
        await db.send(new UpdateCommand({TableName:BANKS_TABLE, Key:{id}, UpdateExpression:"SET #count = :c", ExpressionAttributeNames:{"#count":"count"}, ExpressionAttributeValues:{":c":allItems.length}}));
      } catch(e) { console.log("count update error:", e.message); }
      return ok({uploaded:items.length});
    }

    // ── CLEAR BANK QUESTIONS ── DELETE /banks/{id}/questions
    if(method==="DELETE" && path.includes("/banks/") && path.endsWith("/questions")) {
      const id = path.split("/banks/")[1].split("/")[0];
      const res = await db.send(new GetCommand({TableName:BANKS_TABLE, Key:{id}}));
      if(!res.Item) return err("Bank not found",404);
      const items = await scanAll(res.Item.tableName);
      if(items.length) await batchDel(res.Item.tableName, items);
      // Update count to 0
      await db.send(new UpdateCommand({TableName:BANKS_TABLE, Key:{id}, UpdateExpression:"SET #count = :c", ExpressionAttributeNames:{"#count":"count"}, ExpressionAttributeValues:{":c":0}}));
      return ok({deleted:items.length});
    }

    // ── DELETE ONE QUESTION FROM BANK ── DELETE /banks/{id}/questions/{qid}
    if(method==="DELETE" && path.includes("/banks/") && path.includes("/questions/")) {
      const parts = path.split("/");
      const bankId = parts[parts.indexOf("banks")+1];
      const qid = parts[parts.indexOf("questions")+1];
      const res = await db.send(new GetCommand({TableName:BANKS_TABLE, Key:{id:bankId}}));
      if(!res.Item) return err("Bank not found",404);
      await db.send(new DeleteCommand({TableName:res.Item.tableName, Key:{id:qid}}));
      return ok({deleted:qid});
    }

    // ── MAIN QUESTIONS (legacy) ──────────────────────────
    if(method==="GET" && path.includes("/questions") && !path.includes("/questions/") && !path.includes("/banks")) {
      return ok(await scanAll(MAIN_TABLE));
    }
    if(method==="POST" && path.includes("/questions") && !path.includes("/questions/") && !path.includes("/banks")) {
      const body = JSON.parse(event.body||"{}");
      const item = {id:"q_"+Date.now(), ...body};
      await db.send(new PutCommand({TableName:MAIN_TABLE, Item:item}));
      return {statusCode:201, headers, body:JSON.stringify(item)};
    }
    if(method==="PATCH" && path.includes("/questions/") && !path.includes("/banks")) {
      const id = path.split("/questions/")[1];
      const body = JSON.parse(event.body||"{}");
      const exprs=[]; const names={}; const vals={};
      for(const [k,v] of Object.entries(body)){exprs.push(`#${k}=:${k}`);names[`#${k}`]=k;vals[`:${k}`]=v;}
      if(!exprs.length) return err("No fields",400);
      await db.send(new UpdateCommand({TableName:MAIN_TABLE,Key:{id},UpdateExpression:`SET ${exprs.join(",")}`,ExpressionAttributeNames:names,ExpressionAttributeValues:vals}));
      return ok({updated:id,...body});
    }
    if(method==="DELETE" && path.includes("/questions/") && !path.includes("/banks")) {
      const id = path.split("/questions/")[1];
      await db.send(new DeleteCommand({TableName:MAIN_TABLE,Key:{id}}));
      return ok({deleted:id});
    }

    // ── RESULTS ─────────────────────────────────────────────
    if(method==="GET" && path.endsWith("/results")) {
      const items = await scanAll(RESULTS_TABLE);
      return ok(items);
    }
    if(method==="POST" && path.endsWith("/results")) {
      const body = JSON.parse(event.body||"{}");
      const item = { ...body, id: body.id || `${body.userId}_${Date.now()}`, timestamp: body.timestamp || new Date().toISOString() };
      await db.send(new PutCommand({TableName:RESULTS_TABLE, Item:item}));
      return {statusCode:201, headers, body:JSON.stringify(item)};
    }

    return err("Not found",404);
  } catch(e) {
    console.error(e);
    return err(e.message);
  }
};
