// pointsEngine.ts
// Converts a logged carbon-saving activity into points, and applies the
// result to the user's running totals inside a single transaction.

import { PrismaClient } from "@prisma/client";
import { CarbonActivityInput, PointsResult } from "./types";

const prisma = new PrismaClient();

// Points per kg of CO2 saved. Tune this constant to control how "expensive"
// prizes feel relative to typical monthly activity.
const POINTS_PER_KG_CO2 = 10;

// Bonus multiplier for maintaining a logging streak (encourages daily habit use).
const STREAK_BONUS_PER_DAY = 0.02; // +2% per consecutive day logged, capped below
const STREAK_BONUS_CAP_DAYS = 14; // caps at +28%

// One-time bonuses when a user crosses a lifetime CO2 milestone.
const MILESTONE_KGS = [50, 100, 250, 500, 1000, 2500, 5000];
const MILESTONE_BONUS_POINTS = 100;

export class PointsEngine {
  /**
   * Award points for a single logged activity and update the user's totals.
   * co2SavedKg must already reflect the estimated reduction versus a baseline
   * (e.g. driving alone) — that estimation is a separate concern from this engine.
   */
  async awardPoints(input: CarbonActivityInput): Promise<PointsResult> {
    if (input.co2SavedKg <= 0) {
      throw new Error("co2SavedKg must be positive — nothing to award points for");
    }

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId } });

      const basePoints = Math.round(input.co2SavedKg * POINTS_PER_KG_CO2);
      const streakDays = await this.getCurrentStreakDays(tx, input.userId);
      const streakMultiplier = 1 + Math.min(streakDays, STREAK_BONUS_CAP_DAYS) * STREAK_BONUS_PER_DAY;
      const streakBonus = Math.round(basePoints * (streakMultiplier - 1));

      const totalCo2Before = user.totalCo2SavedKg;
      const totalCo2After = totalCo2Before + input.co2SavedKg;
      const milestoneBonus = this.calculateMilestoneBonus(totalCo2Before, totalCo2After);

      const pointsAwarded = basePoints + streakBonus + milestoneBonus;

      await tx.carbonActivity.create({
        data: {
          userId: input.userId,
          activityType: input.activityType,
          co2SavedKg: input.co2SavedKg,
          pointsAwarded,
          occurredAt: input.occurredAt ?? new Date(),
        },
      });

      await tx.user.update({
        where: { id: input.userId },
        data: {
          totalPoints: { increment: pointsAwarded },
          totalCo2SavedKg: { increment: input.co2SavedKg },
        },
      });

      return {
        pointsAwarded,
        co2SavedKg: input.co2SavedKg,
        breakdown: { basePoints, streakBonus, milestoneBonus },
      };
    });
  }

  /** Counts consecutive days (including today) with at least one logged activity. */
  private async getCurrentStreakDays(tx: any, userId: string): Promise<number> {
    const activities = await tx.carbonActivity.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
      take: 60, // enough to compute a realistic streak without scanning full history
    });

    if (activities.length === 0) return 0;

    const daySet = new Set(
      activities.map((a: { occurredAt: Date }) => a.occurredAt.toISOString().slice(0, 10))
    );

    let streak = 0;
    const cursor = new Date();
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (!daySet.has(key)) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  /** Awards a flat bonus for each milestone threshold crossed by this single activity. */
  private calculateMilestoneBonus(before: number, after: number): number {
    const crossed = MILESTONE_KGS.filter((m) => before < m && after >= m);
    return crossed.length * MILESTONE_BONUS_POINTS;
  }
}
