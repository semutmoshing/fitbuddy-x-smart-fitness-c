import { homeMenuKeyboard } from "../lib/ui.js";

export default function register(bot) {
  bot.command("start", async (ctx) => {
    const name = ctx.from?.first_name || "athlete";
    const base = [
      `Yo ${name}! I’m FitBuddy X.`,
      "\nWarm-up your thumbs: I’ll help you build consistency with short workouts, a 7-day challenge, streaks, and level-ups.",
      "\nNext action: tap a button below to begin."
    ].join("\n");

    await ctx.reply(base, { reply_markup: homeMenuKeyboard() });
  });
}
