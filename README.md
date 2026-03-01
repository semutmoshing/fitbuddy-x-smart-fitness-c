FitBuddy X – Smart Fitness Coach

This is a Telegram bot (grammY) that onboards users, runs a 7-day fitness challenge, tracks workouts and streaks, awards levels, and sends weekly AI summary reports.

Setup

1) Install
npm install

2) Configure env
Copy .env.sample to .env and fill in the values.

3) Run locally
npm run dev

4) Run production
npm start

Notes

1) The bot uses long polling by default.
2) MongoDB is required for persistence (profiles, progress, challenge state, workout logs, weekly reports).
3) AI calls go through the CookMyBots AI Gateway (COOKMYBOTS_AI_ENDPOINT + COOKMYBOTS_AI_KEY).

Commands

1) /start
2) /help
3) /reset

Troubleshooting

1) If you see TELEGRAM_BOT_TOKEN is required, set it in your environment.
2) If MongoDB is not configured, the bot will warn and fall back to limited in-memory behavior.
