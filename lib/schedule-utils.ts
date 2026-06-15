// ─── Schedule generation utilities ───────────────────────────────────────────
// Used by settings-actions.ts when creating or updating a season

export const BYE_ID = "BYE";

/**
 * Generate a round-robin schedule for N teams.
 * If N is odd, adds a BYE team to make it even.
 * Uses the circle method to avoid repeats.
 * Returns up to maxWeeks weeks of matchups.
 *
 * IMPORTANT: Call this only at generation time (season creation or
 * schedule regeneration). The teamIds array should already be shuffled
 * via shuffleArray() before calling this, so the matchup order is
 * randomized once and then stays stable in the database.
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

  return schedule;
}

/**
 * Shuffle array using Fisher-Yates. Call once at generation time
 * (season creation or schedule regeneration) — never on render.
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
 * Get round name based on the number of slots in that round.
 * Used for labeling rounds in the manual playoff bracket builder.
 */
export function getRoundName(slotsInRound: number): string {
  const names: Record<number, string> = {
    1: "Finals",
    2: "Semifinals",
    4: "Quarterfinals",
    8: "Round of 16",
  };
  return names[slotsInRound] ?? `Round of ${slotsInRound * 2}`;
}

/**
 * Compute the bracket structure (number of rounds and slots per round)
 * for a given number of teams, using "round down to nearest power of 2,
 * extra teams play a Play-In round" (Option B).
 *
 * Returns an array of rounds, each with a slot count and round name.
 * Round 0 = Play-In (only present if team count isn't a power of 2).
 * Subsequent rounds halve until Finals (1 slot).
 */
export function getBracketStructure(teamCount: number): { round: number; roundName: string; slotCount: number }[] {
  if (teamCount < 2) return [];

  const mainBracketSize = Math.pow(2, Math.floor(Math.log2(teamCount)));
  const playInCount = teamCount - mainBracketSize;

  const rounds: { round: number; roundName: string; slotCount: number }[] = [];

  if (playInCount > 0) {
    rounds.push({ round: 0, roundName: "Play-In", slotCount: playInCount });
  }

  const totalMainRounds = Math.log2(mainBracketSize);
  for (let r = 1; r <= totalMainRounds; r++) {
    const slotCount = mainBracketSize / Math.pow(2, r);
    rounds.push({ round: r, roundName: getRoundName(slotCount), slotCount });
  }

  return rounds;
}
