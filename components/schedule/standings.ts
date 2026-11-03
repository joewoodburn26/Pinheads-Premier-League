import type { ScheduleMatch, Team } from "@/lib/types";

export type StandingRow = {
  teamId: string;
  teamName: string;
  coachName: string;
  wins: number;
  losses: number;
  battleDiff: number;
  gameWins: number;
  gameLosses: number;
  /** Most recent results first, e.g. ["W", "L", "W"] */
  form: ("W" | "L")[];
  seed: number;
};

/** "2-1" → [2, 1] from the winner's point of view */
function games(score?: string | null): [number, number] {
  const m = /^(\d)\s*-\s*(\d)$/.exec(score ?? "");
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

/**
 * Standings with the league's tie-breakers:
 *  1. Match record  2. Battle differential  3. Head-to-head (among the tied teams)  4. Game win %
 */
export function computeStandings(teams: Team[], matches: ScheduleMatch[]): StandingRow[] {
  const played = matches
    .filter((m) => !m.isBye && m.winner)
    .sort((a, b) => a.week - b.week);

  const rows = teams.map((team): StandingRow => {
    const mine = played.filter((m) => m.homeTeam === team.id || m.awayTeam === team.id);
    let gameWins = 0;
    let gameLosses = 0;
    let diff = 0;
    for (const m of mine) {
      const [w, l] = games(m.bo3Score);
      if (m.winner === team.id) { gameWins += w; gameLosses += l; } else { gameWins += l; gameLosses += w; }
      diff += m.homeTeam === team.id ? m.homeDiff ?? 0 : m.awayDiff ?? 0;
    }
    return {
      teamId: team.id,
      teamName: team.teamName,
      coachName: team.coach?.name ?? "—",
      wins: mine.filter((m) => m.winner === team.id).length,
      losses: mine.filter((m) => m.winner !== team.id).length,
      battleDiff: diff,
      gameWins,
      gameLosses,
      form: mine.map((m) => (m.winner === team.id ? "W" : "L") as "W" | "L").reverse().slice(0, 5),
      seed: 0,
    };
  });

  const gamePct = (r: StandingRow) => (r.gameWins + r.gameLosses ? r.gameWins / (r.gameWins + r.gameLosses) : 0);

  // Group by the first two tie-breakers, then order each tied group by head-to-head, then game win %
  rows.sort((a, b) => b.wins - a.wins || b.battleDiff - a.battleDiff);
  const out: StandingRow[] = [];
  for (let i = 0; i < rows.length; ) {
    let j = i + 1;
    while (j < rows.length && rows[j].wins === rows[i].wins && rows[j].battleDiff === rows[i].battleDiff) j++;
    const group = rows.slice(i, j);
    if (group.length > 1) {
      const ids = new Set(group.map((r) => r.teamId));
      const h2h = new Map(group.map((r) => [r.teamId, 0]));
      for (const m of played) {
        if (ids.has(m.homeTeam) && ids.has(m.awayTeam) && m.winner) h2h.set(m.winner, (h2h.get(m.winner) ?? 0) + 1);
      }
      group.sort((a, b) => (h2h.get(b.teamId) ?? 0) - (h2h.get(a.teamId) ?? 0) || gamePct(b) - gamePct(a));
    }
    out.push(...group);
    i = j;
  }
  return out.map((r, i) => ({ ...r, seed: i + 1 }));
}
