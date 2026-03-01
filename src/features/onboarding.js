import { InlineKeyboard } from "grammy";
import { isProfileComplete } from "../services/workouts.js";

function cap(s, n) {
  s = String(s || "").trim();
  if (s.length <= n) return s;
  return s.slice(0, n);
}

export function onboardingKeyboardGoal() {
  return new InlineKeyboard()
    .text("Lose weight", "ob:goal:lose")
    .text("Gain muscle", "ob:goal:gain")
    .row()
    .text("Stay fit", "ob:goal:stay");
}

export function onboardingKeyboardLevel() {
  return new InlineKeyboard()
    .text("Beginner", "ob:lvl:beginner")
    .text("Intermediate", "ob:lvl:intermediate")
    .row()
    .text("Advanced", "ob:lvl:advanced");
}

export function onboardingKeyboardTime() {
  return new InlineKeyboard()
    .text("Morning", "ob:time:morning")
    .text("Afternoon", "ob:time:afternoon")
    .text("Evening", "ob:time:evening")
    .row()
    .text("Custom", "ob:time:custom");
}

export function needsOnboarding(user) {
  if (!user) return true;
  return !isProfileComplete(user);
}

export function nextOnboardingPrompt(user) {
  const st = user?.onboardingState || "name";
  const p = user?.profile || {};

  if (!p.name) return { state: "name" };
  if (p.age == null) return { state: "age" };
  if (!p.goal) return { state: "goal" };
  if (!p.workoutLevel) return { state: "workoutLevel" };
  if (!p.preferredWorkoutTime) return { state: "preferredWorkoutTime" };

  return { state: "done" };
}

export function renderOnboardingQuestion({ state }) {
  if (state === "name") {
    return {
      text: "Let’s get you set up.\n\nName\n- What should I call you?\n\nNext action: type your name.",
      keyboard: null
    };
  }

  if (state === "age") {
    return {
      text: "Age\n- How old are you? (Numbers only)\n- Or tap Skip if you’d rather not say.\n\nNext action: type your age or tap Skip.",
      keyboard: new InlineKeyboard().text("Skip", "ob:age:skip")
    };
  }

  if (state === "goal") {
    return {
      text: "Goal\n- What are we training for?\n\nNext action: pick one.",
      keyboard: onboardingKeyboardGoal()
    };
  }

  if (state === "workoutLevel") {
    return {
      text: "Workout level\n- How spicy do you want this to be?\n\nNext action: pick one.",
      keyboard: onboardingKeyboardLevel()
    };
  }

  if (state === "preferredWorkoutTime") {
    return {
      text: "Preferred workout time\n- When should I nudge you?\n\nNext action: pick a time window (or Custom).",
      keyboard: onboardingKeyboardTime()
    };
  }

  if (state === "customTime") {
    return {
      text: "Custom time\n- Type a time like 07:30 or 18:15 (your local time).\n\nNext action: type HH:MM.",
      keyboard: null
    };
  }

  return { text: "All set.", keyboard: null };
}

export function parseOnboardingTextInput({ state, text }) {
  const t = cap(text, 64);

  if (state === "name") {
    const name = cap(t.replace(/\s+/g, " "), 32);
    if (!name || name.length < 1) return { ok: false, error: "Please send a name (1–32 chars)." };
    return { ok: true, patch: { profile: { name } } };
  }

  if (state === "age") {
    const raw = String(t || "").trim().toLowerCase();
    if (raw === "skip") return { ok: true, patch: { profile: { age: null } } };
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 10 || n > 110) {
      return { ok: false, error: "Age should be a number between 10 and 110 (or tap Skip)." };
    }
    return { ok: true, patch: { profile: { age: Math.floor(n) } } };
  }

  if (state === "customTime") {
    const m = String(t || "").trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!m) return { ok: false, error: "Please type a time like 07:30 or 18:15." };
    return { ok: true, patch: { profile: { preferredWorkoutTime: `${m[1].padStart(2, "0")}:${m[2]}` } } };
  }

  return { ok: false, error: "Unexpected input." };
}

export function mergeProfile(existingProfile, patchProfile) {
  return { ...(existingProfile || {}), ...(patchProfile || {}) };
}
