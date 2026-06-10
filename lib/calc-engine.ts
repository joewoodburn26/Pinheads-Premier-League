// ─── Damage Calculation Engine (Gen 9) ───────────────────────────────────────
// Based on Showdown's damage calculator implementation

import type { PokemonType } from "@/lib/types";
import { multiplier } from "@/lib/type-chart";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MoveCategory = "physical" | "special" | "status";
export type Weather = "none" | "sun" | "rain" | "sand" | "snow" | "harshSun" | "heavyRain";
export type Terrain = "none" | "electric" | "grassy" | "misty" | "psychic";
export type Status = "none" | "burn" | "paralysis" | "poison" | "badPoison" | "sleep" | "freeze";

export interface Move {
  name: string;
  power: number;
  type: PokemonType;
  category: MoveCategory;
  priority: number;
  multihit?: [number, number]; // [min, max] hits
  alwaysCrit?: boolean;
  // Special move flags
  isSpread?: boolean;       // hits multiple targets
  makesContact?: boolean;
}

export interface CalcPokemon {
  name: string;
  types: PokemonType[];
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpA: number;
  baseSpD: number;
  baseSpe: number;
  // Calculated from inputs
  hp: number;
  atk: number;
  def: number;
  spA: number;
  spD: number;
  spe: number;
  // Modifiers
  atkStage: number;
  defStage: number;
  spAStage: number;
  spDStage: number;
  speStage: number;
  // Status & field
  status: Status;
  item: string;
  ability: string;
  // Side conditions
  reflect: boolean;
  lightScreen: boolean;
  auroraVeil: boolean;
  tailwind: boolean;
  helpingHand: boolean;
  isCrit: boolean;
}

export interface FieldConditions {
  weather: Weather;
  terrain: Terrain;
  isDoublesFormat: boolean;
}

export interface DamageResult {
  rolls: number[];       // all 16 damage rolls
  min: number;
  max: number;
  minPercent: number;
  maxPercent: number;
  defenderHp: number;
  koChance: string;
  twoHkoChance: string;
  typeMultiplier: number;
  isStab: boolean;
  description: string;
}

// ─── Stat calculation ─────────────────────────────────────────────────────────

export type NatureEffect = 1.1 | 1.0 | 0.9;

export function calcHp(base: number, iv: number, ev: number, level: number): number {
  if (base === 1) return 1; // Shedinja
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
}

export function calcStat(
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: NatureEffect
): number {
  return Math.floor(
    (Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5) * nature
  );
}

// ─── Stat stage multipliers ───────────────────────────────────────────────────

const STAGE_MULTS: Record<number, number> = {
  "-6": 2/8, "-5": 2/7, "-4": 2/6, "-3": 2/5, "-2": 2/4, "-1": 2/3,
  "0": 1,
  "1": 3/2, "2": 4/2, "3": 5/2, "4": 6/2, "5": 7/2, "6": 8/2,
};

export function applyStage(stat: number, stage: number): number {
  return Math.max(1, Math.floor(stat * STAGE_MULTS[stage]));
}

// ─── Ability damage modifiers ─────────────────────────────────────────────────

