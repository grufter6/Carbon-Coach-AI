// routes.ts
// Express routes consumed identically by the website (fetch/axios) and the
// mobile app (same fetch API in React Native) — one API, two clients.

import { Router, Request, Response } from "express";
import { PointsEngine } from "./pointsEngine";
import { LeaderboardService } from "./leaderboardService";
import { UserStatsService } from "./userStatsService";
import { ActivityType } from "./types";

const router = Router();
const pointsEngine = new PointsEngine();
const leaderboardService = new LeaderboardService();
const userStatsService = new UserStatsService();

// POST /activities  { userId, activityType, co2SavedKg }
router.post("/activities", async (req: Request, res: Response) => {
  try {
    const { userId, activityType, co2SavedKg } = req.body as {
      userId: string;
      activityType: ActivityType;
      co2SavedKg: number;
    };

    if (!userId || !activityType || typeof co2SavedKg !== "number") {
      return res.status(400).json({ error: "userId, activityType, and co2SavedKg are required" });
    }

    const result = await pointsEngine.awardPoints({ userId, activityType, co2SavedKg });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /leaderboard/current
router.get("/leaderboard/current", async (_req: Request, res: Response) => {
  try {
    const leaderboard = await leaderboardService.getCurrentMonthLeaderboard();
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /users/:userId/stats
router.get("/users/:userId/stats", async (req: Request, res: Response) => {
  try {
    const stats = await userStatsService.getUserStats(req.params.userId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /admin/leaderboard/finalize  { month: "2026-07-01" }
// Call this from a monthly cron job (or trigger manually/via admin panel).
router.post("/admin/leaderboard/finalize", async (req: Request, res: Response) => {
  try {
    const { month } = req.body as { month: string };
    await leaderboardService.finalizeMonth(new Date(month));
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
