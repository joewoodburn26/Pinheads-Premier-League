import { NextResponse } from "next/server";
import { getActiveSeason, getPokemon } from "@/lib/data";
import { learnableMoves } from "@/lib/dex";

// GET /api/move-search?moves=flipturn,knockoff
// → { ids: [...] } Pokémon (our ids) that can learn ALL the moves in the active season's format.
export async function GET(request: Request) {
  const moves = (new URL(request.url).searchParams.get("moves") ?? "")
    .split(",")
    .map((m) => m.trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
    .slice(0, 6);
  if (moves.length === 0) return NextResponse.json({ ids: [] });

  const [season, pokemon] = await Promise.all([getActiveSeason(), getPokemon()]);
  const ids = pokemon
    .filter((p) => {
      const learnable = learnableMoves(p, season?.format);
      return moves.every((m) => learnable.has(m));
    })
    .map((p) => p.id);

  return NextResponse.json({ ids }, { headers: { "Cache-Control": "private, max-age=60" } });
}
