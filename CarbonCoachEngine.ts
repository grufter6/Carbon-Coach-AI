// 1. Define the necessary data structures
export interface CommuteInput {
  distanceMiles: number;
  estimatedMinutes: {
    walk: number;
    bike: number;
    transit: number;
    drive: number;
  };
  aqi: number;          // Air Quality Index (0 - 500)
  temperatureF: number; // Fahrenheit
  pollenLevel: 'Low' | 'Medium' | 'High';
}

export type TransportMode = 'walk' | 'bike' | 'transit' | 'drive';

export interface ModeScore {
  mode: TransportMode;
  totalScore: number;
  co2SavedLbs: number;
  reasoning: string;
}

// Baseline CO2 emissions per mile (approximate averages in lbs)
const CO2_PER_MILE = {
  drive: 0.90,
  transit: 0.30,
  bike: 0.0,
  walk: 0.0
};

// 2. The Core Carbon Coach Engine
export class CarbonCoachEngine {
  
  // Calculates the score for a specific mode of transport
  private calculateModeScore(mode: TransportMode, input: CommuteInput): ModeScore {
    const distance = input.distanceMiles;
    const time = input.estimatedMinutes[mode];
    
    // --- 1. CO2 Savings Calculation ---
    // We compare against "drive" as the baseline max emission
    const baselineEmission = distance * CO2_PER_MILE.drive;
    const modeEmission = distance * CO2_PER_MILE[mode];
    const co2Saved = Math.max(0, baselineEmission - modeEmission);
    
    // Reward heavily for carbon saved (Weight: 50 points per lb saved)
    let score = co2Saved * 50; 
    let reasoningPieces: string[] = [];

    // --- 2. Time Cost Penalty ---
    // Penalty increases as time takes longer (Weight: -0.5 points per minute)
    score -= time * 0.5;

    // --- 3. Health & Environment Penalties (Only affects active transit) ---
    if (mode === 'walk' || mode === 'bike') {
      // AQI Penalty: Severe impact if AQI > 100
      if (input.aqi > 100) {
        score -= (input.aqi - 100) * 2;
        reasoningPieces.push("poor air quality outdoors");
      }
      
      // Heat Penalty: Heavy penalty if dangerously hot
      if (input.temperatureF > 95) {
        score -= (input.temperatureF - 95) * 5;
        reasoningPieces.push("extreme heat");
      }

      // Pollen Penalty
      if (input.pollenLevel === 'High') {
        score -= 15;
        reasoningPieces.push("high pollen counts");
      }
    }

    // --- 4. Generate Dynamic Reasoning ---
    let reasoning = "";
    if (co2Saved > 0 && reasoningPieces.length === 0) {
      reasoning = `it saves ${co2Saved.toFixed(1)} lbs of CO2 compared to driving while keeping you active.`;
    } else if (reasoningPieces.length > 0) {
      reasoning = `driving or transit is safer today due to ${reasoningPieces.join(' and ')}.`;
    } else {
      reasoning = `it's the fastest option for your schedule today, even though it utilizes fossil fuels.`;
    }

    return {
      mode,
      totalScore: Math.round(score),
      co2SavedLbs: parseFloat(co2Saved.toFixed(2)),
      reasoning
    };
  }

  // 3. The Daily Recommendation Trigger
  public getDailyRecommendation(input: CommuteInput): string {
    const modes: TransportMode[] = ['walk', 'bike', 'transit', 'drive'];
    
    const results = modes.map(mode => this.calculateModeScore(mode, input));
    
    // Sort to find the highest scoring mode
    results.sort((a, b) => b.totalScore - a.totalScore);
    const bestOption = results[0];

    // Capitalize output mode
    const formattedMode = bestOption.mode.charAt(0).toUpperCase() + bestOption.mode.slice(1);

    return `Take ${formattedMode} today because ${bestOption.reasoning}`;
  }

  // 4. The Post-Commute Token Reward System
  // Tracks actual trip data to award points to their monthly total
  public processCompletedTrip(
    modeConfirmed: TransportMode, 
    input: CommuteInput, 
    userProfile: { totalPoints: number; monthlyPoints: number; totalCo2Saved: number }
  ) {
    const tripMetrics = this.calculateModeScore(modeConfirmed, input);
    
    // 100 points per lb of CO2 actually saved, guaranteed minimum 5 points for logging
    const pointsEarned = Math.max(5, Math.round(tripMetrics.co2SavedLbs * 100));
    
    // Update user profile
    userProfile.totalPoints += pointsEarned;
    userProfile.monthlyPoints += pointsEarned;
    userProfile.totalCo2Saved += tripMetrics.co2SavedLbs;

    // Create a motivational milestone message
    const nextMilestone = Math.ceil(userProfile.totalCo2Saved / 50) * 50;
    const remaining = (nextMilestone - userProfile.totalCo2Saved).toFixed(1);
    
    return {
      pointsEarned,
      currentMonthlyTotal: userProfile.monthlyPoints,
      motivationMessage: `Awesome job! You earned ${pointsEarned} points. You are only ${remaining} lbs away from hitting your next big milestone of ${nextMilestone} lbs of total CO2 saved!`
    };
  }
}

// --- Example Execution / Usage Context ---
const coach = new CarbonCoachEngine();

const user = {
  totalPoints: 450,
  monthlyPoints: 120,
  totalCo2Saved: 12.5
};

const perfectDay: CommuteInput = {
  distanceMiles: 3,
  estimatedMinutes: { walk: 45, bike: 15, transit: 20, drive: 10 },
  aqi: 42,
  temperatureF: 72,
  pollenLevel: 'Low'
};

console.log("Recommendation for a good day:");
console.log(coach.getDailyRecommendation(perfectDay));

console.log("\nProcessing trip complete:");
const tripEnd = coach.processCompletedTrip('bike', perfectDay, user);
console.log(tripEnd.motivationMessage);
