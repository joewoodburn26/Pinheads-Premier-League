// ─── Damage Calculation Engine (Gen 9) ───────────────────────────────────────

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
  isSpread?: boolean;
  makesContact?: boolean;
}

export interface CalcPokemon {
  name: string;
  types: PokemonType[];
  baseHp: number;
  baseAtk: number; baseDef: number;
  baseSpA: number; baseSpD: number; baseSpe: number;
  hp: number;     // max HP
  currentHp: number; // current HP (for Multiscale, Blaze etc.)
  atk: number; def: number; spA: number; spD: number; spe: number;
  atkStage: number; defStage: number;
  spAStage: number; spDStage: number; speStage: number;
  status: Status;
  item: string;
  ability: string;
  reflect: boolean; lightScreen: boolean; auroraVeil: boolean;
  tailwind: boolean; helpingHand: boolean; isCrit: boolean;
}

export interface FieldConditions {
  weather: Weather;
  terrain: Terrain;
  isDoublesFormat: boolean;
}

export interface DamageResult {
  rolls: number[];
  min: number; max: number;
  minPercent: number; maxPercent: number;
  defenderHp: number;
  koChance: string; twoHkoChance: string;
  typeMultiplier: number;
  isStab: boolean;
  hits: number; // for multihit moves
  description: string;
}

// ─── Stat calculation ─────────────────────────────────────────────────────────

export type NatureEffect = 1.1 | 1.0 | 0.9;

export function calcHp(base: number, iv: number, ev: number, level: number): number {
  if (base === 1) return 1;
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
}

export function calcStat(
  base: number, iv: number, ev: number, level: number, nature: NatureEffect
): number {
  return Math.floor(
    (Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5) * nature
  );
}

const STAGE_MULTS: Record<number, number> = {
  "-6": 2/8, "-5": 2/7, "-4": 2/6, "-3": 2/5, "-2": 2/4, "-1": 2/3,
  "0": 1,
  "1": 3/2, "2": 4/2, "3": 5/2, "4": 6/2, "5": 7/2, "6": 8/2,
};

export function applyStage(stat: number, stage: number): number {
  return Math.max(1, Math.floor(stat * STAGE_MULTS[stage]));
}

// ─── Multihit moves ───────────────────────────────────────────────────────────

const MULTIHIT_MOVES: Record<string, [number, number]> = {
  // Always 2 hits
  "Double Hit": [2, 2], "Double Kick": [2, 2], "Double Slap": [2, 2],
  "Bonemerang": [2, 2], "Gear Grind": [2, 2], "Dual Chop": [2, 2],
  "Dual Wingbeat": [2, 2], "Twin Beam": [2, 2],
  // Always 3 hits
  "Triple Kick": [3, 3], "Triple Axel": [3, 3], "Surging Strikes": [3, 3],
  "Wicked Blow": [1, 1], // single hit but always crits
  // 2-5 hits
  "Fury Attack": [2, 5], "Fury Swipes": [2, 5], "Pin Missile": [2, 5],
  "Rock Blast": [2, 5], "Bullet Seed": [2, 5], "Icicle Spear": [2, 5],
  "Tail Slap": [2, 5], "Water Shuriken": [2, 5], "Arm Thrust": [2, 5],
  "Barrage": [2, 5], "Comet Punch": [2, 5], "Scale Shot": [2, 5],
  "Spike Cannon": [2, 5], "Clangorous Soulblaze": [1, 1],
  // Always 5 hits (Skill Link ability)
  "Bone Rush": [2, 5],
};

const SKILL_LINK_MOVES = new Set([
  "Bullet Seed", "Icicle Spear", "Pin Missile", "Rock Blast", "Tail Slap",
  "Fury Attack", "Fury Swipes", "Arm Thrust", "Comet Punch", "Spike Cannon",
  "Scale Shot", "Water Shuriken",
]);

const ALWAYS_CRIT_MOVES = new Set([
  "Frost Breath", "Storm Throw", "Surging Strikes", "Wicked Blow", "Flower Trick",
]);

