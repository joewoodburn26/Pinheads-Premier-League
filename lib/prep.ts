// Matchup prep calculations (server-side). Data comes from lib/prep-data.json,
// built by scripts/build-prep-data.mjs from Pokémon Showdown.

import prepData from "@/lib/prep-data.json";
import { multiplier, pokemonTypes, pokemonTypesFor } from "@/lib/type-chart";
import type { Pokemon, PokemonType } from "@/lib/types";

type SpeciesEntry = { n: string; num: number; a: string[]; m: Record<string, number> };
type PrepData = {
  generatedAt: string;
  categories: { key: string; label: string; moves: { id: string; name: string }[] }[];
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

// Level 100, 31 IVs
export function speedAt(base: number, ev: 0 | 252, plusNature = false) {
  const stat = Math.floor(((2 * base + 31 + Math.floor(ev / 4)) * 100) / 100) + 5;
  return plusNature ? Math.floor(stat * 1.1) : stat;
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
  speed: { base: number; neutral0: number; max252: number; plus252: number };
};

export type TypeSummaryRow = {
  type: PokemonType;
  stab: number;
  immune: number;
  quarter: number;
  half: number;
  double: number;
  quad: number;
};

export type PrepTeam = {
  members: PrepMember[];
  summary: TypeSummaryRow[];
  /** category key → [{ move, learners }] for moves at least one member learns */
  categories: Record<string, { move: string; learners: string[] }[]>;
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
      speed: {
        base: pokemon.speed,
        neutral0: speedAt(pokemon.speed, 0),
        max252: speedAt(pokemon.speed, 252),
        plus252: speedAt(pokemon.speed, 252, true),
      },
    };
  });

  const summary: TypeSummaryRow[] = pokemonTypes.map((type) => {
    const row: TypeSummaryRow = { type, stab: 0, immune: 0, quarter: 0, half: 0, double: 0, quad: 0 };
    for (const m of members) {
      if (m.types.includes(type)) row.stab++;
      const x = m.weakness[type];
      if (x === 0) row.immune++;
      else if (x === 0.25) row.quarter++;
      else if (x === 0.5) row.half++;
      else if (x === 2) row.double++;
      else if (x === 4) row.quad++;
    }
    return row;
  });

  const categories: PrepTeam["categories"] = {};
  for (const cat of PREP_CATEGORIES) {
    categories[cat.key] = cat.moves
      .map((mv) => ({
        move: mv.name,
        learners: members.filter((m) => m.moves[cat.key].includes(mv.name)).map((m) => m.pokemon.id),
      }))
      .filter((row) => row.learners.length > 0);
  }

  return {
    members,
    summary,
    categories,
    unmatched: members.filter((m) => !m.matched).map((m) => m.pokemon.name),
  };
}
