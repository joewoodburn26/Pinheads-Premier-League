import { getTeams, getRoster, getActiveSeason, getPokemon } from "@/lib/data";
import { TeamRosterEditor } from "@/components/team-roster-editor";

export default async function RostersPage() {
  const season = await getActiveSeason();
  const [teams, allPokemon] = await Promise.all([
    getTeams(season.id),
    getPokemon(),
  ]);

  const rostersRaw = await Promise.all(teams.map((team) => getRoster(team.id)));

  const rosters = teams.map((team, i) => ({
    team,
    slots: rostersRaw[i],
  }));

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-heading text-5xl">Rosters</h1>
        <p className="mt-1 text-muted-foreground">{season.name} · click ↔ to replace or ✕ to remove a Pokémon</p>
      </div>

      {rosters.map(({ team, slots }) => (
        <section key={team.id} className="space-y-3">
          <h2 className="font-heading text-3xl">{team.teamName}</h2>
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