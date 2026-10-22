import { getTeams, getRoster, getActiveSeason, getPokemon } from "@/lib/data";
import { RostersClient } from "@/components/rosters-client";
import { RosterTeamFilter } from "@/components/roster-team-filter";
import { canEditTeam, getCurrentUser, isAdmin } from "@/lib/auth";
import { filterAvailable } from "@/lib/dex";

export const revalidate = 0;

export default async function RostersPage({
  searchParams,
}: {
  searchParams: Promise<{ teams?: string }>;
}) {
  const season = await getActiveSeason();
  const [allTeams, allPokemon, user] = await Promise.all([
    getTeams(season.id),
    getPokemon(),
    getCurrentUser(),
  ]);
  const editableTeamIds = allTeams.filter((t) => canEditTeam(user, t.coachId)).map((t) => t.id);
  const canReorderTeams = isAdmin(user) && !user?.mustChangePassword;

  const { teams: teamsParam } = await searchParams;
  const selectedIds = teamsParam ? teamsParam.split(",").filter(Boolean) : [];

  const visibleTeams =
    selectedIds.length > 0
      ? allTeams.filter((t) => selectedIds.includes(t.id))
      : allTeams;

  const rostersRaw = await Promise.all(
    visibleTeams.map((team) => getRoster(team.id))
  );

  const rosters = visibleTeams.map((team, i) => ({
    team,
    slots: rostersRaw[i],
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black">Rosters</h1>
          <p className="mt-1 text-muted-foreground">
            {season.name} · {season.rosterSize ?? 10} Pokémon per team
            {editableTeamIds.length > 0 && " · click ↔ to replace or ✕ to remove · drag to reorder"}
          </p>
        </div>
        <RosterTeamFilter allTeams={allTeams} selectedIds={selectedIds} />
      </div>

      <RostersClient
        initialRosters={rosters}
        seasonId={season.id}
        allPokemon={filterAvailable(allPokemon, season.format)}
        rosterSize={season.rosterSize ?? 10}
        editableTeamIds={editableTeamIds}
        canReorderTeams={canReorderTeams}
      />
    </div>
  );
}
