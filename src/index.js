import "dotenv/config";
import { run } from "@grammyjs/runner";
import { cfg } from "./lib/config.js";
import { safeErr } from "./lib/safeErr.js";

process.on("unhandledRejection", (r) => {
  console.error("[process] UnhandledRejection", { err: safeErr(r) });
  process.exit(1);
});
process.on("uncaughtException", (e) => {
  console.error("[process] UncaughtException", { err: safeErr(e) });
  process.exit(1);
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function boot() {
  console.log("[boot] start", {
    TELEGRAM_BOT_TOKEN_set: !!cfg.TELEGRAM_BOT_TOKEN,
    MONGODB_URI_set: !!cfg.MONGODB_URI,
    COOKMYBOTS_AI_ENDPOINT_set: !!cfg.COOKMYBOTS_AI_ENDPOINT,
    COOKMYBOTS_AI_KEY_set: !!cfg.COOKMYBOTS_AI_KEY,
    TZ: cfg.TZ,
    PORT: cfg.PORT,
    BASE_URL_set: !!cfg.BASE_URL
  });

  if (!cfg.TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is required. Add it in your environment and redeploy.");
    process.exit(1);
  }

  const { createBot } = await import("./bot.js");
  const { registerCommands } = await import("./commands/loader.js");
  const { startScheduler } = await import("./features/scheduler.js");

  const bot = await createBot(cfg.TELEGRAM_BOT_TOKEN);

  try {
    await bot.init();
  } catch (e) {
    console.warn("[boot] bot.init failed", { err: safeErr(e) });
  }

  await registerCommands(bot);

  try {
    await bot.api.setMyCommands([
      { command: "start", description: "Welcome & onboarding" },
      { command: "help", description: "How to use FitBuddy X" },
      { command: "reset", description: "Wipe your FitBuddy X data" }
    ]);
  } catch (e) {
    console.warn("[boot] setMyCommands failed", { err: safeErr(e) });
  }

  // Prefer long polling + runner for reliability on deploy overlap.
  let backoff = 2000;
  const maxBackoff = 20000;
  let runner = null;
  let restarting = false;

  const stopScheduler = startScheduler({ bot, db: bot?.api?.config ? bot?.api?.config : null, intervalMs: 120000 });

  async function startPolling() {
    if (restarting) return;
    restarting = true;
    try {
      try {
        await bot.api.deleteWebhook({ drop_pending_updates: true });
      } catch (e) {
        console.warn("[boot] deleteWebhook failed", { err: safeErr(e) });
      }

      console.log("[polling] start", { concurrency: 1 });
      runner = run(bot, { concurrency: 1 });

      // Reset backoff after successful start.
      backoff = 2000;
    } catch (e) {
      const err = safeErr(e);
      console.error("[polling] start failed", { err });

      // Telegram 409 happens during deploy overlap; retry with backoff.
      await sleep(backoff);
      backoff = Math.min(maxBackoff, Math.round(backoff * 2.5));
      restarting = false;
      return startPolling();
    } finally {
      restarting = false;
    }
  }

  await startPolling();

  // Keep process alive; runner handles updates.
  console.log("[boot] ready");
}

boot().catch((e) => {
  console.error("[boot] fatal", { err: safeErr(e) });
  process.exit(1);
});
