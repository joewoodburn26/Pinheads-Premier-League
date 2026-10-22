import type { Pokemon, Team } from "@/lib/types";

/**
 * A team's ace: the coach's pick if it's still on the roster,
 * otherwise the highest-point Pokémon on the roster.
 */
export function pickAce(team: Pick<Team, "acePokemonId">, roster: Pokemon[]): Pokemon | undefined {
  if (team.acePokemonId) {
    const chosen = roster.find((p) => p.id === team.acePokemonId);
    if (chosen) return chosen;
  }
  return [...roster].sort((a, b) => b.pointValue - a.pointValue)[0];
}
