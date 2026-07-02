import { getActiveSeason, getPokemon, getSeasons } from "@/lib/data";
import { PointRestructureClient } from "@/components/point-restructure-client";

export const revalidate = 0;

export default async function PointRestructurePage() {
  const [season, seasons] = await Promise.all([getActiveSeason(), getSeasons()]);
  const pokemon = await getPokemon(season.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black">Point Restructure</h1>
        <p className="mt-1 text-muted-foreground">
          Editing points for <span className="font-bold text-foreground">{season.name}</span> — changes only affect this season
        </p>
      </div>
      <PointRestructureClient pokemon={pokemon} seasonId={season.id} seasons={seasons} />
    </div>
  );
}
