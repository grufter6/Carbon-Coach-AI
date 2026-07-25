// types.ts
// Shared across backend, website, and mobile app (import from a shared package).

export type ActivityType =
  | "bike_commute"
  | "walk_commute"
  | "public_transit"
  | "carpool"
  | "avoided_flight"
  | "plant_based_meal"
  | "reduced_home_energy"
  | "renewable_energy_purchase"
  | "other";

export interface CarbonActivityInput {
  userId: string;
  activityType: ActivityType;
  co2SavedKg: number; // must already be computed/estimated before this point
  occurredAt?: Date;
}

export interface PointsResult {
  pointsAwarded: number;
  co2SavedKg: number;
  breakdown: {
    basePoints: number;
    streakBonus: number;
    milestoneBonus: number;
  };
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  points: number;
  co2SavedKg: number;
  rank: number;
}

export interface PrizeConfig {
  rank: 1 | 2 | 3;
  label: string;
}

export interface UserStatsView {
  totalPoints: number;
  totalCo2SavedKg: number;
  currentMonthPoints: number;
  currentMonthRank: number | null;
  motivationalMessage: string;
  nextMilestoneKg: number;
  kgUntilNextMilestone: number;
}
