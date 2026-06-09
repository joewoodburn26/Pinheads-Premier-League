import { DamageCalculator } from "@/components/damage-calculator";
import { getActiveSeason, getPokemon, getTeams, getRoster } from "@/lib/data";

export default async function DamageCalculatorPage() {
  const season = await getActiveSeason();
  const [pokemon, teams] = await Promise.all([
    getPokemon(),
    getTeams(season.id),
  ]);

  const rostersRaw = await Promise.all(teams.map((t) => getRoster(t.id)));
  const rosters: Record<string, typeof pokemon> = {};
  teams.forEach((team, i) => {
    rosters[team.id] = rostersRaw[i]
      .map((slot) => slot.pokemon)
      .filter(Boolean) as typeof pokemon;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Damage Calculator</h1>
        <p className="text-muted-foreground">
          Gen 9 damage formula · filter by team to see only their 10 Pokémon
        </p>
      </div>
      <DamageCalculator pokemon={pokemon} teams={teams} rosters={rosters} />
    </div>
  );
}