import { getTeams, getRoster, getActiveSeason, getPokemon } from "@/lib/data";
import { TeamRosterEditor } from "@/components/team-roster-editor";
import { RosterTeamFilter } from "@/components/roster-team-filter";

export default async function RostersPage({
  searchParams,
}: {
  searchParams: Promise<{ teams?: string }>;
}) {
  const season = await getActiveSeason();
  const [allTeams, allPokemon] = await Promise.all([
    getTeams(season.id),
    getPokemon(),
  ]);

  // Parse which teams are selected from URL (e.g. ?teams=team-parma-sylveons,team-akron-aggrons)
  const { teams: teamsParam } = await searchParams;
  const selectedIds = teamsParam ? teamsParam.split(",").filter(Boolean) : [];

  // If none selected, show all
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
      {/* Header + filter */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black">Rosters</h1>
          <p className="mt-1 text-muted-foreground">
            {season.name} · click ↔ to replace or ✕ to remove a Pokémon
          </p>
        </div>
        <RosterTeamFilter allTeams={allTeams} selectedIds={selectedIds} />
      </div>

      {/* Team rosters */}
      {rosters.map(({ team, slots }) => (
        <section key={team.id} className="space-y-3">
          <h2 className="text-3xl font-bold">{team.teamName}</h2>
          <TeamRosterEditor
            teamId={team.id}
            seasonId={season.id}
            slots={slots}
            allPokemon={allPokemon}
          />
        </section>
      ))}
    </div>
  );
}