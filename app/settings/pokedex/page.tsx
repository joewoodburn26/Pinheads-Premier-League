import { getBasePokemon } from "@/lib/data";
import { PokedexClient } from "@/components/pokedex-client";

export const revalidate = 0;

// Base (Pokédex) points. Per-season points are edited in Point Restructure.
export default async function PokedexPage() {
  const pokemon = await getBasePokemon();
  return <PokedexClient pokemon={pokemon} />;
}
