// Glue between the calculator UI and Smogon's damage calc (@smogon/calc),
// the same engine the Pokémon Showdown calculator runs.

import { Field, Generations, Move, Pokemon, Side, calculate, toID } from "@smogon/calc";
import type { Generation } from "@smogon/calc/dist/data/interface";
import { STAT_KEYS, maxIvs, zeroStats, type CalcSet, type StatKey, type Stats } from "@/lib/showdown-text";

export type Gen = Generation;
export const getGen = (n: number) => Generations.get(n as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9);

// ── Per-side state ───────────────────────────────────────────────────────────

export type StatusId = "" | "brn" | "par" | "psn" | "tox" | "slp" | "frz";

export type SideState = {
  /** Our Pokédex id, when picked from the list */
  pokemonId?: string;
  set: CalcSet;
  /** Which entry in the set dropdown is loaded */
  setLabel: string;
  boosts: Stats;
  status: StatusId;
  toxicCounter: number;
  hpPercent: number;
  tera: boolean;
  dynamax: boolean;
  abilityOn: boolean;
  alliesFainted: number;
  crits: boolean[];
  hits: (number | undefined)[];
  useZ: boolean[];
};

export function blankSide(species: string, level: number, pokemonId?: string): SideState {
  return {
    pokemonId,
    set: { species, item: "", ability: "", level, nature: "Serious", evs: zeroStats(), ivs: maxIvs(), moves: [] },
    setLabel: "",
    boosts: zeroStats(),
    status: "",
    toxicCounter: 1,
    hpPercent: 100,
    tera: false,
    dynamax: false,
    abilityOn: false,
    alliesFainted: 0,
    crits: [false, false, false, false],
    hits: [undefined, undefined, undefined, undefined],
    useZ: [false, false, false, false],
  };
}

/** Load a set into a side, resetting the battle state (boosts, HP, status…). */
export function withSet(side: SideState, set: CalcSet, label: string): SideState {
  const fresh = blankSide(set.species, set.level, side.pokemonId);
  return { ...fresh, set: { ...set, moves: [...set.moves] }, setLabel: label };
}

// ── Field state ──────────────────────────────────────────────────────────────

export type SideField = {
  isSR: boolean;
  spikes: number;
  isReflect: boolean;
  isLightScreen: boolean;
  isAuroraVeil: boolean;
  isProtected: boolean;
  isSeeded: boolean;
  isSaltCured: boolean;
  isForesight: boolean;
  isTailwind: boolean;
  isHelpingHand: boolean;
  isFriendGuard: boolean;
  isBattery: boolean;
  isPowerSpot: boolean;
  isSteelySpirit: boolean;
  isFlowerGift: boolean;
  isCharge: boolean;
  isSwitching: boolean;
};

export type FieldState = {
  gameType: "Singles" | "Doubles";
  weather: string;
  terrain: string;
  isGravity: boolean;
  isMagicRoom: boolean;
  isWonderRoom: boolean;
  isBeadsOfRuin: boolean;
  isSwordOfRuin: boolean;
  isTabletsOfRuin: boolean;
  isVesselOfRuin: boolean;
  isFairyAura: boolean;
  isDarkAura: boolean;
  isAuraBreak: boolean;
  sides: [SideField, SideField];
};

export const blankSideField = (): SideField => ({
  isSR: false, spikes: 0, isReflect: false, isLightScreen: false, isAuroraVeil: false, isProtected: false,
  isSeeded: false, isSaltCured: false, isForesight: false, isTailwind: false, isHelpingHand: false,
  isFriendGuard: false, isBattery: false, isPowerSpot: false, isSteelySpirit: false, isFlowerGift: false,
  isCharge: false, isSwitching: false,
});

export const blankField = (doubles: boolean): FieldState => ({
  gameType: doubles ? "Doubles" : "Singles",
  weather: "",
  terrain: "",
  isGravity: false, isMagicRoom: false, isWonderRoom: false,
  isBeadsOfRuin: false, isSwordOfRuin: false, isTabletsOfRuin: false, isVesselOfRuin: false,
  isFairyAura: false, isDarkAura: false, isAuraBreak: false,
  sides: [blankSideField(), blankSideField()],
});

// ── Species / names ──────────────────────────────────────────────────────────

/** The calc's name for a species (handles Showdown's base formes like Aegislash-Shield). */
export function calcSpeciesName(gen: Gen, name: string): string | undefined {
  for (const n of [name, `${name}-Shield`, name.replace(/-.*$/, "")]) {
    const s = gen.species.get(toID(n));
    if (s) return s.name;
  }
  return undefined;
}

/** Abilities a Pokémon has a chance of activating, shown with an "active" checkbox. */
export const TOGGLE_ABILITIES = new Set([
  "Flash Fire", "Plus", "Minus", "Slow Start", "Unburden", "Stakeout", "Intimidate",
  "Protosynthesis", "Quark Drive", "Teraform Zero", "Electromorphosis", "Wind Power",
]);

export const STATUS_OPTIONS: [StatusId, string][] = [
  ["", "Healthy"], ["brn", "Burned"], ["par", "Paralyzed"], ["psn", "Poisoned"],
  ["tox", "Badly Poisoned"], ["slp", "Asleep"], ["frz", "Frozen"],
];

// ── Building calc objects ────────────────────────────────────────────────────

function cleanStats(s: Stats, max: number): Stats {
  const out = zeroStats();
  for (const k of STAT_KEYS) out[k] = Math.max(0, Math.min(max, Math.round(Number(s[k]) || 0)));
  return out;
}