function getAttackerAbilityMod(
  ability: string,
  move: Move,
  attackerTypes: PokemonType[],
  defenderTypes: PokemonType[],
  weather: Weather,
  attackerStatus: Status,
  basePower: number
): number {
  const a = ability.toLowerCase();
  const mt = move.type;

  // Adaptability: STAB becomes 2x instead of 1.5x
  // (handled separately in STAB section, return 1 here)

  // Technician: moves with 60BP or less get 1.5x
  if (a === "technician" && basePower <= 60) return 1.5;

  // Huge Power / Pure Power: doubles attack (handled in stat calc)

  // Guts: 1.5x attack when statused (physical)
  if ((a === "guts") && attackerStatus !== "none" && move.category === "physical") return 1.5;

  // Hustle: 1.5x attack (physical)
  if (a === "hustle" && move.category === "physical") return 1.5;

  // Torrent: 1.5x water when HP ≤ 1/3 (approximate — we use full HP)
  // Flash Fire: 1.5x fire after being hit by fire
  // Blaze / Overgrow / Torrent / Swarm: handled elsewhere

  // Steelworker / Steely Spirit: 1.5x steel moves
  if ((a === "steelworker" || a === "steely spirit") && mt === "Steel") return 1.5;

  // Transistor: 1.5x electric
  if (a === "transistor" && mt === "Electric") return 1.5;

  // Dragon's Maw: 1.5x dragon
  if (a === "dragon's maw" && mt === "Dragon") return 1.5;

  // Aerilate / Pixilate / Refrigerate / Galvanize: type change + 1.2x
  if (
    (a === "aerilate" && mt === "Normal") ||
    (a === "pixilate" && mt === "Normal") ||
    (a === "refrigerate" && mt === "Normal") ||
    (a === "galvanize" && mt === "Normal")
  ) return 1.2;

  // Reckless: recoil moves 1.2x
  // Strong Jaw: biting moves 1.5x
  if (a === "strong jaw" && [
    "Bite","Crunch","Fire Fang","Ice Fang","Thunder Fang","Poison Fang",
    "Psychic Fangs","Hyper Fang","Fishious Rend","Jaw Lock","Snap Trap"
  ].includes(move.name)) return 1.5;

  // Tough Claws: contact moves 1.3x
  if (a === "tough claws" && move.makesContact) return 1.3;

  // Iron Fist: punching moves 1.2x
  if (a === "iron fist" && [
    "Bullet Punch","Comet Punch","Dizzy Punch","Drain Punch","Dynamic Punch",
    "Fire Punch","Focus Punch","Hammer Arm","Ice Punch","Mach Punch",
    "Mega Punch","Meteor Mash","Power-Up Punch","Shadow Punch",
    "Sky Uppercut","Thunder Punch","Ice Hammer","Surging Strikes"
  ].includes(move.name)) return 1.2;

  // Punk Rock: sound moves 1.3x
  if (a === "punk rock" && [
    "Boomburst","Bug Buzz","Chatter","Clanging Scales","Clangorous Soul",
    "Disarming Voice","Echoed Voice","Hyper Voice","Metal Sound",
    "Noble Roar","Parting Shot","Overdrive","Relic Song","Round",
    "Sing","Snarl","Sparkling Aria","Supersonic","Uproar"
  ].includes(move.name)) return 1.3;

  // Sand Force: rock/ground/steel 1.3x in sand
  if (a === "sand force" && weather === "sand" && ["Rock","Ground","Steel"].includes(mt)) return 1.3;

  // Sheer Force: moves with secondary effects (approximated)

  // Water Bubble: water moves 2x
  if (a === "water bubble" && mt === "Water") return 2;

  // Neuroforce: super effective 1.25x
  if (a === "neuroforce") {
    const mult = multiplier(mt, defenderTypes);
    if (mult > 1) return 1.25;
  }

  // Sniper: crits do 2.25x (we handle crits separately)

  return 1;
}

function getDefenderAbilityMod(
  ability: string,
  move: Move,
): number {
  const a = ability.toLowerCase();
  const mt = move.type;

  // Thick Fat: halves fire and ice
  if (a === "thick fat" && (mt === "Fire" || mt === "Ice")) return 0.5;

  // Water Absorb / Dry Skin: immune to water
  if ((a === "water absorb" || a === "dry skin") && mt === "Water") return 0;

  // Flash Fire: immune to fire (after activation)

  // Levitate: immune to ground
  if (a === "levitate" && mt === "Ground") return 0;

  // Volt Absorb: immune to electric
  if (a === "volt absorb" && mt === "Electric") return 0;

  // Motor Drive: immune to electric
  if (a === "motor drive" && mt === "Electric") return 0;

  // Lightning Rod: immune to electric
  if (a === "lightning rod" && mt === "Electric") return 0;

  // Storm Drain: immune to water
  if (a === "storm drain" && mt === "Water") return 0;

  // Sap Sipper: immune to grass
  if (a === "sap sipper" && mt === "Grass") return 0;

  // Wonder Guard: only super effective moves hit
  if (a === "wonder guard") return 0; // handled in type calc

  // Fluffy: halves contact moves, doubles fire
  if (a === "fluffy") {
    if (move.makesContact) return 0.5;
    if (mt === "Fire") return 2;
  }

  // Heatproof: halves fire
  if (a === "heatproof" && mt === "Fire") return 0.5;

  // Multiscale / Shadow Shield: halves damage at full HP
  // (approximate — we assume full HP)
  if ((a === "multiscale" || a === "shadow shield")) return 0.5;

  // Filter / Solid Rock / Prism Armor: super effective moves deal 0.75x
  if (a === "filter" || a === "solid rock" || a === "prism armor") return 1; // handled in type mod

  return 1;
}

// ─── Item modifiers ───────────────────────────────────────────────────────────

