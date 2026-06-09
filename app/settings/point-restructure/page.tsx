import { getPokemon } from "@/lib/data";
import { PointRestructureClient } from "@/components/point-restructure-client";

export default async function PointRestructurePage() {
  const pokemon = await getPokemon();
  return <PointRestructureClient pokemon={pokemon} />;
}