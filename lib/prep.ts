// Matchup prep calculations (server-side). Movepools follow the season's format
// (National Dex by generation, or Pokémon Champions) via lib/dex.ts.

import { MOVE_CATEGORIES, abilitiesOf, findSpecies, learnableMoves } from "@/lib/dex";
import { multiplier, pokemonTypes, pokemonTypesFor } from "@/lib/type-chart";
import type { Pokemon, PokemonType } from "@/lib/types";

export const PREP_CATEGORIES = MOVE_CATEGORIES;

export type PrepMember = {
  pokemon: Pokemon;
  types: PokemonType[];
  abilities: string[];
  matched: boolean;
  /** category key → move names this Pokémon can learn */
  moves: Record<string, string[]>;
  /** attacking type → damage multiplier against this Pokémon */
  weakness: Record<PokemonType, number>;
};

export type PrepTeam = {
  members: PrepMember[];
  /** category key → [{ move, type, learners }] for moves at least one member learns */
  categories: Record<string, { move: string; type: PokemonType; learners: string[] }[]>;
  unmatched: string[];
};

export function buildPrepTeam(roster: Pokemon[], format?: string): PrepTeam {
  const members: PrepMember[] = roster.map((pokemon) => {
    const learnable = learnableMoves(pokemon, format);
    const types = pokemonTypesFor(pokemon);
    const moves: Record<string, string[]> = {};
    for (const cat of PREP_CATEGORIES) {
      moves[cat.key] = cat.moves.filter((mv) => learnable.has(mv.id)).map((mv) => mv.name);
    }
    const weakness = Object.fromEntries(pokemonTypes.map((t) => [t, multiplier(t, types)])) as Record<PokemonType, number>;
    return {
      pokemon,
      types,
      abilities: abilitiesOf(pokemon),
      matched: !!findSpecies(pokemon),
      moves,
      weakness,
    };
  });

  const categories: PrepTeam["categories"] = {};
  for (const cat of PREP_CATEGORIES) {
    categories[cat.key] = cat.moves
      .map((mv) => ({
        move: mv.name,
        type: mv.type,
        learners: members.filter((m) => m.moves[cat.key].includes(mv.name)).map((m) => m.pokemon.id),
      }))
      .filter((row) => row.learners.length > 0);
  }

  return {
    members,
    categories,
    unmatched: members.filter((m) => !m.matched).map((m) => m.pokemon.name),
  };
}