// ─── Attacker ability modifiers ───────────────────────────────────────────────

function getAttackerAbilityMod(
  ability: string, move: Move,
  attackerTypes: PokemonType[], defenderTypes: PokemonType[],
  weather: Weather, attackerStatus: Status,
  basePower: number, currentHp: number, maxHp: number
): number {
  const a = ability.toLowerCase();
  const mt = move.type;
  const isLowHp = currentHp <= Math.floor(maxHp / 3);

  // Technician: 60BP or less → 1.5x
  if (a === "technician" && basePower <= 60) return 1.5;

  // Guts: 1.5x physical when statused
  if (a === "guts" && attackerStatus !== "none" && move.category === "physical") return 1.5;

  // Hustle: 1.5x physical
  if (a === "hustle" && move.category === "physical") return 1.5;

  // Blaze / Torrent / Overgrow / Swarm: 1.5x at 1/3 HP
  if (a === "blaze"   && mt === "Fire"  && isLowHp) return 1.5;
  if (a === "torrent" && mt === "Water" && isLowHp) return 1.5;
  if (a === "overgrow"&& mt === "Grass" && isLowHp) return 1.5;
  if (a === "swarm"   && mt === "Bug"   && isLowHp) return 1.5;

  // Flash Fire: 1.5x fire (assume activated — user toggles Flash Fire ability)
  if (a === "flash fire" && mt === "Fire") return 1.5;

  // Steelworker / Steely Spirit
  if ((a === "steelworker" || a === "steely spirit") && mt === "Steel") return 1.5;

  // Transistor
  if (a === "transistor" && mt === "Electric") return 1.5;

  // Dragon's Maw
  if (a === "dragon's maw" && mt === "Dragon") return 1.5;

  // Aerilate / Pixilate / Refrigerate / Galvanize: Normal → type + 1.2x
  if (
    (a === "aerilate"    && mt === "Normal") ||
    (a === "pixilate"    && mt === "Normal") ||
    (a === "refrigerate" && mt === "Normal") ||
    (a === "galvanize"   && mt === "Normal")
  ) return 1.2;

  // Reckless: recoil/crash moves 1.2x
  if (a === "reckless" && [
    "Brave Bird","Double-Edge","Flare Blitz","Head Charge","Head Smash",
    "High Jump Kick","Jump Kick","Submission","Take Down","Volt Tackle",
    "Wild Charge","Wood Hammer","Sky Attack","Shadow Rush",
  ].includes(move.name)) return 1.2;

  // Strong Jaw: biting moves 1.5x
  if (a === "strong jaw" && [
    "Bite","Crunch","Fire Fang","Ice Fang","Thunder Fang","Poison Fang",
    "Psychic Fangs","Hyper Fang","Fishious Rend","Jaw Lock","Snap Trap",
  ].includes(move.name)) return 1.5;

  // Tough Claws: contact moves 1.3x
  if (a === "tough claws" && move.makesContact) return 1.3;

  // Iron Fist: punching moves 1.2x
  if (a === "iron fist" && [
    "Bullet Punch","Comet Punch","Dizzy Punch","Drain Punch","Dynamic Punch",
    "Fire Punch","Focus Punch","Hammer Arm","Ice Punch","Mach Punch",
    "Mega Punch","Meteor Mash","Power-Up Punch","Shadow Punch",
    "Sky Uppercut","Thunder Punch","Ice Hammer","Surging Strikes",
  ].includes(move.name)) return 1.2;

  // Punk Rock: sound moves 1.3x
  if (a === "punk rock" && [
    "Boomburst","Bug Buzz","Chatter","Clanging Scales","Clangorous Soul",
    "Disarming Voice","Echoed Voice","Hyper Voice","Metal Sound",
    "Noble Roar","Parting Shot","Overdrive","Relic Song","Round",
    "Sing","Snarl","Sparkling Aria","Supersonic","Uproar",
  ].includes(move.name)) return 1.3;

  // Sand Force: rock/ground/steel 1.3x in sand
  if (a === "sand force" && weather === "sand" && ["Rock","Ground","Steel"].includes(mt)) return 1.3;

  // Sheer Force: moves with secondary effects get 1.3x
  // (We approximate: most moves with power < 130 and not purely damaging)
  if (a === "sheer force" && [
    "Air Slash","Ancient Power","Astonish","Aurora Beam","Bite","Blaze Kick",
    "Body Slam","Bounce","Bubble Beam","Charge Beam","Dark Pulse","Discharge",
    "Dragon Rush","Dazzling Gleam","Extrasensory","Fire Blast","Fire Fang",
    "Flamethrower","Flash Cannon","Focus Blast","Force Palm","Heart Stamp",
    "Ice Beam","Ice Fang","Iron Head","Lava Plume","Muddy Water","Nuzzle",
    "Ominous Wind","Parabolic Charge","Play Rough","Poison Jab","Rock Slide",
    "Secret Power","Shadow Ball","Sludge Bomb","Sludge Wave","Sparkling Aria",
    "Steel Wing","Stomping Tantrum","Thunder","Thunder Fang","Thunderbolt",
    "Tri Attack","Twister","Water Pulse","Waterfall","Zen Headbutt",
  ].includes(move.name)) return 1.3;

  // Water Bubble: 2x water
  if (a === "water bubble" && mt === "Water") return 2;

  // Neuroforce: super effective 1.25x
  if (a === "neuroforce") {
    if (multiplier(mt, defenderTypes) > 1) return 1.25;
  }

  // Stakeout: 2x if target switched in (approximate — always show 2x when selected)
  if (a === "stakeout") return 2;

  return 1;
}

