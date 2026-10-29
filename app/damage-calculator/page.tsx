import { CalcClient, type CalcPokemon, type CalcTeam } from "@/components/calculator/calc-client";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSeason, getPokemon, getRoster, getTeams } from "@/lib/data";
import { filterAvailable, formatLabel, formatMode, showdownName } from "@/lib/dex";

export const dynamic = "force-dynamic";
export const metadata = { title: "Damage Calculator · Pinheads Premier League" };

export default async function DamageCalculatorPage() {
  const season = await getActiveSeason();
  if (!season) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-black">Damage Calculator</h1>
        <p className="text-muted-foreground">No active season found. Set an active season in Settings.</p>
      </div>
    );
  }

  const [allPokemon, teams, user] = await Promise.all([getPokemon(), getTeams(season.id), getCurrentUser()]);
  const rosters = await Promise.all(teams.map((t) => getRoster(t.id)));

  // Season format → which calc generation and movepools apply
  const mode = formatMode(season.format);
  const calcGen = mode.kind === "champions" ? 0 : Math.min(9, mode.maxGen);

  const legal = filterAvailable(allPokemon, season.format);
  const pokemon: CalcPokemon[] = [];
  const seen = new Set<string>();
  for (const p of legal) {
    const species = showdownName(p);
    if (!species || seen.has(p.id)) continue;
    seen.add(p.id);
    pokemon.push({ id: p.id, name: p.name, species, sprite: p.spriteUrl });
  }
  pokemon.sort((a, b) => a.name.localeCompare(b.name));
  const legalIds = new Set(pokemon.map((p) => p.id));

  const calcTeams: CalcTeam[] = teams
    .map((t, i) => ({
      id: t.id,
      name: t.teamName,
      roster: rosters[i].map((s) => s.pokemon?.id).filter((id): id is string => !!id && legalIds.has(id)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const myTeam = user?.coachId ? teams.find((t) => t.coachId === user.coachId) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-black">Damage Calculator</h1>
          <p className="text-sm text-muted-foreground">
            Works like the Showdown calculator. Moves follow this season&apos;s format; filter each side by team or import a Showdown team.
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{formatLabel(season.format)}</span>
      </div>
      <CalcClient
        calcGen={calcGen}
        formatLabel={formatLabel(season.format)}
        natdex={mode.kind === "natdex"}
        doublesDefault={mode.kind === "champions"}
        defaultLevel={mode.kind === "champions" ? 50 : 100}
        pokemon={pokemon}
        teams={calcTeams}
        myTeamId={myTeam?.id}
      />
    </div>
  );
}
