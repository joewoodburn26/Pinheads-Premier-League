import { getActiveSeason, getTeams, getStats } from "@/lib/data";
import { StatsClient } from "@/components/stats-client";

export const revalidate = 0;

export default async function StatsPage() {
  const season = await getActiveSeason();
  const [teams, rawStats] = await Promise.all([
    getTeams(season.id),
    getStats(season.id),
  ]);

  const teamNameMap = Object.fromEntries(teams.map(t => [t.id, t.teamName]));

  const stats = rawStats
    .filter(s => s.pokemon)
    .map(s => ({ ...s, teamName: teamNameMap[s.teamId ?? ""] ?? "Unknown" }));

  return <StatsClient stats={stats} seasonId={season.id} />;
}
