// Matchup prep calculations (server-side). Data comes from lib/prep-data.json,
// built by scripts/build-prep-data.mjs from Pokémon Showdown.

import prepData from "@/lib/prep-data.json";
import { multiplier, pokemonTypes, pokemonTypesFor } from "@/lib/type-chart";
import type { Pokemon, PokemonType } from "@/lib/types";

type SpeciesEntry = { n: string; num: number; a: string[]; m: Record<string, number> };
type PrepData = {
  generatedAt: string;
  categories: { key: string; label: string; moves: { id: string; name: string; type: PokemonType }[] }[];
  species: Record<string, SpeciesEntry>;
};

const DATA = prepData as unknown as PrepData;
export const PREP_CATEGORIES = DATA.categories;

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Base species per dex number (fallback when a name doesn't match)
const baseByNum = new Map<number, string>();
for (const [id, s] of Object.entries(DATA.species)) {
  const current = baseByNum.get(s.num);
  if (!s.n.includes("-") && (!current || id.length < current.length)) baseByNum.set(s.num, id);
}

const REGIONS: [RegExp, string][] = [
  [/\balolan\b/i, "alola"],
  [/\bgalarian\b/i, "galar"],
  [/\bhisuian\b/i, "hisui"],
  [/\bpaldean\b/i, "paldea"],
];

/** Find the Showdown species for one of our Pokémon. */
export function findSpecies(p: Pick<Pokemon, "name" | "dexNumber">): SpeciesEntry | undefined {
  const direct = DATA.species[toId(p.name)];
  if (direct) return direct;

  for (const [re, suffix] of REGIONS) {
    if (re.test(p.name)) {
      const hit = DATA.species[toId(p.name.replace(re, "").replace(/\bform\b/i, "")) + suffix];
      if (hit) return hit;
    }
  }

  // "Mega Charizard X" → charizardmegax
  const mega = /^mega\s+(.+?)(?:\s+([xy]))?$/i.exec(p.name.trim());
  if (mega) {
    const hit = DATA.species[toId(mega[1]) + "mega" + (mega[2] ? mega[2].toLowerCase() : "")];
    if (hit) return hit;
  }

  const base = baseByNum.get(p.dexNumber);
  return base ? DATA.species[base] : undefined;
}

/** Newest generation whose moves count: gen1–gen8 formats cap it, everything else is the latest games. */
export function formatGen(format?: string): number {
  const m = /^gen(\d)$/.exec(format ?? "");
  return m ? Number(m[1]) : 99;
}

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
  const maxGen = formatGen(format);

  const members: PrepMember[] = roster.map((pokemon) => {
    const species = findSpecies(pokemon);
    const types = pokemonTypesFor(pokemon);
    const moves: Record<string, string[]> = {};
    for (const cat of PREP_CATEGORIES) {
      moves[cat.key] = cat.moves
        .filter((mv) => {
          const gen = species?.m[mv.id];
          return gen !== undefined && gen <= maxGen;
        })
        .map((mv) => mv.name);
    }
    const weakness = Object.fromEntries(pokemonTypes.map((t) => [t, multiplier(t, types)])) as Record<PokemonType, number>;
    return {
      pokemon,
      types,
      abilities: species?.a ?? [],
      matched: !!species,
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
