import { getNowDateKey, getIsoWeekKey, daysBetweenDateKeys } from "../lib/time.js";
import { levelForTotal, nextLevelInfo } from "../lib/level.js";

function cap(s, n) {
  s = String(s || "").trim();
  if (s.length <= n) return s;
  return s.slice(0, n);
}

export function isProfileComplete(user) {
  const p = user?.profile || {};
  return !!(p.name && p.goal && p.workoutLevel && p.preferredWorkoutTime);
}

export function workoutSummaryTemplate({ goal, workoutLevel, typeLabel }) {
  const g = goal || "stay fit";
  const lvl = workoutLevel || "beginner";

  // Safe, general templates. AI can improve later, but templates must work fully.
  const main = (lvl === "advanced")
    ? "4 rounds: 12 squats, 10 push-ups, 12 reverse lunges per side, 30s plank. Rest 60s between rounds."
    : (lvl === "intermediate")
      ? "3 rounds: 10 squats, 8 push-ups, 10 reverse lunges per side, 20s plank. Rest 60s between rounds."
      : "2 rounds: 8 squats, 6 push-ups (knees ok), 8 reverse lunges per side, 15s plank. Rest 60–90s between rounds.";

  const duration = (lvl === "advanced") ? "25–35 min" : (lvl === "intermediate") ? "20–30 min" : "15–25 min";
  const focus = (g === "lose weight") ? "Keep the pace steady and break a light sweat." :
    (g === "gain muscle") ? "Move slow and controlled. Focus on form." :
    "Aim for smooth reps and good breathing.";

  return cap(
    `${typeLabel}\n\nWarm-up\n- 2 min easy marching or brisk walk\n- 10 arm circles each way\n- 10 hip hinges\n\nMain Workout\n- ${main}\n\nCool-down\n- 2 min slow walk + deep breaths\n- Gentle quad + chest stretch (30s each)\n\nEstimated time: ${duration}\nCoaching note: ${focus}\n\nSafety: Stop if you feel sharp pain or dizziness. If you have medical concerns, check with a professional.`,
    3500
  );
}

export function nutritionTipTemplate({ goal }) {
  const g = goal || "stay fit";
  if (g === "lose weight") return "Nutrition Tip\n- Build a ‘protein + produce’ plate today (for example: chicken or beans + a big salad).\n- Bonus: drink a full glass of water before snacks.";
  if (g === "gain muscle") return "Nutrition Tip\n- Add one extra protein serving today (Greek yogurt, eggs, tofu, lean meat).\n- Bonus: pair it with carbs around workouts (rice, oats, potatoes).";
  return "Nutrition Tip\n- Keep it simple: add one colorful fruit or veggie to your next meal.\n- Bonus: aim for consistent meal timing today.";
}

export function computeStreakUpdate({ prevDateKey, newDateKey, currentStreak, bestStreak }) {
  const diff = prevDateKey ? daysBetweenDateKeys(prevDateKey, newDateKey) : null;
  let nextStreak = 1;
  if (diff === 0) nextStreak = Math.max(1, Number(currentStreak || 0));
  else if (diff === 1) nextStreak = Number(currentStreak || 0) + 1;
  else nextStreak = 1;

  const nextBest = Math.max(Number(bestStreak || 0), nextStreak);
  return { nextStreak, nextBest, diff };
}

export function weeklyCountKey(now = new Date()) {
  return getIsoWeekKey(now);
}

export function buildProgressText({ user, progress, challenge, tz }) {
  const p = progress || {};
  const c = challenge || {};
  const name = user?.profile?.name || "athlete";

  const wk = weeklyCountKey(new Date());
  const thisWeek = Number((p.weeklyCounts && p.weeklyCounts[wk]) || 0);
  const active = !!c.active;

  return (
    `Progress Report for ${name}\n\n` +
    `Workouts\n- Total completed: ${Number(p.totalWorkoutsCompleted || 0)}\n- This week: ${thisWeek}\n\nStreak\n- Current streak: ${Number(p.currentStreakDays || 0)} day(s)\n- Best streak: ${Number(p.bestStreakDays || 0)} day(s)\n\nChallenge\n- Active: ${active ? "Yes" : "No"}\n- Day: ${active ? Number(c.currentDay || 1) : "-"}\n\nNext action: tap a button below to keep the momentum going."
  );
}

export function buildLevelText({ user, progress }) {
  const total = Number(progress?.totalWorkoutsCompleted || 0);
  const info = nextLevelInfo(total);

  const name = user?.profile?.name || "athlete";
  const current = levelForTotal(total);

  if (!info.next) {
    return (
      `Level Check for ${name}\n\n` +
      `Current level: ${current}\n` +
      `You’re at the top tier. Keep being ridiculous (in the best way).\n\n` +
      `Next action: tap 💪 Start Workout or 🔥 Daily Challenge.`
    );
  }

  return (
    `Level Check for ${name}\n\n` +
    `Current level: ${info.current}\n` +
    `Next level: ${info.next}\n` +
    `Workouts to level up: ${info.remaining}\n\n` +
    `Next action: tap 💪 Start Workout or 🔥 Daily Challenge.`
  );
}

export function getDateKeyForUser(user, fallbackTz) {
  const tz = user?.timezone || fallbackTz || "UTC";
  return getNowDateKey(tz);
}
