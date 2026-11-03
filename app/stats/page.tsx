import { getActiveSeason, getTeams, getStats, getRoster } from "@/lib/data";
import { StatsClient } from "@/components/stats-client";
import { canReport, getCurrentUser, isOwner } from "@/lib/auth";
import { getPlayoffTotals } from "@/lib/playoff-stats";

export const revalidate = 0;

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const stageParam = (await searchParams).stage;
  const stage = stageParam === "regular" || stageParam === "playoffs" ? stageParam : "all";
  const season = await getActiveSeason();
  const [teams, rawStats, user, playoffTotals] = await Promise.all([
    getTeams(season.id),
    getStats(season.id),
    getCurrentUser(),
    getPlayoffTotals(season.id),
  ]);

  const teamNameMap = Object.fromEntries(teams.map(t => [t.id, t.teamName]));

  // Build a map of existing stats by pokemonId+teamId for fast lookup
  const statsMap = new Map<string, typeof rawStats[0]>();
  for (const s of rawStats) {
    if (s.pokemonId && s.teamId) statsMap.set(`${s.teamId}|${s.pokemonId}`, s);
  }

  // Fetch all rosters and build a complete stats list
  const allRosters = await Promise.all(teams.map(t => getRoster(t.id)));

  const stats = [];
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const slots = allRosters[i];
    for (const slot of slots) {
      if (!slot.pokemon) continue;
      const key = `${team.id}|${slot.pokemon.id}`;
      const existing = statsMap.get(key);
      // All = everything saved; Playoffs = from playoff replays; Regular = the rest
      const all = { games: existing?.gamesPlayed ?? 0, kos: existing?.kos ?? 0, deaths: existing?.deaths ?? 0 };
      const po = playoffTotals.get(key) ?? { games: 0, kos: 0, deaths: 0 };
      const shown =
        stage === "playoffs" ? po
        : stage === "regular" ? { games: Math.max(0, all.games - po.games), kos: Math.max(0, all.kos - po.kos), deaths: Math.max(0, all.deaths - po.deaths) }
        : all;
      stats.push({
        id:          existing?.id ?? `placeholder-${key}`,
        seasonId:    season.id,
        pokemonId:   slot.pokemon.id,
        teamId:      team.id,
        gamesPlayed: shown.games,
        wins:        existing?.wins ?? 0,
        losses:      existing?.losses ?? 0,
        kos:         shown.kos,
        deaths:      shown.deaths,
        pokemon:     slot.pokemon,
        teamName:    teamNameMap[team.id] ?? "Unknown",
      });
    }
  }

  return (
    <StatsClient
      stats={stats}
      seasonId={season.id}
      canEdit={canReport(user) && stage === "all"}
      stage={stage}
      canResetAll={canReport(user) && isOwner(user)}
    />
  );
}
