import { InlineKeyboard } from "grammy";

export const HOME_ACTIONS = {
  workout: "home:workout",
  challenge: "home:challenge",
  nutrition: "home:nutrition",
  progress: "home:progress",
  level: "home:level"
};

export function homeMenuKeyboard() {
  return new InlineKeyboard()
    .text("💪 Start Workout", HOME_ACTIONS.workout)
    .row()
    .text("🔥 Daily Challenge", HOME_ACTIONS.challenge)
    .row()
    .text("🥗 Nutrition Tips", HOME_ACTIONS.nutrition)
    .row()
    .text("📊 My Progress", HOME_ACTIONS.progress)
    .row()
    .text("🏆 My Level", HOME_ACTIONS.level);
}

export function confirmKeyboard(confirmData, cancelData = "cancel") {
  return new InlineKeyboard().text("✅ Yes", confirmData).text("❌ No", cancelData);
}
