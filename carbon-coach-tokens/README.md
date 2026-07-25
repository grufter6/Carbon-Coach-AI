# Carbon Coach — points/token system

TypeScript module implementing the points, leaderboard, and motivational-stats
logic described in the spec. Designed to sit behind a shared API so both the
website and the mobile app (React / React Native) hit the same endpoints.

## Files
- `schema.prisma` — Postgres schema (User, CarbonActivity, LeaderboardPeriod, LeaderboardPrize)
- `types.ts` — shared TypeScript types (also importable by frontend code)
- `pointsEngine.ts` — turns a logged activity into points (base rate + streak bonus + milestone bonus)
- `leaderboardService.ts` — live monthly leaderboard + month-end prize finalization
- `userStatsService.ts` — all-time totals + motivational message generation
- `routes.ts` — Express routes tying it all together

## Setup
```bash
npm install express @prisma/client prisma
npx prisma migrate dev --name init_points_system
```
Set `DATABASE_URL` in `.env` to your Postgres connection string.

Mount the routes in your server:
```ts
import express from "express";
import pointsRoutes from "./routes";

const app = express();
app.use(express.json());
app.use("/api", pointsRoutes);
app.listen(3000);
```

## How the pieces fit together
1. Your app estimates `co2SavedKg` for an action (e.g. biking instead of
   driving X km) — that estimation logic is separate and not included here.
2. Client calls `POST /api/activities` with that value → `PointsEngine`
   computes points (10 pts/kg baseline, plus streak and milestone bonuses)
   and updates the user's running totals in one transaction.
3. `GET /api/leaderboard/current` powers the in-app leaderboard view anytime
   during the month.
4. A cron job calls `POST /api/admin/leaderboard/finalize` on the 1st of each
   month for the *previous* month — this locks in the top 3 and records
   `LeaderboardPrize` rows. Idempotent, so a retry won't double-award.
5. `GET /api/users/:userId/stats` powers the "your impact" screen — total
   points, total kg saved, and a dynamically generated motivational message
   ("you're 3kg away from 100kg saved!").

## Tuning knobs
- `POINTS_PER_KG_CO2` in `pointsEngine.ts` — overall point "generosity"
- `STREAK_BONUS_PER_DAY` / `STREAK_BONUS_CAP_DAYS` — how much daily-use habit is rewarded
- `MILESTONE_KGS` — thresholds that trigger bonus points + messaging (keep in sync between `pointsEngine.ts` and `userStatsService.ts`)
- `DEFAULT_PRIZES` in `leaderboardService.ts` — what ranks 1–3 actually win

## Why TypeScript for this
Website and mobile app both run JS/TS (React + React Native), so this module,
its types, and even API-calling code can live in a shared package imported by
both — no duplicate logic, no unit mismatches between kg/points across platforms.
