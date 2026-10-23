import { getActiveSeason, getPokemon, getSeasons } from "@/lib/data";
import { PointRestructureClient } from "@/components/point-restructure-client";
import { filterAvailable, formatLabel } from "@/lib/dex";

export const revalidate = 0;

export default async function PointRestructurePage() {
  const [season, seasons] = await Promise.all([getActiveSeason(), getSeasons()]);
  const pokemon = await getPokemon();
  // The CSV leaves out banned Pokémon and ones this season's format doesn't allow.
  const csvIds = filterAvailable(pokemon, season.format).filter((p) => !p.banned).map((p) => p.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black">Point Restructure</h1>
        <p className="mt-1 text-muted-foreground">
          Editing points for <span className="font-bold text-foreground">{season.name}</span> — changes only affect this season
        </p>
      </div>
      <PointRestructureClient
        pokemon={pokemon}
        seasonId={season.id}
        seasons={seasons}
        csvIds={csvIds}
        formatName={formatLabel(season.format)}
      />
    </div>
  );
}
