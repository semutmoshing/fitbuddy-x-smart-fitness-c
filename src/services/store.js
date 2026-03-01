import { getDb, ensureIndexes } from "../lib/db.js";
import { safeErr } from "../lib/safeErr.js";

const COL_USERS = "users";
const COL_PROGRESS = "progress";
const COL_CHALLENGE = "challenge";
const COL_WORKOUTS = "workoutLogs";

export async function initStore(mongoUri) {
  const db = await getDb(mongoUri);
  if (!db) return null;
  await ensureIndexes(db);
  return db;
}

export async function getUser(db, telegramUserId) {
  if (!db) return null;
  return db.collection(COL_USERS).findOne({ telegramUserId: String(telegramUserId) });
}

export async function upsertUser(db, telegramUserId, patch) {
  if (!db) return;
  const p = { ...(patch || {}) };
  delete p._id;
  delete p.createdAt;

  try {
    await db.collection(COL_USERS).updateOne(
      { telegramUserId: String(telegramUserId) },
      {
        $setOnInsert: { createdAt: new Date(), firstSeenAt: new Date() },
        $set: { ...p, updatedAt: new Date() }
      },
      { upsert: true }
    );
  } catch (e) {
    console.error("[db] users upsert failed", { op: "updateOne", col: COL_USERS, err: safeErr(e) });
  }
}

export async function getProgress(db, telegramUserId) {
  if (!db) return null;
  return db.collection(COL_PROGRESS).findOne({ telegramUserId: String(telegramUserId) });
}

export async function ensureProgress(db, telegramUserId) {
  if (!db) return null;
  try {
    await db.collection(COL_PROGRESS).updateOne(
      { telegramUserId: String(telegramUserId) },
      {
        $setOnInsert: {
          totalWorkoutsCompleted: 0,
          currentStreakDays: 0,
          bestStreakDays: 0,
          weeklyCounts: {},
          lastWorkoutAt: null,
          lastCheckInAt: null,
          lastWeeklyReportAt: null
        },
        $set: { updatedAt: new Date() }
      },
      { upsert: true }
    );
    return await getProgress(db, telegramUserId);
  } catch (e) {
    console.error("[db] progress ensure failed", { op: "updateOne", col: COL_PROGRESS, err: safeErr(e) });
    return null;
  }
}

export async function getChallenge(db, telegramUserId) {
  if (!db) return null;
  return db.collection(COL_CHALLENGE).findOne({ telegramUserId: String(telegramUserId) });
}

export async function ensureChallenge(db, telegramUserId) {
  if (!db) return null;
  try {
    await db.collection(COL_CHALLENGE).updateOne(
      { telegramUserId: String(telegramUserId) },
      {
        $setOnInsert: {
          active: false,
          startDate: null,
          currentDay: 1,
          lastChallengeDeliveredAt: null,
          completedDays: {}
        },
        $set: { updatedAt: new Date() }
      },
      { upsert: true }
    );
    return await getChallenge(db, telegramUserId);
  } catch (e) {
    console.error("[db] challenge ensure failed", { op: "updateOne", col: COL_CHALLENGE, err: safeErr(e) });
    return null;
  }
}

export async function insertWorkoutLog(db, doc) {
  if (!db) return;
  const d = { ...(doc || {}) };
  delete d._id;
  delete d.createdAt;

  try {
    await db.collection(COL_WORKOUTS).insertOne({ ...d, });
  } catch (e) {
    console.error("[db] workoutLogs insert failed", { op: "insertOne", col: COL_WORKOUTS, err: safeErr(e) });
  }
}

export async function resetUserData(db, telegramUserId) {
  if (!db) return;
  const id = String(telegramUserId);
  await db.collection(COL_USERS).deleteMany({ telegramUserId: id });
  await db.collection(COL_PROGRESS).deleteMany({ telegramUserId: id });
  await db.collection(COL_CHALLENGE).deleteMany({ telegramUserId: id });
  await db.collection(COL_WORKOUTS).deleteMany({ telegramUserId: id });
}
