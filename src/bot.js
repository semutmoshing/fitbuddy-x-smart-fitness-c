import { Bot } from "grammy";
import { cfg } from "./lib/config.js";
import { safeErr } from "./lib/safeErr.js";
import { buildBotProfile } from "./lib/botProfile.js";
import { homeMenuKeyboard, HOME_ACTIONS } from "./lib/ui.js";
import { initStore, getUser, upsertUser, ensureProgress, ensureChallenge } from "./services/store.js";
import {
  needsOnboarding,
  nextOnboardingPrompt,
  renderOnboardingQuestion,
  parseOnboardingTextInput,
  mergeProfile
} from "./features/onboarding.js";
import {
  getDateKeyForUser,
  workoutSummaryTemplate,
  nutritionTipTemplate,
  computeStreakUpdate,
  buildProgressText,
  buildLevelText,
  weeklyCountKey
} from "./services/workouts.js";
import { levelForTotal } from "./lib/level.js";
import { aiChat } from "./lib/ai.js";

export async function createBot(token) {
  const bot = new Bot(token);

  const db = await initStore(cfg.MONGODB_URI);
  if (!db) console.warn("[db] not connected, persistence disabled", { hasMongoUri: !!cfg.MONGODB_URI });

  bot.use(async (ctx, next) => {
    ctx.db = db;
    return next();
  });

  bot.catch((err) => {
    console.error("[bot] error", { err: safeErr(err?.error || err) });
  });

  const inflightByChat = new Map();
  let globalInflight = 0;
  const GLOBAL_CAP = 1;

  async function withAgentLocks(ctx, fn) {
    const chatId = String(ctx.chat?.id || "");
    if (!chatId) return fn();

    if (inflightByChat.get(chatId)) {
      await ctx.reply("I’m working on your last request. One sec.\n\nNext action: wait, then tap a menu button.", {
        reply_markup: homeMenuKeyboard()
      });
      return;
    }

    if (globalInflight >= GLOBAL_CAP) {
      await ctx.reply("Busy for a moment. Try again in a bit.\n\nNext action: tap a menu button.", {
        reply_markup: homeMenuKeyboard()
      });
      return;
    }

    inflightByChat.set(chatId, true);
    globalInflight++;
    try {
      return await fn();
    } finally {
      inflightByChat.delete(chatId);
      globalInflight = Math.max(0, globalInflight - 1);
    }
  }

  async function sendHome(ctx, text) {
    try {
      await ctx.reply(text, { reply_markup: homeMenuKeyboard() });
    } catch (e) {
      console.error("[tg] sendHome failed", { err: safeErr(e) });
      try {
        await ctx.reply(text);
      } catch (e2) {
        console.error("[tg] fallback send failed", { err: safeErr(e2) });
      }
    }
  }

  async function showOnboardingIfNeeded(ctx) {
    if (!db) {
      await sendHome(ctx, "Database is not connected, so I can’t save your profile yet.\n\nNext action: try again in a minute.");
      return true;
    }

    const userId = ctx.from?.id;
    if (!userId) return false;

    const user = await getUser(db, userId);
    if (!needsOnboarding(user)) return false;

    await upsertUser(db, userId, {
      telegramUserId: String(userId),
      onboardingState: user?.onboardingState || "name",
      profile: user?.profile || {},
      timezone: user?.timezone || cfg.TZ
    });

    const fresh = await getUser(db, userId);
    const next = nextOnboardingPrompt(fresh);
    const q = renderOnboardingQuestion(next);

    await ctx.reply(q.text, { reply_markup: q.keyboard || undefined });
    return true;
  }

  bot.callbackQuery(/^cancel$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Okay, cancelled.\n\nNext action: pick something from the menu.", {
      reply_markup: homeMenuKeyboard()
    });
  });

  bot.callbackQuery(/^ob:/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!db) return;

    const userId = ctx.from?.id;
    if (!userId) return;

    const user = await getUser(db, userId);
    const data = String(ctx.callbackQuery?.data || "");

    let patch = null;
    if (data.startsWith("ob:age:skip")) {
      patch = { profile: { age: null } };
    } else if (data.startsWith("ob:goal:")) {
      const v = data.split(":")[2];
      const goal = v === "lose" ? "lose weight" : v === "gain" ? "gain muscle" : "stay fit";
      patch = { profile: { goal } };
    } else if (data.startsWith("ob:lvl:")) {
      const workoutLevel = data.split(":")[2];
      patch = { profile: { workoutLevel } };
    } else if (data.startsWith("ob:time:")) {
      const t = data.split(":")[2];
      if (t === "custom") {
        await upsertUser(db, userId, { onboardingState: "customTime" });
        await ctx.editMessageText("Custom time\n- Type a time like 07:30 or 18:15 (your local time).\n\nNext action: type HH:MM.");
        return;
      }
      const preferredWorkoutTime = t === "morning" ? "08:00" : t === "afternoon" ? "13:00" : "18:00";
      patch = { profile: { preferredWorkoutTime } };
    }

    if (patch) {
      const mergedProfile = mergeProfile(user?.profile, patch.profile);
      await upsertUser(db, userId, { profile: mergedProfile });
    }

    const fresh = await getUser(db, userId);
    const next = nextOnboardingPrompt(fresh);
    if (next.state === "done") {
      await upsertUser(db, userId, { onboardingState: "done" });
      await ensureProgress(db, userId);
      await ensureChallenge(db, userId);

      const p = fresh?.profile || {};
      const summary = [
        "Onboarding complete\n",
        `Name: ${p.name || "-"}`,
        `Age: ${p.age == null ? "(skipped)" : p.age}`,
        `Goal: ${p.goal || "-"}`,
        `Workout level: ${p.workoutLevel || "-"}`,
        `Preferred time: ${p.preferredWorkoutTime || "-"}`,
        "\nNext action: pick a button below to start." 
      ].join("\n");

      await ctx.editMessageText(summary, { reply_markup: homeMenuKeyboard() });
      return;
    }

    const q = renderOnboardingQuestion(next);
    await ctx.editMessageText(q.text, { reply_markup: q.keyboard || undefined });
  });

  bot.on("message:text", async (ctx, next) => {
    const raw = ctx.message?.text || "";
    if (raw.startsWith("/")) return next();

    // Onboarding capture
    if (db) {
      const userId = ctx.from?.id;
      if (userId) {
        const user = await getUser(db, userId);
        if (needsOnboarding(user)) {
          const nextPrompt = nextOnboardingPrompt(user);
          const state = nextPrompt.state;

          const parsed = parseOnboardingTextInput({ state, text: raw });
          if (!parsed.ok) {
            await ctx.reply(parsed.error + "\n\nNext action: try again.");
            return;
          }

          const mergedProfile = mergeProfile(user?.profile, parsed.patch?.profile);
          const nextState = (state === "name") ? "age" : (state === "age") ? "goal" : (state === "customTime") ? "goal" : user?.onboardingState;

          await upsertUser(db, userId, {
            profile: mergedProfile,
            onboardingState: nextState
          });

          const fresh = await getUser(db, userId);
          const next2 = nextOnboardingPrompt(fresh);
          if (next2.state === "done") {
            await upsertUser(db, userId, { onboardingState: "done" });
            await ensureProgress(db, userId);
            await ensureChallenge(db, userId);

            const p = fresh?.profile || {};
            const summary = [
              "Onboarding complete\n",
              `Name: ${p.name || "-"}`,
              `Age: ${p.age == null ? "(skipped)" : p.age}`,
              `Goal: ${p.goal || "-"}`,
              `Workout level: ${p.workoutLevel || "-"}`,
              `Preferred time: ${p.preferredWorkoutTime || "-"}`,
              "\nNext action: pick a button below to start." 
            ].join("\n");

            await sendHome(ctx, summary);
            return;
          }

          const q = renderOnboardingQuestion(next2);
          await ctx.reply(q.text, { reply_markup: q.keyboard || undefined });
          return;
        }
      }
    }

    // Non-command, non-onboarding: be helpful but keep it constrained.
    await withAgentLocks(ctx, async () => {
      const botProfile = buildBotProfile();
      const prompt = String(raw || "").trim();

      const system = [
        botProfile,
        "Response format rules:",
        "- Use short headings and bullet points.",
        "- End with a clear next action that matches the home menu buttons.",
        "- Keep it safe and general. No medical advice."
      ].join("\n");

      const res = await aiChat(cfg, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt.slice(0, 2000) }
        ],
        meta: { platform: "telegram", feature: "free_text" }
      }, { retries: cfg.AI_MAX_RETRIES });

      const text = res?.json?.output?.content;
      if (!res.ok || !text) {
        console.warn("[ai] chat missing output", { ok: res?.ok, status: res?.status, err: res?.error });
        await sendHome(ctx, "I tripped over a dumbbell (technical issue).\n\nNext action: tap a button below to continue.");
        return;
      }

      await sendHome(ctx, String(text).slice(0, 3500));
    });
  });

  bot.callbackQuery(HOME_ACTIONS.workout, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!db) {
      await ctx.reply("Database is not connected yet.\n\nNext action: try again in a minute.");
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const user = await getUser(db, userId);
    if (needsOnboarding(user)) {
      await ctx.reply("Quick setup first.\n\nNext action: answer the onboarding question.");
      await showOnboardingIfNeeded(ctx);
      return;
    }

    const p = await ensureProgress(db, userId);
    await ensureChallenge(db, userId);

    const summary = workoutSummaryTemplate({
      goal: user?.profile?.goal,
      workoutLevel: user?.profile?.workoutLevel,
      typeLabel: "Quick Workout"
    });

    await ctx.reply(summary + "\n\nNext action: when you finish, reply 'done' or tap 📊 My Progress.", {
      reply_markup: homeMenuKeyboard()
    });
  });

  bot.callbackQuery(HOME_ACTIONS.nutrition, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!db) {
      await ctx.reply("Database is not connected yet.\n\nNext action: try again in a minute.");
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const user = await getUser(db, userId);
    if (needsOnboarding(user)) {
      await ctx.reply("Quick setup first.\n\nNext action: answer the onboarding question.");
      await showOnboardingIfNeeded(ctx);
      return;
    }

    const tip = nutritionTipTemplate({ goal: user?.profile?.goal });
    await sendHome(ctx, tip + "\n\nNext action: tap 💪 Start Workout or 🔥 Daily Challenge.");
  });

  bot.callbackQuery(HOME_ACTIONS.progress, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!db) {
      await ctx.reply("Database is not connected yet.\n\nNext action: try again in a minute.");
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const user = await getUser(db, userId);
    if (needsOnboarding(user)) {
      await ctx.reply("Quick setup first.\n\nNext action: answer the onboarding question.");
      await showOnboardingIfNeeded(ctx);
      return;
    }

    const progress = await ensureProgress(db, userId);
    const challenge = await ensureChallenge(db, userId);

    const txt = buildProgressText({ user, progress, challenge, tz: cfg.TZ });
    await sendHome(ctx, txt);
  });

  bot.callbackQuery(HOME_ACTIONS.level, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!db) {
      await ctx.reply("Database is not connected yet.\n\nNext action: try again in a minute.");
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const user = await getUser(db, userId);
    if (needsOnboarding(user)) {
      await ctx.reply("Quick setup first.\n\nNext action: answer the onboarding question.");
      await showOnboardingIfNeeded(ctx);
      return;
    }

    const progress = await ensureProgress(db, userId);
    await sendHome(ctx, buildLevelText({ user, progress }));
  });

  bot.callbackQuery(HOME_ACTIONS.challenge, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!db) {
      await ctx.reply("Database is not connected yet.\n\nNext action: try again in a minute.");
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const user = await getUser(db, userId);
    if (needsOnboarding(user)) {
      await ctx.reply("Quick setup first.\n\nNext action: answer the onboarding question.");
      await showOnboardingIfNeeded(ctx);
      return;
    }

    const ch = await ensureChallenge(db, userId);
    if (!ch?.active) {
      await ctx.reply(
        "7-Day Challenge\n\nNot active yet. Want to start today?\n\nNext action: tap Start.",
        {
          reply_markup: {
            inline_keyboard: [[
              { text: "🔥 Start 7-Day Challenge", callback_data: "challenge:start" },
              { text: "Cancel", callback_data: "cancel" }
            ]]
          }
        }
      );
      return;
    }

    const day = Number(ch.currentDay || 1);
    const workout = workoutSummaryTemplate({
      goal: user?.profile?.goal,
      workoutLevel: user?.profile?.workoutLevel,
      typeLabel: `Day ${day} Challenge Workout`
    });

    const tip = nutritionTipTemplate({ goal: user?.profile?.goal });

    await ctx.reply(
      workout + "\n\n" + tip + "\n\nNext action: mark it completed when done.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Mark Completed", callback_data: "challenge:done" }],
            [{ text: "⏭ Skip Today", callback_data: "challenge:skip" }, { text: "🛑 End Challenge", callback_data: "challenge:end" }],
            [{ text: "Back to Menu", callback_data: "cancel" }]
          ]
        }
      }
    );
  });

  bot.callbackQuery("challenge:start", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!db) return;
    const userId = ctx.from?.id;
    if (!userId) return;

    const now = new Date();

    await db.collection("challenge").updateOne(
      { telegramUserId: String(userId) },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: {
          active: true,
          startDate: now,
          currentDay: 1,
          lastChallengeDeliveredAt: null,
          completedDays: {},
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    await ctx.editMessageText("Challenge started. Day 1 is ready.\n\nNext action: tap 🔥 Daily Challenge again to see today’s plan.", {
      reply_markup: homeMenuKeyboard()
    });
  });

  bot.callbackQuery(["challenge:done", "challenge:skip", "challenge:end"], async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!db) return;

    const userId = ctx.from?.id;
    if (!userId) return;

    const user = await getUser(db, userId);
    const progress = await ensureProgress(db, userId);
    const challenge = await ensureChallenge(db, userId);

    const action = String(ctx.callbackQuery?.data || "");

    if (action === "challenge:end") {
      await db.collection("challenge").updateOne(
        { telegramUserId: String(userId) },
        {
          $setOnInsert: { },
          $set: { active: false, updatedAt: new Date() }
        },
        { upsert: true }
      );
      await ctx.editMessageText("Challenge ended. No drama. We restart when you’re ready.\n\nNext action: tap 💪 Start Workout or 🔥 Daily Challenge.", {
        reply_markup: homeMenuKeyboard()
      });
      return;
    }

    if (action === "challenge:skip") {
      const nextDay = Math.min(7, Number(challenge?.currentDay || 1) + 1);
      await db.collection("challenge").updateOne(
        { telegramUserId: String(userId) },
        {
          $setOnInsert: { },
          $set: { currentDay: nextDay, updatedAt: new Date() }
        },
        { upsert: true }
      );
      await ctx.editMessageText("Skipped today. Tomorrow is a new rep.\n\nNext action: come back and tap 🔥 Daily Challenge.", {
        reply_markup: homeMenuKeyboard()
      });
      return;
    }

    // done
    const dateKey = getDateKeyForUser(user, cfg.TZ);
    const weekKey = weeklyCountKey(new Date());

    const prevDateKey = progress?.lastWorkoutDateKey || null;
    const { nextStreak, nextBest } = computeStreakUpdate({
      prevDateKey,
      newDateKey: dateKey,
      currentStreak: progress?.currentStreakDays,
      bestStreak: progress?.bestStreakDays
    });

    const total = Number(progress?.totalWorkoutsCompleted || 0) + 1;
    const prevLevel = levelForTotal(Number(progress?.totalWorkoutsCompleted || 0));
    const newLevel = levelForTotal(total);

    const day = Number(challenge?.currentDay || 1);
    const completedDays = { ...(challenge?.completedDays || {}) };
    completedDays[String(day)] = true;

    const nextDay = day >= 7 ? 7 : day + 1;
    const stillActive = day >= 7 ? false : true;

    const weeklyCounts = { ...(progress?.weeklyCounts || {}) };
    weeklyCounts[weekKey] = Number(weeklyCounts[weekKey] || 0) + 1;

    await db.collection("progress").updateOne(
      { telegramUserId: String(userId) },
      {
        $setOnInsert: { },
        $set: {
          totalWorkoutsCompleted: total,
          currentStreakDays: nextStreak,
          bestStreakDays: nextBest,
          lastWorkoutAt: new Date(),
          lastWorkoutDateKey: dateKey,
          weeklyCounts,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    await db.collection("challenge").updateOne(
      { telegramUserId: String(userId) },
      {
        $setOnInsert: { },
        $set: {
          completedDays,
          currentDay: nextDay,
          active: stillActive,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    await db.collection("workoutLogs").insertOne({
      telegramUserId: String(userId),
      date: dateKey,
      type: "challenge",
      summary: `Day ${day} challenge workout`,
      completed: true,
      notes: null,
      });

    let msg = `Completed\n\n- Logged: Day ${day}\n- Total workouts: ${total}\n- Streak: ${nextStreak} day(s)\n\nNext action: tap 🔥 Daily Challenge for the next day.`;

    if (newLevel !== prevLevel) {
      msg = `Level Up\n\nYou just went from ${prevLevel} to ${newLevel}.\nThat’s not luck. That’s reps.\n\n` + msg;
    }

    if (!stillActive) {
      msg = `Challenge complete\n\nYou finished Day 7. That’s the whole week. Respect.\n\n- Total workouts: ${total}\n- Best streak: ${nextBest} day(s)\n\nNext action: tap 💪 Start Workout or start the challenge again tomorrow.`;
    }

    await ctx.editMessageText(msg, { reply_markup: homeMenuKeyboard() });
  });

  return bot;
}
