import { getActiveSeason, getRoster, getSchedule, getTeams } from "@/lib/data";
import { getPlayoffMatches } from "@/lib/playoff-actions";
import { ScheduleClient } from "@/components/schedule-client";
import type { TeamVisual } from "@/components/schedule/match-card";
import { canReport, getCurrentUser, isAdmin } from "@/lib/auth";
import { pickAce } from "@/lib/ace";
import { formatLabel } from "@/lib/dex";
import { getDominantTypeColor } from "@/lib/team-theme";
import type { Pokemon } from "@/lib/types";

export const revalidate = 0;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const season = await getActiveSeason();
  const [matches, teams, playoffMatches, user] = await Promise.all([
    getSchedule(season.id),
    getTeams(season.id),
    getPlayoffMatches(season.id),
    getCurrentUser(),
  ]);
  const rosters = await Promise.all(teams.map((t) => getRoster(t.id)));

  // Team colors (from their Pokémon's types), logo and ace for the match cards
  const visuals: Record<string, TeamVisual> = {};
  teams.forEach((team, i) => {
    const mons = rosters[i].map((s) => s.pokemon).filter((p): p is Pokemon => !!p);
    const theme = getDominantTypeColor(mons);
    visuals[team.id] = {
      id: team.id,
      name: team.teamName,
      coach: team.coach?.name ?? "",
      logoUrl: team.logoUrl,
      aceSprite: pickAce(team, mons)?.spriteUrl ?? null,
      color: theme.color,
      color2: theme.secondColor,
    };
  });

  const myTeam = user?.coachId ? teams.find((t) => t.coachId === user.coachId) : undefined;
  const week = Number((await searchParams).week);

  return (
    <ScheduleClient
      matches={matches}
      teams={teams}
      initialWeek={Number.isFinite(week) && week > 0 ? week : undefined}
      playoffMatches={playoffMatches}
      seasonId={season.id}
      visuals={visuals}
      myTeamId={myTeam?.id}
      subtitle={`${season.name} · ${formatLabel(season.format)} · Bo3 · ${
        season.playoffTeams && season.playoffTeams < teams.length ? `top ${season.playoffTeams} make the playoffs` : "all teams make the playoffs"
      }`}
      playoffTeams={season.playoffTeams}
      canReport={canReport(user)}
      canSetupBracket={canReport(user) && isAdmin(user)}
    />
  );
}