function getAttackerItemMod(item: string, move: Move): number {
  const i = item.toLowerCase();
  const mt = move.type;
  const cat = move.category;

  if (i === "choice band" && cat === "physical") return 1.5;
  if (i === "choice specs" && cat === "special") return 1.5;
  if (i === "life orb") return 1.3;
  if (i === "muscle band" && cat === "physical") return 1.1;
  if (i === "wise glasses" && cat === "special") return 1.1;

  // Type-enhancing items
  const typeItems: Record<string, PokemonType> = {
    "charcoal": "Fire", "mystic water": "Water", "miracle seed": "Grass",
    "magnet": "Electric", "nevermeltice": "Ice", "black belt": "Fighting",
    "poison barb": "Poison", "soft sand": "Ground", "sharp beak": "Flying",
    "twisted spoon": "Psychic", "silver powder": "Bug", "hard stone": "Rock",
    "spell tag": "Ghost", "dragon fang": "Dragon", "black glasses": "Dark",
    "metal coat": "Steel", "fairy feather": "Fairy",
  };
  if (typeItems[i] === mt) return 1.2;

  // Plates
  const plates: Record<string, PokemonType> = {
    "flame plate": "Fire", "splash plate": "Water", "meadow plate": "Grass",
    "zap plate": "Electric", "icicle plate": "Ice", "fist plate": "Fighting",
    "toxic plate": "Poison", "earth plate": "Ground", "sky plate": "Flying",
    "mind plate": "Psychic", "insect plate": "Bug", "stone plate": "Rock",
    "spooky plate": "Ghost", "draco plate": "Dragon", "dread plate": "Dark",
    "iron plate": "Steel", "pixie plate": "Fairy",
  };
  if (plates[i] === mt) return 1.2;

  // Expert Belt: super effective 1.2x (handled elsewhere)
  // Punching Glove: punching moves 1.1x, no contact
  if (i === "punching glove" && [
    "Bullet Punch","Drain Punch","Dynamic Punch","Fire Punch",
    "Focus Punch","Ice Punch","Mach Punch","Mega Punch",
    "Meteor Mash","Power-Up Punch","Thunder Punch"
  ].includes(move.name)) return 1.1;

  return 1;
}

// ─── Main damage calculator ───────────────────────────────────────────────────