// ─── Defender ability modifiers ───────────────────────────────────────────────

function getDefenderAbilityMod(
  ability: string, move: Move, _weather: Weather
): number {
  const a = ability.toLowerCase();
  const mt = move.type;

  if (a === "thick fat" && (mt === "Fire" || mt === "Ice")) return 0.5;
  if ((a === "water absorb" || a === "dry skin") && mt === "Water") return 0;
  if (a === "flash fire" && mt === "Fire") return 0;
  if (a === "levitate" && mt === "Ground") return 0;
  if ((a === "volt absorb" || a === "motor drive" || a === "lightning rod") && mt === "Electric") return 0;
  if ((a === "storm drain" || a === "water absorb") && mt === "Water") return 0;
  if (a === "sap sipper" && mt === "Grass") return 0;
  if (a === "wonder guard") return 0;

  if (a === "fluffy") {
    if (move.makesContact) return 0.5;
    if (mt === "Fire") return 2;
  }
  if (a === "heatproof" && mt === "Fire") return 0.5;
  if (a === "ice scales" && move.category === "special") return 0.5;
  if (a === "fur coat" && move.category === "physical") return 0.5;

  // Multiscale / Shadow Shield: 0.5x at full HP (checked via currentHp)
  // handled in main calc

  return 1;
}

// ─── Attacker item modifiers ──────────────────────────────────────────────────

function getAttackerItemMod(item: string, move: Move): number {
  const i = item.toLowerCase();
  const mt = move.type;
  const cat = move.category;

  if (i === "choice band"  && cat === "physical") return 1.5;
  if (i === "choice specs" && cat === "special")  return 1.5;
  if (i === "life orb")  return 1.3;
  if (i === "muscle band" && cat === "physical") return 1.1;
  if (i === "wise glasses" && cat === "special")  return 1.1;

  const typeItems: Record<string, PokemonType> = {
    "charcoal":"Fire","mystic water":"Water","miracle seed":"Grass",
    "magnet":"Electric","nevermeltice":"Ice","black belt":"Fighting",
    "poison barb":"Poison","soft sand":"Ground","sharp beak":"Flying",
    "twisted spoon":"Psychic","silver powder":"Bug","hard stone":"Rock",
    "spell tag":"Ghost","dragon fang":"Dragon","black glasses":"Dark",
    "metal coat":"Steel","fairy feather":"Fairy",
  };
  if (typeItems[i] === mt) return 1.2;

  const plates: Record<string, PokemonType> = {
    "flame plate":"Fire","splash plate":"Water","meadow plate":"Grass",
    "zap plate":"Electric","icicle plate":"Ice","fist plate":"Fighting",
    "toxic plate":"Poison","earth plate":"Ground","sky plate":"Flying",
    "mind plate":"Psychic","insect plate":"Bug","stone plate":"Rock",
    "spooky plate":"Ghost","draco plate":"Dragon","dread plate":"Dark",
    "iron plate":"Steel","pixie plate":"Fairy",
  };
  if (plates[i] === mt) return 1.2;

  if (i === "punching glove" && [
    "Bullet Punch","Drain Punch","Dynamic Punch","Fire Punch",
    "Focus Punch","Ice Punch","Mach Punch","Mega Punch",
    "Meteor Mash","Power-Up Punch","Thunder Punch",
  ].includes(move.name)) return 1.1;

  return 1;
}