export function buildPokemon(gen: Gen, side: SideState): Pokemon | null {
  const name = calcSpeciesName(gen, side.set.species);
  if (!name) return null;
  const champions = gen.num === 0;
  try {
    const opts = {
      level: champions ? 50 : Math.max(1, Math.min(100, side.set.level || 100)),
      ability: side.set.ability || undefined,
      abilityOn: side.abilityOn,
      item: side.set.item || undefined,
      nature: side.set.nature || "Serious",
      evs: cleanStats(side.set.evs, champions ? 32 : 252),
      ivs: champions ? maxIvs() : cleanStats(side.set.ivs, 31),
      boosts: (() => { const b = zeroStats(); for (const k of STAT_KEYS) b[k] = Math.max(-6, Math.min(6, side.boosts[k] || 0)); return b; })(),
      status: side.status || undefined,
      toxicCounter: side.toxicCounter,
      teraType: gen.num === 9 && side.tera && side.set.teraType ? side.set.teraType : undefined,
      isDynamaxed: gen.num === 8 && side.dynamax,
      alliesFainted: side.alliesFainted,
      boostedStat: side.abilityOn && /Protosynthesis|Quark Drive/.test(side.set.ability) ? ("auto" as const) : undefined,
      moves: side.set.moves.filter(Boolean),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mon = new Pokemon(gen, name, opts as any);
    const maxHP = mon.maxHP();
    mon.originalCurHP = Math.max(1, Math.min(maxHP, Math.floor((maxHP * side.hpPercent) / 100)));
    return mon;
  } catch {
    return null;
  }
}

export function buildField(f: FieldState, attackerIdx: 0 | 1): Field {
  const side = (s: SideField) =>
    new Side({
      ...s,
      isSwitching: s.isSwitching ? "out" : undefined,
    });
  return new Field({
    gameType: f.gameType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    weather: (f.weather || undefined) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    terrain: (f.terrain || undefined) as any,
    isGravity: f.isGravity, isMagicRoom: f.isMagicRoom, isWonderRoom: f.isWonderRoom,
    isBeadsOfRuin: f.isBeadsOfRuin, isSwordOfRuin: f.isSwordOfRuin,
    isTabletsOfRuin: f.isTabletsOfRuin, isVesselOfRuin: f.isVesselOfRuin,
    isFairyAura: f.isFairyAura, isDarkAura: f.isDarkAura, isAuraBreak: f.isAuraBreak,
    attackerSide: side(f.sides[attackerIdx]),
    defenderSide: side(f.sides[attackerIdx === 0 ? 1 : 0]),
  });
}

export type MoveResult = {
  move: string;
  /** % of the defender's max HP */
  minPct: number;
  maxPct: number;
  /** Showdown's full result line */
  desc: string;
  damage: number[];
  ko: string;
  status: boolean;
};

export function runCalcs(gen: Gen, sides: [SideState, SideState], field: FieldState, attackerIdx: 0 | 1): MoveResult[] {
  const att = sides[attackerIdx];
  const def = sides[attackerIdx === 0 ? 1 : 0];
  const attacker = buildPokemon(gen, att);
  const defender = buildPokemon(gen, def);
  if (!attacker || !defender) return [];

  return att.set.moves.map((name, i) => {
    const blank: MoveResult = { move: name, minPct: 0, maxPct: 0, desc: "", damage: [], ko: "", status: true };
    if (!name || !gen.moves.get(toID(name))) return { ...blank, desc: name ? `${name} isn't in this generation's calc.` : "" };
    try {
      const move = new Move(gen, name, {
        isCrit: att.crits[i],
        hits: att.hits[i],
        useZ: gen.num === 7 && att.useZ[i],
        useMax: gen.num === 8 && att.dynamax,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const result = calculate(gen, attacker, defender, move, buildField(field, attackerIdx));
      const raw = result.damage;
      const damage = (Array.isArray(raw) ? raw.flat(2) : [raw]).map(Number);
      const [lo, hi] = result.range();
      const maxHP = result.defender.maxHP();
      let desc = "";
      let ko = "";
      if (move.category === "Status") {
        desc = `${name} is a status move.`;
      } else if (hi === 0) {
        desc = `${result.attacker.name} ${name} vs. ${result.defender.name}: 0-0 (0 - 0%)`;
      } else {
        try { desc = result.fullDesc(); } catch { desc = `${name}: ${lo}-${hi}`; }
        try { ko = result.kochance().text; } catch { ko = ""; }
      }
      return {
        move: name,
        minPct: Math.round((lo / maxHP) * 1000) / 10,
        maxPct: Math.round((hi / maxHP) * 1000) / 10,
        desc,
        damage,
        ko,
        status: move.category === "Status",
      };
    } catch {
      return { ...blank, desc: `Couldn't calculate ${name}.` };
    }
  });
}

// ── Starting set ─────────────────────────────────────────────────────────────

/** Basic starting set: neutral nature, 31 IVs, no EVs, no item, no moves. */
export function basicSet(species: string, abilities: string[], level: number): CalcSet {
  return {
    species,
    item: "",
    ability: abilities[0] ?? "",
    level,
    nature: "Serious",
    evs: zeroStats(),
    ivs: maxIvs(),
    moves: [],
  };
}

export function statsOf(gen: Gen, side: SideState): { base: Stats; raw: Stats; boosted: Stats } | null {
  const mon = buildPokemon(gen, side);
  if (!mon) return null;
  const base = { ...zeroStats(), ...mon.species.baseStats } as Stats;
  const raw = { ...zeroStats(), ...mon.rawStats } as Stats;
  const boosted = { ...raw };
  for (const k of STAT_KEYS) {
    if (k === "hp") continue;
    const b = side.boosts[k as StatKey] || 0;
    const mult = b >= 0 ? (2 + b) / 2 : 2 / (2 - b);
    boosted[k] = Math.floor(raw[k] * mult);
  }
  return { base, raw, boosted };
}
