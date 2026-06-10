import type { NatureEffect } from "./calc-engine";

export interface Nature {
  name: string;
  atk: NatureEffect;
  def: NatureEffect;
  spA: NatureEffect;
  spD: NatureEffect;
  spe: NatureEffect;
  label: string;
}

export const NATURES: Nature[] = [
  { name: "Adamant", atk:1.1, def:1.0, spA:0.9, spD:1.0, spe:1.0, label:"Adamant (+Atk, −SpA)" },
  { name: "Bashful", atk:1.0, def:1.0, spA:1.0, spD:1.0, spe:1.0, label:"Bashful" },
  { name: "Bold",    atk:0.9, def:1.1, spA:1.0, spD:1.0, spe:1.0, label:"Bold (+Def, −Atk)" },
  { name: "Brave",   atk:1.1, def:1.0, spA:1.0, spD:1.0, spe:0.9, label:"Brave (+Atk, −Spe)" },
  { name: "Calm",    atk:0.9, def:1.0, spA:1.0, spD:1.1, spe:1.0, label:"Calm (+SpD, −Atk)" },
  { name: "Careful", atk:1.0, def:1.0, spA:0.9, spD:1.1, spe:1.0, label:"Careful (+SpD, −SpA)" },
  { name: "Docile",  atk:1.0, def:1.0, spA:1.0, spD:1.0, spe:1.0, label:"Docile" },
  { name: "Gentle",  atk:1.0, def:0.9, spA:1.0, spD:1.1, spe:1.0, label:"Gentle (+SpD, −Def)" },
  { name: "Hardy",   atk:1.0, def:1.0, spA:1.0, spD:1.0, spe:1.0, label:"Hardy" },
  { name: "Hasty",   atk:1.0, def:0.9, spA:1.0, spD:1.0, spe:1.1, label:"Hasty (+Spe, −Def)" },
  { name: "Impish",  atk:1.0, def:1.1, spA:0.9, spD:1.0, spe:1.0, label:"Impish (+Def, −SpA)" },
  { name: "Jolly",   atk:1.0, def:1.0, spA:0.9, spD:1.0, spe:1.1, label:"Jolly (+Spe, −SpA)" },
  { name: "Lax",     atk:1.0, def:1.1, spA:1.0, spD:0.9, spe:1.0, label:"Lax (+Def, −SpD)" },
  { name: "Lonely",  atk:1.1, def:0.9, spA:1.0, spD:1.0, spe:1.0, label:"Lonely (+Atk, −Def)" },
  { name: "Mild",    atk:1.0, def:0.9, spA:1.1, spD:1.0, spe:1.0, label:"Mild (+SpA, −Def)" },
  { name: "Modest",  atk:0.9, def:1.0, spA:1.1, spD:1.0, spe:1.0, label:"Modest (+SpA, −Atk)" },
  { name: "Naive",   atk:1.0, def:1.0, spA:1.0, spD:0.9, spe:1.1, label:"Naive (+Spe, −SpD)" },
  { name: "Naughty", atk:1.1, def:1.0, spA:1.0, spD:0.9, spe:1.0, label:"Naughty (+Atk, −SpD)" },
  { name: "Quiet",   atk:1.0, def:1.0, spA:1.1, spD:1.0, spe:0.9, label:"Quiet (+SpA, −Spe)" },
  { name: "Quirky",  atk:1.0, def:1.0, spA:1.0, spD:1.0, spe:1.0, label:"Quirky" },
  { name: "Rash",    atk:1.0, def:1.0, spA:1.1, spD:0.9, spe:1.0, label:"Rash (+SpA, −SpD)" },
  { name: "Relaxed", atk:1.0, def:1.1, spA:1.0, spD:1.0, spe:0.9, label:"Relaxed (+Def, −Spe)" },
  { name: "Sassy",   atk:1.0, def:1.0, spA:1.0, spD:1.1, spe:0.9, label:"Sassy (+SpD, −Spe)" },
  { name: "Serious", atk:1.0, def:1.0, spA:1.0, spD:1.0, spe:1.0, label:"Serious" },
  { name: "Timid",   atk:0.9, def:1.0, spA:1.0, spD:1.0, spe:1.1, label:"Timid (+Spe, −Atk)" },
];

