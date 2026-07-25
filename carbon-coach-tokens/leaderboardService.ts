// leaderboardService.ts
// Computes the current monthly leaderboard and finalizes/awards prizes
// once a month ends. Intended to be called by a scheduled job (cron) on
// the 1st of each month, plus on-demand for live leaderboard views.

import { PrismaClient } from "@prisma/client";
import { LeaderboardEntry, PrizeConfig } from "./types";

const prisma = new PrismaClient();

const DEFAULT_PRIZES: PrizeConfig[] = [
  { rank: 1, label: "$50 gift card" },
  { rank: 2, label: "$25 gift card" },
  { rank: 3, label: "Free year of Carbon Coach Premium" },
];

export class LeaderboardService {
  /** Live leaderboard for the current, still-in-progress month. */
  async getCurrentMonthLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
    const { start, end } = this.getMonthBounds(new Date());
    return this.computeLeaderboard(start, end, limit);
  }

  /** Reusable ranking query for any month window. */
  private async computeLeaderboard(
    start: Date,
    end: Date,
    limit: number
  ): Promise<LeaderboardEntry[]> {
    const grouped = await prisma.carbonActivity.groupBy({
      by: ["userId"],
      where: { occurredAt: { gte: start, lt: end } },
      _sum: { pointsAwarded: true, co2SavedKg: true },
      orderBy: { _sum: { pointsAwarded: "desc" } },
      take: limit,
    });

    const userIds = grouped.map((g) => g.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.displayName]));

    return grouped.map((g, i) => ({
      userId: g.userId,
      displayName: nameById.get(g.userId) ?? "Unknown",
      points: g._sum.pointsAwarded ?? 0,
      co2SavedKg: g._sum.co2SavedKg ?? 0,
      rank: i + 1,
    }));
  }

  /**
   * Closes out the given month, determines the top 3, and records prizes.
   * Idempotent: safe to re-run — it no-ops if the period is already finalized.
   * Actual prize fulfillment (sending the gift card, etc.) should be triggered
   * by whatever handles LeaderboardPrize creation — e.g. a webhook/notification job.
   */
  async finalizeMonth(monthDate: Date, prizeConfig: PrizeConfig[] = DEFAULT_PRIZES): Promise<void> {
    const { start, end } = this.getMonthBounds(monthDate);

    const period = await prisma.leaderboardPeriod.upsert({
      where: { periodStart_periodEnd: { periodStart: start, periodEnd: end } },
      update: {},
      create: { periodStart: start, periodEnd: end },
    });

    if (period.finalized) return; // already awarded — don't double-prize

    const top3 = await this.computeLeaderboard(start, end, 3);

    await prisma.$transaction([
      ...top3.map((entry) => {
        const prize = prizeConfig.find((p) => p.rank === entry.rank);
        return prisma.leaderboardPrize.create({
          data: {
            periodId: period.id,
            userId: entry.userId,
            rank: entry.rank,
            pointsAtWin: entry.points,
            prizeLabel: prize?.label ?? "Prize",
          },
        });
      }),
      prisma.leaderboardPeriod.update({
        where: { id: period.id },
        data: { finalized: true },
      }),
    ]);
  }

  private getMonthBounds(date: Date): { start: Date; end: Date } {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    return { start, end };
  }
}
