import { getActiveSeason, getSchedule, getTeams } from "@/lib/data";
import { getPlayoffMatches } from "@/lib/playoff-actions";
import { getParsedReplays } from "@/lib/replay-stats-actions";
import { ScheduleClient } from "@/components/schedule-client";
import { canReport, getCurrentUser, isAdmin } from "@/lib/auth";

export const revalidate = 0;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const season = await getActiveSeason();
  const [matches, teams, playoffMatches, parsedReplays, user] = await Promise.all([
    getSchedule(season.id),
    getTeams(season.id),
    getPlayoffMatches(season.id),
    getParsedReplays(season.id),
    getCurrentUser(),
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
      canReport={canReport(user)}
      canSetupBracket={canReport(user) && isAdmin(user)}
    />
  );
}
