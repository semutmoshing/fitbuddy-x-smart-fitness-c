export const cfg = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,

  // Required for persistence (but code still guards if missing)
  MONGODB_URI: process.env.MONGODB_URI || "",

  // Required for AI features (but code still guards if missing)
  COOKMYBOTS_AI_ENDPOINT: process.env.COOKMYBOTS_AI_ENDPOINT || "",
  COOKMYBOTS_AI_KEY: process.env.COOKMYBOTS_AI_KEY || "",

  // Optional
  TZ: process.env.TZ || "UTC",
  PORT: Number(process.env.PORT || 3000),
  BASE_URL: process.env.BASE_URL || "",

  // Controls
  AI_DEBUG: String(process.env.AI_DEBUG || "0") === "1",
  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS || 600000),
  AI_MAX_RETRIES: Number(process.env.AI_MAX_RETRIES || 2),
  CONCURRENCY: Number(process.env.CONCURRENCY || 20)
};
