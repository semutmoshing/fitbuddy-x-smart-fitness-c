import { confirmKeyboard, homeMenuKeyboard } from "../lib/ui.js";

export default function register(bot) {
  bot.command("reset", async (ctx) => {
    await ctx.reply(
      "Reset\n\nThis will delete your FitBuddy X profile, progress, challenge, and workout logs.\n\nNext action: confirm below.",
      { reply_markup: confirmKeyboard("reset:confirm", "reset:cancel") }
    );
  });

  bot.callbackQuery("reset:cancel", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Reset cancelled.\n\nNext action: pick something from the menu.", {
      reply_markup: homeMenuKeyboard()
    });
  });

  bot.callbackQuery("reset:confirm", async (ctx) => {
    await ctx.answerCallbackQuery();
    const db = ctx.db;
    if (!db) {
      await ctx.editMessageText("I can’t reset right now because the database is not connected.\n\nNext action: try again in a minute.");
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.editMessageText("Missing user info.\n\nNext action: try again.");
      return;
    }

    await db.collection("users").deleteMany({ telegramUserId: String(userId) });
    await db.collection("progress").deleteMany({ telegramUserId: String(userId) });
    await db.collection("challenge").deleteMany({ telegramUserId: String(userId) });
    await db.collection("workoutLogs").deleteMany({ telegramUserId: String(userId) });

    await ctx.editMessageText(
      "Reset complete. Clean slate. Fresh legs. Let’s go.\n\nNext action: tap /start to onboard again.",
      { reply_markup: homeMenuKeyboard() }
    );
  });
}
