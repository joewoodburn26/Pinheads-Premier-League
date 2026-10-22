// Server-side access to lib/prep-data.json (abilities, learnsets, Champions
// availability). Built by scripts/build-prep-data.mjs from Pokémon Showdown.
// Import only from server code — the data file is ~1 MB.

import dexData from "@/lib/prep-data.json";
import type { Pokemon, PokemonType } from "@/lib/types";

type SpeciesEntry = {
  n: string;
  num: number;
  /** Generation it was introduced */
  g: number;
  a: string[];
  /** National Dex learnset: "moveIndex.gen,…" */
  l: string;
  /** In Pokémon Champions */
  ch?: 1;
  /** Champions learnset: "moveIndex,…" */
  c?: string;
};

type DexData = {
  generatedAt: string;
  categories: { key: string; label: string; moves: { id: string; name: string; type: PokemonType }[] }[];
  moves: [string, string, PokemonType][];
  species: Record<string, SpeciesEntry>;
};

const DATA = dexData as unknown as DexData;

export const MOVE_CATEGORIES = DATA.categories;

export type MoveOption = { id: string; name: string; type: PokemonType };

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// ── Format rules ──────────────────────────────────────────────────────────────

export type FormatMode = { kind: "champions" } | { kind: "natdex"; maxGen: number };

/** Season format → which movepools count. */
export function formatMode(format?: string): FormatMode {
  if (format === "champs") return { kind: "champions" };
  const gen = /^gen(\d)$/.exec(format ?? "");
  return { kind: "natdex", maxGen: gen ? Number(gen[1]) : 99 };
}

export function formatLabel(format?: string): string {
  if (format === "champs") return "Pokémon Champions";
  const gen = /^gen(\d)$/.exec(format ?? "");
  return gen ? `Gen ${gen[1]} National Dex` : "All Pokémon · latest learnsets";
}

// ── Matching our Pokémon to Showdown species ─────────────────────────────────

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

function findSpeciesId(p: Pick<Pokemon, "name" | "dexNumber">): string | undefined {
  const direct = toId(p.name);
  if (DATA.species[direct]) return direct;

  for (const [re, suffix] of REGIONS) {
    if (re.test(p.name)) {
      const id = toId(p.name.replace(re, "").replace(/\bform\b/i, "")) + suffix;
      if (DATA.species[id]) return id;
    }
  }

  // "Mega Charizard X" → charizardmegax
  const mega = /^mega\s+(.+?)(?:\s+([xy]))?$/i.exec(p.name.trim());
  if (mega) {
    const id = toId(mega[1]) + "mega" + (mega[2] ? mega[2].toLowerCase() : "");
    if (DATA.species[id]) return id;
  }

  return baseByNum.get(p.dexNumber);
}

export function findSpecies(p: Pick<Pokemon, "name" | "dexNumber">): SpeciesEntry | undefined {
  const id = findSpeciesId(p);
  return id ? DATA.species[id] : undefined;
}

// ── Learnsets (parsed lazily, cached per species + format) ────────────────────

const learnsetCache = new Map<string, Set<string>>();

function learnsetOf(species: SpeciesEntry, mode: FormatMode): Set<string> {
  const key = `${species.n}|${mode.kind === "champions" ? "c" : mode.maxGen}`;
  const hit = learnsetCache.get(key);
  if (hit) return hit;

  const set = new Set<string>();
  if (mode.kind === "champions") {
    for (const i of (species.c ?? "").split(",")) if (i) set.add(DATA.moves[Number(i)][0]);
  } else {
    for (const pair of species.l.split(",")) {
      if (!pair) continue;
      const [i, gen] = pair.split(".");
      if (Number(gen) <= mode.maxGen) set.add(DATA.moves[Number(i)][0]);
    }
  }
  learnsetCache.set(key, set);
  return set;
}

/** Move ids this Pokémon can learn in the season's format (empty if unmatched). */
export function learnableMoves(p: Pick<Pokemon, "name" | "dexNumber">, format?: string): Set<string> {
  const species = findSpecies(p);
  return species ? learnsetOf(species, formatMode(format)) : new Set();
}

export function abilitiesOf(p: Pick<Pokemon, "name" | "dexNumber">): string[] {
  return findSpecies(p)?.a ?? [];
}

/** Every move anyone can learn in this format, for the search suggestions. */
export function moveOptions(format?: string): MoveOption[] {
  const mode = formatMode(format);
  const seen = new Set<string>();
  for (const s of Object.values(DATA.species)) {
    if (mode.kind === "champions" && !s.ch) continue;
    for (const id of learnsetOf(s, mode)) seen.add(id);
  }
  return DATA.moves
    .filter(([id]) => seen.has(id))
    .map(([id, name, type]) => ({ id, name, type }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── Availability ─────────────────────────────────────────────────────────────

const GEN_LAST_DEX = [151, 251, 386, 493, 649, 721, 809, 905];

/**
 * Which Pokémon are options in a season:
 *  - Champions: only Pokémon that are in Champions
 *  - Gen 1–8: only Pokémon (and formes) that existed by that generation
 *  - All / Gen 9: everything
 */
export function isAvailable(p: Pick<Pokemon, "name" | "dexNumber">, format?: string): boolean {
  const mode = formatMode(format);
  const species = findSpecies(p);
  if (mode.kind === "champions") return !!species?.ch;
  if (mode.maxGen >= 9) return true;
  if (species) return species.g <= mode.maxGen;
  return p.dexNumber <= (GEN_LAST_DEX[mode.maxGen - 1] ?? Infinity);
}

export function filterAvailable<T extends Pick<Pokemon, "name" | "dexNumber">>(list: T[], format?: string): T[] {
  const mode = formatMode(format);
  if (mode.kind === "natdex" && mode.maxGen >= 9) return list;
  return list.filter((p) => isAvailable(p, format));
}
