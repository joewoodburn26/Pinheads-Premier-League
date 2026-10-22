import { getActiveSeason, getAllPokemon } from "@/lib/data";
import { RandomizerClient } from "@/components/randomizer-client";

export const metadata = { title: "Randomizer · Pinheads Draft" };

export default async function RandomizerPage() {
  const [allPokemon, season] = await Promise.all([getAllPokemon(), getActiveSeason()]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight">Randomizer</h1>
        <p className="mt-1 text-muted-foreground">
          Generate random Pokémon within your filters. Lock ones you like and re-roll the rest.
        </p>
      </div>
      <RandomizerClient allPokemon={allPokemon} defaultFormat={season?.format} />
    </main>
  );
}
