import { homeMenuKeyboard } from "../lib/ui.js";

export default function register(bot) {
  bot.command("help", async (ctx) => {
    const text = [
      "Help\n",
      "What I do\n- Onboard you and tailor workouts to your goal and level\n- Run a 7-day challenge with daily workouts + nutrition tips\n- Track workouts, streaks, and your level\n- Send a weekly AI summary report\n",
      "Commands\n- /start to begin\n- /help to see this message\n- /reset to wipe your data (with confirmation)\n",
      "Privacy\n- I store your profile and workout logs in my database so I can track your progress.\n",
      "Next action: tap a button below."
    ].join("\n");

    await ctx.reply(text, { reply_markup: homeMenuKeyboard() });
  });
}
