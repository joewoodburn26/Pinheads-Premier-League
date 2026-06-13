// ─── Schedule generation utilities ───────────────────────────────────────────
// Used by settings-actions.ts when creating or updating a season

export const BYE_ID = "BYE";

/**
 * Generate a round-robin schedule for N teams.
 * If N is odd, adds a BYE team to make it even.
 * Uses the circle method to avoid repeats.
 * Returns up to maxWeeks weeks of matchups.
 */
export function generateRoundRobin(
  teamIds: string[],
  maxWeeks = 8
): { week: number; homeTeam: string; awayTeam: string; isBye: boolean }[] {
  const teams = [...teamIds];
  const isOdd = teams.length % 2 !== 0;
  if (isOdd) teams.push(BYE_ID); // add BYE for odd counts

  const n = teams.length;
  const totalRounds = n - 1; // rounds needed for full round-robin
  const matchupsPerRound = n / 2;
  const weeks = Math.min(totalRounds, maxWeeks);

  const schedule: { week: number; homeTeam: string; awayTeam: string; isBye: boolean }[] = [];

  // Circle method: fix first team, rotate the rest
  const circle = [...teams];

  for (let round = 0; round < weeks; round++) {
    const week = round + 1;

    for (let i = 0; i < matchupsPerRound; i++) {
      const home = circle[i];
      const away = circle[n - 1 - i];
      const isBye = home === BYE_ID || away === BYE_ID;
      const homeTeam = home === BYE_ID ? away : home;
      const awayTeam = away === BYE_ID ? BYE_ID : away;
      schedule.push({ week, homeTeam, awayTeam, isBye });
    }

    // Rotate all except first element
    const last = circle.splice(n - 1, 1)[0];
    circle.splice(1, 0, last);
  }

  // Shuffle matchup order within each week for randomness
  for (let w = 1; w <= weeks; w++) {
    const weekSlice = schedule.filter(m => m.week === w);
    for (let i = weekSlice.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [weekSlice[i], weekSlice[j]] = [weekSlice[j], weekSlice[i]];
    }
  }

  return schedule;
}

/**
 * Shuffle array in place using Fisher-Yates
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Calculate playoff bracket using Option B:
 * - Find largest power of 2 ≤ N
 * - Bottom teams play in (play-in round)
 * - Top seeds get byes into main bracket
 *
 * Returns rounds with matchups in seed order (1 vs last, 2 vs second-to-last)
 */
export function generatePlayoffBracket(
  seededTeams: { teamId: string; teamName: string; seed: number }[]
): {
  round: number;
  roundName: string;
  matchups: { homeTeam: string; awayTeam: string; isBye: boolean; seed1: number; seed2: number }[];
}[] {
  const n = seededTeams.length;
  if (n < 2) return [];

  // Largest power of 2 ≤ n
  const mainBracketSize = Math.pow(2, Math.floor(Math.log2(n)));
  const playInCount = n - mainBracketSize; // teams that need play-in

  const rounds: {
    round: number;
    roundName: string;
    matchups: { homeTeam: string; awayTeam: string; isBye: boolean; seed1: number; seed2: number }[];
  }[] = [];

  // Play-in round (if needed)
  if (playInCount > 0) {
    const playInMatchups = [];
    for (let i = 0; i < playInCount; i++) {
      const highSeed = seededTeams[mainBracketSize + i]; // e.g. seed 9, 10
      const lowSeed  = seededTeams[n - 1 - i];           // e.g. seed 10, 9
      if (highSeed && lowSeed && highSeed.teamId !== lowSeed.teamId) {
        playInMatchups.push({
          homeTeam: highSeed.teamId,
          awayTeam: lowSeed.teamId,
          isBye: false,
          seed1: highSeed.seed,
          seed2: lowSeed.seed,
        });
      }
    }
    if (playInMatchups.length > 0) {
      rounds.push({ round: 0, roundName: "Play-In", matchups: playInMatchups });
    }
  }

  // Main bracket rounds
  const totalMainRounds = Math.log2(mainBracketSize);
  const roundNames: Record<number, string> = {
    1: "First Round",
    2: "Quarterfinals",
    3: "Semifinals",
    4: "Finals",
  };

  // Round 1 matchups: seed 1 vs last, 2 vs second-to-last, etc.
  const r1Matchups = [];
  for (let i = 0; i < mainBracketSize / 2; i++) {
    const top    = seededTeams[i];
    const bottom = seededTeams[mainBracketSize - 1 - i];
    r1Matchups.push({
      homeTeam: top.teamId,
      awayTeam: bottom.teamId,
      isBye: false,
      seed1: top.seed,
      seed2: bottom.seed,
    });
  }
  rounds.push({
    round: 1,
    roundName: roundNames[totalMainRounds] ?? `Round of ${mainBracketSize}`,
    matchups: r1Matchups,
  });

  // Subsequent rounds (placeholders — filled in as matches complete)
  for (let r = 2; r <= totalMainRounds; r++) {
    const matchCount = mainBracketSize / Math.pow(2, r);
    const placeholders = Array.from({ length: matchCount }, () => ({
      homeTeam: "TBD",
      awayTeam: "TBD",
      isBye: false,
      seed1: 0,
      seed2: 0,
    }));
    rounds.push({
      round: r,
      roundName: roundNames[r] ?? `Round ${r}`,
      matchups: placeholders,
    });
  }

  return rounds;
}

/**
 * Get round name based on teams remaining
 */
export function getRoundName(teamsRemaining: number): string {
  const names: Record<number, string> = {
    2: "Finals",
    4: "Semifinals",
    8: "Quarterfinals",
    16: "Round of 16",
  };
  return names[teamsRemaining] ?? `Round of ${teamsRemaining}`;
}
