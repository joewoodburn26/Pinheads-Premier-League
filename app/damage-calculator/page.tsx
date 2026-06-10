import { DamageCalculator } from "@/components/damage-calculator";
import { getActiveSeason, getPokemon, getTeams, getRoster } from "@/lib/data";
import type { Pokemon } from "@/lib/types";

export default async function DamageCalculatorPage() {
  const season = await getActiveSeason();
  const [pokemon, teams] = await Promise.all([
    getPokemon(),
    getTeams(season.id),
  ]);

  const rostersRaw = await Promise.all(teams.map(t => getRoster(t.id)));
  const rosters: Record<string, Pokemon[]> = {};
  teams.forEach((team, i) => {
    rosters[team.id] = rostersRaw[i]
      .map(slot => slot.pokemon)
      .filter(Boolean) as Pokemon[];
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Damage Calculator</h1>
        <p className="text-muted-foreground">
          Gen 9 · select a team to filter Pokémon · moves load automatically from PokéAPI
        </p>
      </div>
      <DamageCalculator pokemon={pokemon} teams={teams} rosters={rosters} />
    </div>
  );
}
