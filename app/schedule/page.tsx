import { getActiveSeason, getSchedule, getTeams } from "@/lib/data";
import { getPlayoffMatches } from "@/lib/playoff-actions";
import { getParsedReplays } from "@/lib/replay-stats-actions";
import { ScheduleClient } from "@/components/schedule-client";

export const revalidate = 0;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const season = await getActiveSeason();
  const [matches, teams, playoffMatches, parsedReplays] = await Promise.all([
    getSchedule(season.id),
    getTeams(season.id),
    getPlayoffMatches(season.id),
    getParsedReplays(season.id),
  ]);

  const weeks = [...new Set(matches.map(m => m.week))].sort((a, b) => a - b);
  const requested = Number((await searchParams).week ?? weeks[0] ?? 1);

  return (
    <ScheduleClient
      matches={matches}
      teams={teams}
      initialWeek={requested}
      playoffMatches={playoffMatches}
      seasonId={season.id}
      parsedReplays={parsedReplays}
    />
  );
}
