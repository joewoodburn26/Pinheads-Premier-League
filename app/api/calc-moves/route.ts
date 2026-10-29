import { NextResponse } from "next/server";
import { getActiveSeason } from "@/lib/data";
import { abilitiesForSpecies, learnableMoveNamesForSpecies } from "@/lib/dex";

// GET /api/calc-moves?species=Garchomp
// → { moves, abilities, found } — moves the Pokémon can learn in the active season's format.
export async function GET(request: Request) {
  const species = (new URL(request.url).searchParams.get("species") ?? "").slice(0, 60);
  if (!species) return NextResponse.json({ moves: [], abilities: [], found: false });

  const season = await getActiveSeason();
  const moves = learnableMoveNamesForSpecies(species, season?.format);
  return NextResponse.json(
    { moves: moves ?? [], abilities: abilitiesForSpecies(species), found: !!moves },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