export const ITEMS = [
  "None",
  // Power items
  "Choice Band","Choice Specs","Choice Scarf","Life Orb","Expert Belt",
  "Muscle Band","Wise Glasses","Assault Vest","Eviolite","Rocky Helmet",
  "Leftovers","Black Sludge","Sitrus Berry","Lum Berry",
  "Focus Sash","Air Balloon","Iron Ball","Lagging Tail","Shed Shell",
  "Punching Glove",
  // Type plates & gems
  "Flame Plate","Splash Plate","Meadow Plate","Zap Plate","Icicle Plate",
  "Fist Plate","Toxic Plate","Earth Plate","Sky Plate","Mind Plate",
  "Insect Plate","Stone Plate","Spooky Plate","Draco Plate","Dread Plate",
  "Iron Plate","Pixie Plate",
  // Type boosting
  "Charcoal","Mystic Water","Miracle Seed","Magnet","NeverMeltIce",
  "Black Belt","Poison Barb","Soft Sand","Sharp Beak","Twisted Spoon",
  "Silver Powder","Hard Stone","Spell Tag","Dragon Fang","Black Glasses",
  "Metal Coat","Fairy Feather",
  // Berries that reduce damage
  "Occa Berry","Passho Berry","Wacan Berry","Rindo Berry","Yache Berry",
  "Chople Berry","Kebia Berry","Shuca Berry","Coba Berry","Payapa Berry",
  "Tanga Berry","Charti Berry","Kasib Berry","Haban Berry","Colbur Berry",
  "Babiri Berry","Roseli Berry",
];

export const ABILITIES = [
  "None",
  // Common competitive abilities
  "Adaptability","Aerilate","Air Lock","Analytic","Arena Trap",
  "Battle Armor","Big Pecks","Blaze","Clear Body","Cloud Nine",
  "Competitive","Compound Eyes","Contrary","Cursed Body","Damp",
  "Download","Dragon's Maw","Drought","Drizzle","Dry Skin",
  "Early Bird","Filter","Flash Fire","Fluffy","Forecast",
  "Friend Guard","Frisk","Fur Coat","Galvanize","Guts",
  "Huge Power","Hustle","Hyper Cutter","Ice Scales","Illuminate",
  "Immunity","Inner Focus","Insomnia","Intimidate","Iron Fist",
  "Keen Eye","Levitate","Lightning Rod","Liquid Voice","Magic Guard",
  "Marvel Scale","Minus","Motor Drive","Multiscale","Natural Cure",
  "Neuroforce","Oblivious","Overcoat","Overgrow","Own Tempo",
  "Pixilate","Poison Heal","Power of Alchemy","Pressure","Prism Armor",
  "Protean","Punk Rock","Pure Power","Queenly Majesty","Reckless",
  "Refrigerate","Regenerator","Rock Head","Sand Force","Sand Rush",
  "Sand Stream","Sand Veil","Sap Sipper","Shadow Shield","Sheer Force",
  "Simple","Skill Link","Slow Start","Sniper","Solid Rock",
  "Speed Boost","Stakeout","Steelworker","Stench","Storm Drain",
  "Strong Jaw","Sturdy","Swarm","Swift Swim","Synchronize",
  "Technician","Thick Fat","Tinted Lens","Torrent","Tough Claws",
  "Trace","Transistor","Unaware","Unburden","Volt Absorb",
  "Water Absorb","Water Bubble","Water Veil","White Smoke","Wonder Guard",
  "Wonder Skin","Zen Mode",
];
