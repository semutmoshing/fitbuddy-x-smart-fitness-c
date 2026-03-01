import { MongoClient } from "mongodb";
import { safeErr } from "./safeErr.js";

let _client = null;
let _db = null;
let _connecting = null;

export async function getDb(mongoUri) {
  if (!mongoUri) return null;
  if (_db) return _db;
  if (_connecting) return _connecting;

  _connecting = (async () => {
    try {
      _client = new MongoClient(mongoUri, { maxPoolSize: 5, ignoreUndefined: true });
      await _client.connect();
      _db = _client.db();
      console.log("[db] connected", { ok: true });
      return _db;
    } catch (e) {
      console.error("[db] connect failed", { err: safeErr(e) });
      _client = null;
      _db = null;
      return null;
    } finally {
      _connecting = null;
    }
  })();

  return _connecting;
}

export async function ensureIndexes(db) {
  if (!db) return;
  try {
    await db.collection("users").createIndex({ telegramUserId: 1 }, { unique: true });
    await db.collection("progress").createIndex({ telegramUserId: 1 }, { unique: true });
    await db.collection("challenge").createIndex({ telegramUserId: 1 }, { unique: true });
    await db.collection("workoutLogs").createIndex({ telegramUserId: 1, date: 1 });
    await db.collection("workoutLogs").createIndex({ createdAt: -1 });
  } catch (e) {
    console.error("[db] ensureIndexes failed", { err: safeErr(e) });
  }
}
