FitBuddy X – Smart Fitness Coach

What it does

FitBuddy X is an interactive Telegram fitness assistant. It onboards you, runs a 7-day challenge, tracks workouts and streaks, calculates your level, and sends a weekly AI summary report.

Public commands

1) /start
Starts the bot. If you have not completed onboarding, it will ask a few questions (name, age, goal, workout level, preferred workout time). If onboarding is complete, it shows the home menu.

2) /help
Shows how to use the bot and what each menu button does.

3) /reset
Resets your FitBuddy X data (profile, progress, challenge state, workout logs). The bot will ask for confirmation.

Home menu buttons

1) 💪 Start Workout
Gives you a quick workout (even if you are not in the challenge). You can mark it completed and optionally add a note.

2) 🔥 Daily Challenge
Starts or continues a 7-day challenge. If active, it shows today’s plan and provides buttons to complete, swap, skip, or end.

3) 🥗 Nutrition Tips
Shows a simple nutrition tip tailored to your goal and level.

4) 📊 My Progress
Shows total workouts, current streak, best streak, challenge status, and this week’s count. Includes a button to generate the weekly summary on demand.

5) 🏆 My Level
Shows your current level and how many workouts remain until the next level.

Weekly scheduling

The bot runs an in-process scheduler loop. Every cycle it checks which users are due for a weekly AI summary report and sends it at most once per week per user. The bot tracks lastWeeklyReportAt in the progress collection.

Environment variables

Required

1) TELEGRAM_BOT_TOKEN
Telegram bot token.

2) MONGODB_URI
MongoDB connection string used to store user profiles, progress, challenge state, and workout logs.

3) COOKMYBOTS_AI_ENDPOINT
CookMyBots AI Gateway base URL. Example: https://api.cookmybots.com/api/ai

4) COOKMYBOTS_AI_KEY
CookMyBots AI Gateway key.

Optional

1) TZ
Default timezone used when a user has not configured a timezone. Default is UTC.

2) PORT
Reserved for hosting environments. Default is 3000. The bot does not require HTTP.

3) BASE_URL
Optional display/logging value.

How to test quickly

1) /start
Complete onboarding.

2) Tap 🔥 Daily Challenge
Start the challenge, then tap ✅ Mark Completed.

3) Tap 📊 My Progress
Verify totals and streak.

4) Tap 📩 Get Weekly Summary Now
Verify the AI report is generated.
