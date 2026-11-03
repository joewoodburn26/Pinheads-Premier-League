// Single-elimination bracket math. With N qualifying teams the bracket has
// B = next power of two ≥ N slots; the top (B − N) seeds get a first-round bye.

export function bracketSize(teams: number): number {
  let b = 1;
  while (b < teams) b *= 2;
  return Math.max(2, b);
}

/** Standard seed order for a power-of-two bracket: 8 → [1, 8, 4, 5, 2, 7, 3, 6] */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

export function roundCount(teams: number): number {
  return Math.log2(bracketSize(teams));
}

/** Round-1 pairings: seeds per slot (null = bye). */
export function firstRound(teams: number): { slot: number; seed1: number; seed2: number | null }[] {
  const size = bracketSize(teams);
  const order = seedOrder(size);
  const out: { slot: number; seed1: number; seed2: number | null }[] = [];
  for (let i = 0; i < size / 2; i++) {
    const a = order[i * 2];
    const b = order[i * 2 + 1];
    out.push({ slot: i, seed1: Math.min(a, b), seed2: Math.max(a, b) <= teams ? Math.max(a, b) : null });
  }
  return out;
}

/** "Finals", "Semifinals", … by matches left in the round; round 1 with byes is "Opening Round". */
export function roundName(round: number, teams: number): string {
  const total = roundCount(teams);
  const matches = bracketSize(teams) / 2 ** round;
  if (round === 1 && bracketSize(teams) !== teams) return "Opening Round";
  if (round === total) return "Finals";
  if (matches === 2) return "Semifinals";
  if (matches === 4) return "Quarterfinals";
  return `Round of ${matches * 2}`;
}

/** Valid "teams qualify" choices for a league of `teamCount` teams. */
export function playoffSizeOptions(teamCount: number): number[] {
  const out: number[] = [];
  for (let n = 2; n <= teamCount; n++) out.push(n);
  return out;
}