// ─── Defender item modifiers ──────────────────────────────────────────────────

function getDefenderItemMod(item: string, move: Move, typeMult: number): number {
  const i = item.toLowerCase();
  const mt = move.type;

  // Resistance berries: halve super-effective damage
  const berryTypes: Record<string, PokemonType> = {
    "occa berry":"Fire","passho berry":"Water","wacan berry":"Electric",
    "rindo berry":"Grass","yache berry":"Ice","chople berry":"Fighting",
    "kebia berry":"Poison","shuca berry":"Ground","coba berry":"Flying",
    "payapa berry":"Psychic","tanga berry":"Bug","charti berry":"Rock",
    "kasib berry":"Ghost","haban berry":"Dragon","colbur berry":"Dark",
    "babiri berry":"Steel","roseli berry":"Fairy","chilan berry":"Normal",
  };
  if (berryTypes[i] === mt && typeMult > 1) return 0.5;

  return 1;
}

// ─── Main damage calculator ───────────────────────────────────────────────────

export function calculateDamage(
  attacker: CalcPokemon, defender: CalcPokemon,
  move: Move, field: FieldConditions, level: number = 100
): DamageResult {

  if (move.category === "status" || move.power === 0) {
    return {
      rolls: [0], min: 0, max: 0, minPercent: 0, maxPercent: 0,
      defenderHp: defender.hp, koChance: "—", twoHkoChance: "—",
      typeMultiplier: 0, isStab: false, hits: 1,
      description: "Status move — no damage",
    };
  }

  const isPhysical = move.category === "physical";
  const mt = move.type;

  // ── Wonder Guard ─────────────────────────────────────────────────────────
  if (defender.ability.toLowerCase() === "wonder guard") {
    const wgMult = multiplier(mt, defender.types);
    if (wgMult <= 1) {
      return {
        rolls: [0], min: 0, max: 0, minPercent: 0, maxPercent: 0,
        defenderHp: defender.hp, koChance: "0%", twoHkoChance: "0%",
        typeMultiplier: 0, isStab: false, hits: 1,
        description: "Blocked by Wonder Guard",
      };
    }
  }

  // ── Type effectiveness ────────────────────────────────────────────────────
  let typeMult = multiplier(mt, defender.types);
  if (typeMult > 1 && ["filter","solid rock","prism armor"].includes(defender.ability.toLowerCase())) {
    typeMult *= 0.75;
  }

  // ── Defender ability immunity ─────────────────────────────────────────────
  const defAbilMod = getDefenderAbilityMod(defender.ability, move, field.weather);
  if (defAbilMod === 0) {
    return {
      rolls: [0], min: 0, max: 0, minPercent: 0, maxPercent: 0,
      defenderHp: defender.hp, koChance: "0%", twoHkoChance: "0%",
      typeMultiplier: 0, isStab: false, hits: 1,
      description: `Blocked by ${defender.ability}`,
    };
  }

  // ── STAB ──────────────────────────────────────────────────────────────────
  const isStab = attacker.types.includes(mt);
  const adaptability = attacker.ability.toLowerCase() === "adaptability";
  const stabMult = isStab ? (adaptability ? 2 : 1.5) : 1;

  // ── Attacker stats ────────────────────────────────────────────────────────
  let rawAtk = isPhysical ? attacker.atk : attacker.spA;

  // Huge Power / Pure Power doubles physical attack
  if (isPhysical && ["huge power","pure power"].includes(attacker.ability.toLowerCase())) rawAtk *= 2;

  // Download: +1 SpA or Atk depending on defender's lower stat
  if (attacker.ability.toLowerCase() === "download") {
    const atkBoost = defender.spD < defender.def ? attacker.spA * 0.5 : 0;
    const defBoost = defender.def <= defender.spD ? attacker.atk * 0.5 : 0;
    rawAtk += isPhysical ? defBoost : atkBoost;
  }

  // Assault Vest: SpD ×1.5 (defender item, handled in defender stat)
  const rawDef = isPhysical
    ? (defender.item.toLowerCase() === "eviolite" ? Math.floor(defender.def * 1.5) : defender.def)
    : (defender.item.toLowerCase() === "assault vest" || defender.item.toLowerCase() === "eviolite"
        ? Math.floor(defender.spD * 1.5) : defender.spD);

  // Guts ignores burn penalty
  const gutsActive = attacker.ability.toLowerCase() === "guts" && attacker.status !== "none";

  // ── Is crit? ──────────────────────────────────────────────────────────────
  const isCrit = attacker.isCrit || ALWAYS_CRIT_MOVES.has(move.name);

  // ── Apply stages (crits ignore negative atk / positive def) ──────────────
  const atkStage = isCrit ? Math.max(0, attacker.atkStage) : attacker.atkStage;
  const defStage = isCrit ? Math.min(0, defender.defStage) : defender.defStage;
  const effAtk = applyStage(rawAtk, isPhysical ? atkStage : attacker.spAStage);
  const effDef = applyStage(rawDef, isPhysical ? defStage : defender.spDStage);

  // ── Base power ────────────────────────────────────────────────────────────
  let bp = move.power;

  // Facade: 140 when statused
  if (move.name === "Facade" && attacker.status !== "none") bp = 140;

  // Knock Off: 1.5x if defender has item
  if (move.name === "Knock Off" && defender.item !== "None" && defender.item !== "") {
    bp = Math.floor(bp * 1.5);
  }

  // Gyro Ball: based on speed comparison
  if (move.name === "Gyro Ball") {
    const atkSpe = applyStage(attacker.spe, attacker.speStage) * (attacker.status === "paralysis" ? 0.5 : 1) * (attacker.tailwind ? 2 : 1);
    const defSpe = applyStage(defender.spe, defender.speStage) * (defender.status === "paralysis" ? 0.5 : 1) * (defender.tailwind ? 2 : 1);
    bp = Math.min(150, Math.floor(25 * defSpe / Math.max(1, atkSpe)));
  }

  // Eruption / Water Spout: power = 150 * currentHP / maxHP
  if ((move.name === "Eruption" || move.name === "Water Spout" || move.name === "Dragon Energy")) {
    bp = Math.max(1, Math.floor(150 * attacker.currentHp / attacker.hp));
  }

  // Solar Beam / Solar Blade: 0.5x not in sun
  if ((move.name === "Solar Beam" || move.name === "Solar Blade") &&
      field.weather !== "sun" && field.weather !== "harshSun") {
    bp = Math.floor(bp * 0.5);
  }

  // Attacker ability BP mod
  const atkAbilMod = getAttackerAbilityMod(
    attacker.ability, move, attacker.types, defender.types,
    field.weather, attacker.status, bp,
    attacker.currentHp, attacker.hp
  );
  bp = Math.floor(bp * atkAbilMod);

  // ── Multi-hit ─────────────────────────────────────────────────────────────
  let hits = 1;
  const multihitRange = MULTIHIT_MOVES[move.name];
  if (multihitRange) {
    const [minH, maxH] = multihitRange;
    if (attacker.ability.toLowerCase() === "skill link" && SKILL_LINK_MOVES.has(move.name)) {
      hits = 5;
    } else if (attacker.item.toLowerCase() === "loaded dice" && minH >= 2) {
      // Loaded Dice: always 4-5 hits
      hits = Math.floor((4 + 5) / 2);
    } else {
      // Average hits (weighted: 2=1/3, 3=1/3, 4=1/6, 5=1/6)
      if (maxH === 5 && minH === 2) hits = 3; // average ~3.17
      else hits = Math.floor((minH + maxH) / 2);
    }
  }

  // ── Weather ───────────────────────────────────────────────────────────────
  let weatherMult = 1;
  if (field.weather === "sun" || field.weather === "harshSun") {
    if (mt === "Fire")  weatherMult = 1.5;
    if (mt === "Water") weatherMult = field.weather === "harshSun" ? 0 : 0.5;
  }
  if (field.weather === "rain" || field.weather === "heavyRain") {
    if (mt === "Water") weatherMult = 1.5;
    if (mt === "Fire")  weatherMult = field.weather === "heavyRain" ? 0 : 0.5;
  }

  // ── Terrain ───────────────────────────────────────────────────────────────
  let terrainMult = 1;
  const atkGrounded = !attacker.types.includes("Flying") && attacker.ability.toLowerCase() !== "levitate";
  const defGrounded = !defender.types.includes("Flying") && defender.ability.toLowerCase() !== "levitate";
  if (field.terrain === "electric" && mt === "Electric" && atkGrounded) terrainMult = 1.3;
  if (field.terrain === "grassy"   && mt === "Grass"    && atkGrounded) terrainMult = 1.3;
  if (field.terrain === "psychic"  && mt === "Psychic"  && atkGrounded) terrainMult = 1.3;
  if (field.terrain === "misty"    && mt === "Dragon"   && defGrounded) terrainMult = 0.5;
  if (field.terrain === "grassy" && ["Earthquake","Bulldoze","Magnitude"].includes(move.name)) terrainMult = 0.5;

  // ── Screens ───────────────────────────────────────────────────────────────
  let screenMult = 1;
  if (!isCrit) {
    if (isPhysical && (defender.reflect || defender.auroraVeil)) {
      screenMult = field.isDoublesFormat ? 2/3 : 0.5;
    }
    if (!isPhysical && (defender.lightScreen || defender.auroraVeil)) {
      screenMult = field.isDoublesFormat ? 2/3 : 0.5;
    }
  }

  // ── Burn ──────────────────────────────────────────────────────────────────
  const burnMult = isPhysical && attacker.status === "burn" && !gutsActive ? 0.5 : 1;

  // ── Helping Hand ─────────────────────────────────────────────────────────
  const hhMult = attacker.helpingHand ? 1.5 : 1;

  // ── Doubles spread ────────────────────────────────────────────────────────
  const spreadMult = field.isDoublesFormat && move.isSpread ? 0.75 : 1;

  // ── Crit ──────────────────────────────────────────────────────────────────
  const critMult = isCrit
    ? (attacker.ability.toLowerCase() === "sniper" ? 2.25 : 1.5)
    : 1;

  // ── Multiscale / Shadow Shield at full HP ─────────────────────────────────
  const multiscaleMod =
    (["multiscale","shadow shield"].includes(defender.ability.toLowerCase()) &&
     defender.currentHp >= defender.hp)
      ? 0.5 : 1;

  // ── Attacker item mod ─────────────────────────────────────────────────────
  const atkItemMod = getAttackerItemMod(attacker.item, move);
  const expertBelt = attacker.item.toLowerCase() === "expert belt" && typeMult > 1 ? 1.2 : 1;

  // ── Defender item mod ─────────────────────────────────────────────────────
  const defItemMod = getDefenderItemMod(defender.item, move, typeMult);

  // ── Base damage ───────────────────────────────────────────────────────────
  const baseDmg = Math.floor(
    Math.floor((Math.floor(2 * level / 5 + 2) * bp * effAtk) / effDef) / 50
  ) + 2;

  // ── Apply multipliers (Showdown order) ────────────────────────────────────
  let damage = baseDmg;
  damage = Math.floor(damage * spreadMult);
  damage = Math.floor(damage * weatherMult);
  damage = Math.floor(damage * critMult);
  damage = Math.floor(damage * atkItemMod);
  damage = Math.floor(damage * expertBelt);
  damage = Math.floor(damage * burnMult);
  damage = Math.floor(damage * screenMult);
  damage = Math.floor(damage * hhMult);
  damage = Math.floor(damage * terrainMult);
  damage = Math.floor(damage * stabMult);
  damage = Math.floor(damage * typeMult);
  damage = Math.floor(damage * defAbilMod);
  damage = Math.floor(damage * multiscaleMod);
  damage = Math.floor(damage * defItemMod);

  // ── 16 random rolls ───────────────────────────────────────────────────────
  const singleRolls: number[] = [];
  for (let i = 85; i <= 100; i++) {
    singleRolls.push(Math.floor(damage * i / 100));
  }

  // Multiply each roll by hit count for multihit
  const rolls = singleRolls.map(r => r * hits);
  const min = rolls[0];
  const max = rolls[15];
  const hp  = defender.hp;

  const minPct = Math.floor(min / hp * 1000) / 10;
  const maxPct = Math.floor(max / hp * 1000) / 10;

  // ── KO chance ────────────────────────────────────────────────────────────
  const ohkoRolls  = rolls.filter(r => r >= hp).length;
  const twoHkoRolls = rolls.filter(r => r * 2 >= hp).length;

  const koChance =
    ohkoRolls === 16 ? "Guaranteed OHKO" :
    ohkoRolls > 0    ? `${(ohkoRolls / 16 * 100).toFixed(1)}% OHKO` : "No OHKO";

  const twoHkoChance =
    twoHkoRolls === 16 ? "Guaranteed 2HKO" :
    twoHkoRolls > 0    ? `${(twoHkoRolls / 16 * 100).toFixed(1)}% 2HKO` : "No 2HKO";

  // ── Description ───────────────────────────────────────────────────────────
  const parts: string[] = [];
  if (isStab)              parts.push("STAB");
  if (isCrit)              parts.push("Crit");
  if (typeMult >= 4)       parts.push("4× effective");
  else if (typeMult >= 2)  parts.push("2× effective");
  else if (typeMult === 0) parts.push("No effect");
  else if (typeMult <= 0.25) parts.push("¼× effective");
  else if (typeMult <= 0.5)  parts.push("½× effective");
  if (field.weather !== "none") parts.push(field.weather);
  if (field.terrain !== "none") parts.push(`${field.terrain} terrain`);
  if (burnMult < 1)        parts.push("burned");
  if (screenMult < 1)      parts.push("screen");
  if (multiscaleMod < 1)   parts.push("Multiscale");
  if (hits > 1)            parts.push(`${hits} hits`);

  const description = `${attacker.name} ${move.name} → ${defender.name}: ${minPct}–${maxPct}% (${min}–${max}/${hp} HP)${parts.length ? " [" + parts.join(", ") + "]" : ""}`;

  return {
    rolls, min, max, minPercent: minPct, maxPercent: maxPct,
    defenderHp: hp, koChance, twoHkoChance,
    typeMultiplier: typeMult, isStab, hits, description,
  };
}

// ─── Speed comparison ─────────────────────────────────────────────────────────

export function getEffectiveSpeed(p: CalcPokemon): number {
  let spe = applyStage(p.spe, p.speStage);
  if (p.status === "paralysis") spe = Math.floor(spe * 0.5);
  if (p.tailwind) spe *= 2;
  if (p.item.toLowerCase() === "choice scarf")  spe = Math.floor(spe * 1.5);
  if (["iron ball","lagging tail"].includes(p.item.toLowerCase())) spe = Math.floor(spe * 0.5);
  // Sand Rush / Swift Swim / Chlorophyll / Slush Rush — speed doubles in weather
  return spe;
}
