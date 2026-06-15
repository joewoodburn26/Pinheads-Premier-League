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

/**
 * Generate the canonical single-elimination seed order for a bracket of size n
 * (n must be a power of 2). Returns an array where index = slot position (0-based)
 * and value = seed number (1-based) that "should" occupy that slot in Round 1.
 *
 * E.g. for n=8: [1, 8, 4, 5, 2, 7, 3, 6]
 * This pairs as (1v8), (4v5), (2v7), (3v6) — standard bracket seeding.
 */
function canonicalSeedOrder(n: number): number[] {
  if (n === 1) return [1];
  if (n === 2) return [1, 2];
  const prev = canonicalSeedOrder(n / 2);
  const result: number[] = [];
  for (const seed of prev) {
    result.push(seed);
    result.push(n + 1 - seed);
  }
  return result;
}

export interface BracketSeeding {
  /** For each Round 1 slot index, the two seed numbers expected (or null if filled by a play-in winner) */
  round1Seeds: { slotIndex: number; seed1: number | null; seed2: number | null }[];
  /** For each play-in match index, which Round 1 slot + side the winner advances to */
  playInDestinations: { playInIndex: number; seed1: number; seed2: number; round1SlotIndex: number; side: 1 | 2 }[];
}

/**
 * Compute full bracket seeding info for a given team count using Option B
 * (round down to nearest power of 2, lowest seeds play-in for the remaining slots).
 */
export function getBracketSeeding(teamCount: number): BracketSeeding {
  if (teamCount < 2) return { round1Seeds: [], playInDestinations: [] };

  const mainBracketSize = Math.pow(2, Math.floor(Math.log2(teamCount)));
  const playInCount = teamCount - mainBracketSize;
  const order = canonicalSeedOrder(mainBracketSize); // length = mainBracketSize

  // The lowest `playInCount` seeds in the canonical order (by position, from the end)
  // need to come from play-in winners instead of direct seeds.
  // Number of "slots" needing a play-in winner = playInCount (one winner per play-in match)
  // Each play-in match produces ONE winner, so playInCount matches -> playInCount slots replaced.

  // Seeds that go directly to main bracket: 1..(mainBracketSize - playInCount)
  // Seeds that play in: (mainBracketSize - playInCount + 1)..teamCount
  const directSeedCutoff = mainBracketSize - playInCount;

  // Build round1Seeds: walk canonical order in pairs (slot has seed1, seed2)
  const round1Seeds: { slotIndex: number; seed1: number | null; seed2: number | null }[] = [];
  const playInDestinations: { playInIndex: number; seed1: number; seed2: number; round1SlotIndex: number; side: 1 | 2 }[] = [];

  let playInCounter = 0;
  // Lowest seeds (directSeedCutoff+1 .. mainBracketSize) in canonical order positions are replaced by play-in winners
  // Play-in pairs: (directSeedCutoff+1 vs teamCount), (directSeedCutoff+2 vs teamCount-1), ...
  const playInPairs: { seed1: number; seed2: number }[] = [];
  for (let i = 0; i < playInCount; i++) {
    playInPairs.push({ seed1: directSeedCutoff + 1 + i, seed2: teamCount - i });
  }

  for (let slot = 0; slot < mainBracketSize / 2; slot++) {
    const a = order[slot * 2];
    const b = order[slot * 2 + 1];

    const aIsPlayIn = a > directSeedCutoff;
    const bIsPlayIn = b > directSeedCutoff;

    let seed1: number | null = a;
    let seed2: number | null = b;

    if (aIsPlayIn) {
      const pairIdx = a - directSeedCutoff - 1;
      const pair = playInPairs[pairIdx];
      playInDestinations.push({ playInIndex: pairIdx, seed1: pair.seed1, seed2: pair.seed2, round1SlotIndex: slot, side: 1 });
      seed1 = null;
    }
    if (bIsPlayIn) {
      const pairIdx = b - directSeedCutoff - 1;
      const pair = playInPairs[pairIdx];
      playInDestinations.push({ playInIndex: pairIdx, seed1: pair.seed1, seed2: pair.seed2, round1SlotIndex: slot, side: 2 });
      seed2 = null;
    }

    round1Seeds.push({ slotIndex: slot, seed1, seed2 });
  }

  return { round1Seeds, playInDestinations };
}
