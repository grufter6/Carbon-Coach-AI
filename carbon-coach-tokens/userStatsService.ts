// userStatsService.ts
// Powers the "your all-time impact" screen: total points, total CO2 saved,
// current rank, and a motivational nudge toward the next milestone.

import { PrismaClient } from "@prisma/client";
import { UserStatsView } from "./types";
import { LeaderboardService } from "./leaderboardService";

const prisma = new PrismaClient();
const leaderboardService = new LeaderboardService();

// Same milestones used by PointsEngine's bonus logic — kept here too so
// messaging and point bonuses always agree on what counts as "a milestone".
const MILESTONE_KGS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];

export class UserStatsService {
  async getUserStats(userId: string): Promise<UserStatsView> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const currentMonth = await leaderboardService.getCurrentMonthLeaderboard(100);
    const entry = currentMonth.find((e) => e.userId === userId);

    const nextMilestoneKg =
      MILESTONE_KGS.find((m) => m > user.totalCo2SavedKg) ??
      Math.ceil(user.totalCo2SavedKg / 10000 + 1) * 10000;
    const kgUntilNextMilestone = Math.max(0, nextMilestoneKg - user.totalCo2SavedKg);

    return {
      totalPoints: user.totalPoints,
      totalCo2SavedKg: Math.round(user.totalCo2SavedKg * 10) / 10,
      currentMonthPoints: entry?.points ?? 0,
      currentMonthRank: entry?.rank ?? null,
      motivationalMessage: this.buildMotivationalMessage(
        user.totalCo2SavedKg,
        kgUntilNextMilestone,
        nextMilestoneKg,
        entry?.rank ?? null
      ),
      nextMilestoneKg,
      kgUntilNextMilestone: Math.round(kgUntilNextMilestone * 10) / 10,
    };
  }

  private buildMotivationalMessage(
    totalKg: number,
    kgUntilNext: number,
    nextMilestone: number,
    currentRank: number | null
  ): string {
    // Very close to a milestone — most motivating message, takes priority.
    if (kgUntilNext > 0 && kgUntilNext <= 5) {
      return `You're only ${kgUntilNext.toFixed(1)} kg away from ${nextMilestone} kg saved — one more log could get you there!`;
    }

    // In striking distance of a top-3 leaderboard spot this month.
    if (currentRank !== null && currentRank > 3 && currentRank <= 6) {
      return `You're rank #${currentRank} this month — a couple more logged trips could put you on the podium.`;
    }

    if (currentRank !== null && currentRank <= 3) {
      return `You're #${currentRank} on the leaderboard this month — keep it up to lock in a prize!`;
    }

    if (totalKg === 0) {
      return "Log your first low-carbon choice today to start earning points.";
    }

    return `You've saved ${totalKg.toFixed(1)} kg of CO2 so far — ${kgUntilNext.toFixed(1)} kg more gets you to ${nextMilestone} kg.`;
  }
}
