import { safeErr } from "../lib/safeErr.js";
import { getIsoWeekKey } from "../lib/time.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function startScheduler({ bot, db, intervalMs = 120000 }) {
  let stopped = false;
  let tick = 0;

  console.log("[scheduler] start", { intervalMs, hasDb: !!db });

  (async () => {
    while (!stopped) {
      tick++;
      try {
        console.log("[scheduler] cycle", { tick });
        await runWeeklyReports({ bot, db });
      } catch (e) {
        console.error("[scheduler] cycle failed", { err: safeErr(e) });
      }

      if (tick % 30 === 0) {
        const m = process.memoryUsage();
        console.log("[mem]", { rssMB: Math.round(m.rss / 1e6), heapUsedMB: Math.round(m.heapUsed / 1e6) });
      }

      await sleep(intervalMs);
    }
  })();

  return () => {
    stopped = true;
  };
}

async function runWeeklyReports({ bot, db }) {
  if (!db) return;

  const now = new Date();
  const weekKey = getIsoWeekKey(now);

  // Conservative: send at most a few per cycle to avoid long backlogs.
  const cursor = db.collection("progress").find({}).limit(10);
  const rows = await cursor.toArray();

  for (const p of rows) {
    const last = p.lastWeeklyReportAt ? new Date(p.lastWeeklyReportAt) : null;
    const lastWeekKey = last ? getIsoWeekKey(last) : "";
    if (lastWeekKey === weekKey) continue;

    // Mark first, then send (idempotent best-effort)
    await db.collection("progress").updateOne(
      { telegramUserId: p.telegramUserId },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: { lastWeeklyReportAt: new Date(), updatedAt: new Date() }
      },
      { upsert: true }
    );

    try {
      await bot.api.sendMessage(
        Number(p.telegramUserId),
        "Weekly Summary\n- Your report is ready.\n\nNext action: open the bot and tap 📊 My Progress to generate details.",
        { disable_web_page_preview: true }
      );
    } catch (e) {
      console.error("[scheduler] weekly send failed", { userId: p.telegramUserId, err: safeErr(e) });
    }
  }
}