export function calculateDamage(
  attacker: CalcPokemon,
  defender: CalcPokemon,
  move: Move,
  field: FieldConditions,
  level: number = 100
): DamageResult {
  if (move.category === "status" || move.power === 0) {
    return {
      rolls: [0], min: 0, max: 0,
      minPercent: 0, maxPercent: 0,
      defenderHp: defender.hp,
      koChance: "—", twoHkoChance: "—",
      typeMultiplier: 0,
      isStab: false,
      description: "Status move — no damage"
    };
  }

  const isPhysical = move.category === "physical";
  const mt = move.type;

  // ── Type effectiveness ────────────────────────────────────────────────────
  let typeMult = multiplier(mt, defender.types);

  // Wonder Guard — only super effective moves land
  if (defender.ability.toLowerCase() === "wonder guard" && typeMult <= 1) {
    return {
      rolls: [0], min: 0, max: 0, minPercent: 0, maxPercent: 0,
      defenderHp: defender.hp,
      koChance: "0%", twoHkoChance: "0%",
      typeMultiplier: 0, isStab: false,
      description: "Blocked by Wonder Guard"
    };
  }

  // Filter / Solid Rock / Prism Armor
  if (
    typeMult > 1 &&
    ["filter","solid rock","prism armor"].includes(defender.ability.toLowerCase())
  ) typeMult *= 0.75;

  // Defender immunity via ability
  const defAbilMod = getDefenderAbilityMod(defender.ability, move, field.weather);
  if (defAbilMod === 0) {
    return {
      rolls: [0], min: 0, max: 0, minPercent: 0, maxPercent: 0,
      defenderHp: defender.hp,
      koChance: "0%", twoHkoChance: "0%",
      typeMultiplier: 0, isStab: false,
      description: `Blocked by ${defender.ability}`
    };
  }

  // ── STAB ──────────────────────────────────────────────────────────────────
  const isStab = attacker.types.includes(mt);
  const adaptability = attacker.ability.toLowerCase() === "adaptability";
  const stabMult = isStab ? (adaptability ? 2 : 1.5) : 1;

  // ── Attacker stats ────────────────────────────────────────────────────────
  let rawAtk = isPhysical ? attacker.atk : attacker.spA;
  const rawDef = isPhysical ? defender.def : defender.spD;

  // Huge Power / Pure Power doubles attack
  if (
    isPhysical &&
    ["huge power","pure power"].includes(attacker.ability.toLowerCase())
  ) rawAtk *= 2;

  // Guts ignores burn penalty but burn penalty applied below
  const gutsActive =
    attacker.ability.toLowerCase() === "guts" &&
    attacker.status !== "none";

  // Apply stat stages (crits ignore negative atk / positive def stages)
  const isCrit = attacker.isCrit;
  const atkStage = isCrit ? Math.max(0, attacker.atkStage) : attacker.atkStage;
  const defStage = isCrit ? Math.min(0, defender.defStage) : defender.defStage;
  const effAtk = applyStage(rawAtk, isPhysical ? atkStage : attacker.spAStage);
  const effDef = applyStage(rawDef, isPhysical ? defStage  : defender.spDStage);

  // ── Base power modifiers ──────────────────────────────────────────────────
  let bp = move.power;

  // Facade: 140 BP when statused
  if (move.name === "Facade" && attacker.status !== "none") bp = 140;

  // Assurance doubles if defender already took damage this turn (approximate)
  // Knock Off 1.5x if defender has item
  if (move.name === "Knock Off" && defender.item !== "None" && defender.item !== "") bp = Math.floor(bp * 1.5);

  // Low Kick / Grass Knot (weight-based — approximate at 90 BP)
  // Gyro Ball (speed-based)
  if (move.name === "Gyro Ball") {
    const atkSpe = applyStage(attacker.spe, attacker.speStage) * (attacker.status === "paralysis" ? 0.5 : 1) * (attacker.tailwind ? 2 : 1);
    const defSpe = applyStage(defender.spe, defender.speStage) * (defender.status === "paralysis" ? 0.5 : 1) * (defender.tailwind ? 2 : 1);
    bp = Math.min(150, Math.floor(25 * defSpe / Math.max(1, atkSpe)));
  }

  // Attacker ability BP modifier
  const atkAbilMod = getAttackerAbilityMod(
    attacker.ability, move, attacker.types, defender.types,
    field.weather, attacker.status, bp
  );
  bp = Math.floor(bp * atkAbilMod);

  // Attacker item modifier
  const atkItemMod = getAttackerItemMod(attacker.item, move);

  // Expert Belt: 1.2x on super effective
  const expertBelt =
    attacker.item.toLowerCase() === "expert belt" && typeMult > 1 ? 1.2 : 1;

  // ── Weather ───────────────────────────────────────────────────────────────
  let weatherMult = 1;
  if (field.weather === "sun" || field.weather === "harshSun") {
    if (mt === "Fire") weatherMult = field.weather === "harshSun" ? 1.5 : 1.5;
    if (mt === "Water") weatherMult = field.weather === "harshSun" ? 0 : 0.5;
  }
  if (field.weather === "rain" || field.weather === "heavyRain") {
    if (mt === "Water") weatherMult = field.weather === "heavyRain" ? 1.5 : 1.5;
    if (mt === "Fire") weatherMult = field.weather === "heavyRain" ? 0 : 0.5;
  }
  if (field.weather === "sand" && mt === "Rock" && !isPhysical) weatherMult = 1; // SpD boost handled elsewhere

  // ── Terrain ───────────────────────────────────────────────────────────────
  let terrainMult = 1;
  // Grounded check (approximate — treat all as grounded unless Flying/Levitate)
  const attackerGrounded = !attacker.types.includes("Flying") &&
    attacker.ability.toLowerCase() !== "levitate";
  const defenderGrounded = !defender.types.includes("Flying") &&
    defender.ability.toLowerCase() !== "levitate";

  if (field.terrain === "electric" && mt === "Electric" && attackerGrounded) terrainMult = 1.3;
  if (field.terrain === "grassy" && mt === "Grass" && attackerGrounded) terrainMult = 1.3;
  if (field.terrain === "psychic" && mt === "Psychic" && attackerGrounded) terrainMult = 1.3;
  if (field.terrain === "misty" && mt === "Dragon" && defenderGrounded) terrainMult = 0.5;

  // Grassy Terrain: halves Earthquake/Bulldoze/Magnitude
  if (field.terrain === "grassy" && ["Earthquake","Bulldoze","Magnitude"].includes(move.name)) terrainMult = 0.5;

  // ── Screens ───────────────────────────────────────────────────────────────
  let screenMult = 1;
  if (!isCrit) {
    if (isPhysical && (defender.reflect || defender.auroraVeil)) screenMult = 0.5;
    if (!isPhysical && (defender.lightScreen || defender.auroraVeil)) screenMult = 0.5;
    // Doubles: screens are 0.66x
    if (field.isDoublesFormat && screenMult === 0.5) screenMult = 2/3;
  }

  // ── Burn ──────────────────────────────────────────────────────────────────
  const burnMult =
    isPhysical && attacker.status === "burn" && !gutsActive ? 0.5 : 1;

  // ── Helping Hand ─────────────────────────────────────────────────────────
  const helpingHandMult = attacker.helpingHand ? 1.5 : 1;

  // ── Doubles spread move ───────────────────────────────────────────────────
  const spreadMult = field.isDoublesFormat && move.isSpread ? 0.75 : 1;

  // ── Critical hit ─────────────────────────────────────────────────────────
  const critMult = isCrit ? (
    attacker.ability.toLowerCase() === "sniper" ? 2.25 : 1.5
  ) : 1;

  // ── Base damage ───────────────────────────────────────────────────────────
  const baseDmg = Math.floor(
    Math.floor(
      (Math.floor(2 * level / 5 + 2) * bp * effAtk) / effDef
    ) / 50
  ) + 2;

  // ── Apply all multipliers ─────────────────────────────────────────────────
  // Order matches Showdown: spread → weather → crit → atk item →
  //   burn → screen → terrain → stab → type → defender ability item
  let damage = baseDmg;
  damage = Math.floor(damage * spreadMult);
  damage = Math.floor(damage * weatherMult);
  damage = Math.floor(damage * critMult);
  damage = Math.floor(damage * atkItemMod);
  damage = Math.floor(damage * expertBelt);
  damage = Math.floor(damage * burnMult);
  damage = Math.floor(damage * screenMult);
  damage = Math.floor(damage * helpingHandMult);
  damage = Math.floor(damage * terrainMult);
  damage = Math.floor(damage * stabMult);
  damage = Math.floor(damage * typeMult);
  damage = Math.floor(damage * defAbilMod);

  // ── Random rolls (85%–100%, 16 values) ────────────────────────────────────
  const rolls: number[] = [];
  for (let i = 85; i <= 100; i++) {
    rolls.push(Math.floor(damage * i / 100));
  }

  const min = rolls[0];
  const max = rolls[15];
  const hp  = defender.hp;

  const minPct = Math.floor(min / hp * 1000) / 10;
  const maxPct = Math.floor(max / hp * 1000) / 10;

  // ── KO chance ────────────────────────────────────────────────────────────
  const ohkoRolls = rolls.filter(r => r >= hp).length;
  const twoHkoRolls = rolls.filter(r => r * 2 >= hp).length;

  const koChance = ohkoRolls === 16 ? "Guaranteed OHKO" :
    ohkoRolls > 0 ? `${(ohkoRolls / 16 * 100).toFixed(1)}% OHKO` : "No OHKO";

  const twoHkoChance = twoHkoRolls === 16 ? "Guaranteed 2HKO" :
    twoHkoRolls > 0 ? `${(twoHkoRolls / 16 * 100).toFixed(1)}% 2HKO` : "No 2HKO";

  // ── Description ───────────────────────────────────────────────────────────
  const parts = [];
  if (isStab) parts.push("STAB");
  if (isCrit) parts.push("Crit");
  if (typeMult > 1) parts.push(typeMult >= 4 ? "4× effective" : "2× effective");
  if (typeMult < 1 && typeMult > 0) parts.push(typeMult <= 0.25 ? "¼× effective" : "½× effective");
  if (typeMult === 0) parts.push("No effect");
  if (field.weather !== "none") parts.push(field.weather);
  if (field.terrain !== "none") parts.push(`${field.terrain} terrain`);
  if (burnMult < 1) parts.push("burned");
  if (screenMult < 1) parts.push("screen");

  const description = `${attacker.name} ${move.name} → ${defender.name}: ${minPct}–${maxPct}% (${min}–${max}/${hp} HP)${parts.length ? " [" + parts.join(", ") + "]" : ""}`;

  return {
    rolls, min, max, minPercent: minPct, maxPercent: maxPct,
    defenderHp: hp, koChance, twoHkoChance,
    typeMultiplier: typeMult, isStab,
    description
  };
}

// ─── Speed comparison ─────────────────────────────────────────────────────────

export function getEffectiveSpeed(p: CalcPokemon): number {
  let spe = applyStage(p.spe, p.speStage);
  if (p.status === "paralysis") spe = Math.floor(spe * 0.5);
  if (p.tailwind) spe *= 2;
  // Choice Scarf
  if (p.item.toLowerCase() === "choice scarf") spe = Math.floor(spe * 1.5);
  // Iron Ball / Lagging Tail
  if (["iron ball","lagging tail"].includes(p.item.toLowerCase())) spe = Math.floor(spe * 0.5);
  return spe;
}
