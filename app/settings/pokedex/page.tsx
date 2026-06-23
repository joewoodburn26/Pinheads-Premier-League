import { getAllPokemon } from "@/lib/data";
import { PokedexClient } from "@/components/pokedex-client";

export const revalidate = 0;

export default async function PokedexPage() {
  const pokemon = await getAllPokemon();
  return <PokedexClient pokemon={pokemon} />;
}
