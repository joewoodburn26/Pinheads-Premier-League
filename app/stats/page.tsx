import { getActiveSeason, getTeams, getStats, getRoster } from "@/lib/data";
import { StatsClient } from "@/components/stats-client";

export const revalidate = 0;

export default async function StatsPage() {
  const season = await getActiveSeason();
  const [teams, rawStats] = await Promise.all([
    getTeams(season.id),
    getStats(season.id),
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
      stats.push({
        id:          existing?.id ?? `placeholder-${key}`,
        seasonId:    season.id,
        pokemonId:   slot.pokemon.id,
        teamId:      team.id,
        gamesPlayed: existing?.gamesPlayed ?? 0,
        wins:        existing?.wins ?? 0,
        losses:      existing?.losses ?? 0,
        kos:         existing?.kos ?? 0,
        deaths:      existing?.deaths ?? 0,
        pokemon:     slot.pokemon,
        teamName:    teamNameMap[team.id] ?? "Unknown",
      });
    }
  }

  return <StatsClient stats={stats} seasonId={season.id} />;
}
