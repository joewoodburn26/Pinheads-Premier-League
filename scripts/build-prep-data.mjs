// Builds lib/prep-data.json for the Prep tab from Pokémon Showdown's data.
//
//   node scripts/build-prep-data.mjs
//
// Re-run it when new games/learnsets come out. It keeps only the moves in the
// Prep categories below, plus each species' abilities, so the file stays small.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data";

// ── Prep categories (from the Pinheads teambuilder sheet, plus Recovery) ──────
// Each move is [name, type]; the type sets the move's color on the Prep tab.
const CATEGORIES = [
  { key: "hazards", label: "Hazard Setting", moves: [["Stealth Rock", "Rock"], ["Spikes", "Ground"], ["Toxic Spikes", "Poison"], ["Sticky Web", "Bug"], ["Ceaseless Edge", "Dark"], ["Stone Axe", "Rock"]] },
  { key: "removal", label: "Hazard Removal", moves: [["Defog", "Flying"], ["Rapid Spin", "Normal"], ["Court Change", "Normal"], ["Mortal Spin", "Poison"], ["Tidy Up", "Normal"]] },
  { key: "recovery", label: "Recovery", moves: [["Recover", "Normal"], ["Roost", "Flying"], ["Slack Off", "Normal"], ["Soft-Boiled", "Normal"], ["Milk Drink", "Normal"], ["Synthesis", "Grass"], ["Morning Sun", "Normal"], ["Moonlight", "Fairy"], ["Shore Up", "Ground"], ["Heal Order", "Bug"], ["Strength Sap", "Grass"], ["Rest", "Psychic"], ["Pain Split", "Normal"]] },
  { key: "healing", label: "Healing (team support)", moves: [["Wish", "Normal"], ["Heal Bell", "Normal"], ["Aromatherapy", "Grass"], ["Healing Wish", "Psychic"], ["Lunar Dance", "Psychic"], ["Jungle Healing", "Grass"], ["Lunar Blessing", "Psychic"], ["Refresh", "Normal"], ["Revival Blessing", "Normal"], ["Take Heart", "Psychic"]] },
  { key: "momentum", label: "Momentum", moves: [["U-turn", "Bug"], ["Volt Switch", "Electric"], ["Flip Turn", "Water"], ["Parting Shot", "Dark"], ["Teleport", "Psychic"], ["Shed Tail", "Normal"], ["Chilly Reception", "Ice"], ["Baton Pass", "Normal"], ["Memento", "Dark"]] },
  { key: "itemRemoval", label: "Item Removal", moves: [["Knock Off", "Dark"], ["Trick", "Psychic"], ["Switcheroo", "Dark"], ["Corrosive Gas", "Poison"]] },
  { key: "status", label: "Status", moves: [["Thunder Wave", "Electric"], ["Will-O-Wisp", "Fire"], ["Toxic", "Poison"], ["Spore", "Grass"], ["Glare", "Normal"], ["Nuzzle", "Electric"], ["Yawn", "Normal"]] },
  { key: "priority", label: "Priority", moves: [["Fake Out", "Normal"], ["Extreme Speed", "Normal"], ["Sucker Punch", "Dark"], ["Aqua Jet", "Water"], ["Bullet Punch", "Steel"], ["Ice Shard", "Ice"], ["Mach Punch", "Fighting"], ["Shadow Sneak", "Ghost"], ["Quick Attack", "Normal"], ["Accelerock", "Rock"], ["First Impression", "Bug"], ["Jet Punch", "Water"], ["Thunderclap", "Electric"], ["Upper Hand", "Fighting"], ["Vacuum Wave", "Fighting"], ["Water Shuriken", "Water"]] },
  { key: "disruption", label: "Disruption", moves: [["Roar", "Normal"], ["Whirlwind", "Normal"], ["Dragon Tail", "Dragon"], ["Circle Throw", "Fighting"], ["Haze", "Ice"], ["Clear Smog", "Poison"], ["Encore", "Normal"], ["Taunt", "Dark"]] },
];

const toId = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

// ── Tiny parser for Showdown's data files (JS object literals, no code) ──────
function parseDataFile(text) {
  const start = text.indexOf("= {");
  if (start === -1) throw new Error("Unexpected data file format");
  let i = start + 2;

  const ws = () => {
    for (;;) {
      while (i < text.length && /\s/.test(text[i])) i++;
      if (text.startsWith("//", i)) { i = text.indexOf("\n", i); if (i === -1) i = text.length; continue; }
      if (text.startsWith("/*", i)) { i = text.indexOf("*/", i) + 2; continue; }
      return;
    }
  };
  const str = () => {
    const q = text[i++];
    let out = "";
    while (text[i] !== q) {
      if (text[i] === "\\") {
        const next = text[i + 1];
        if (next === "u") { out += String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16)); i += 6; continue; }
        const map = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'" };
        out += map[next] ?? next;
        i += 2;
        continue;
      }
      out += text[i++];
    }
    i++;
    return out;
  };
  const value = () => {
    ws();
    const c = text[i];
    if (c === "{") {
      i++;
      const obj = {};
      for (;;) {
        ws();
        if (text[i] === "}") { i++; return obj; }
        let key;
        if (text[i] === '"' || text[i] === "'") key = str();
        else { const m = /^[A-Za-z0-9_$]+/.exec(text.slice(i, i + 64)); key = m[0]; i += key.length; }
        ws();
        if (text[i] !== ":") throw new Error(`Expected ':' near ${text.slice(i - 40, i + 40)}`);
        i++;
        obj[key] = value();
        ws();
        if (text[i] === ",") i++;
      }
    }
    if (c === "[") {
      i++;
      const arr = [];
      for (;;) {
        ws();
        if (text[i] === "]") { i++; return arr; }
        arr.push(value());
        ws();
        if (text[i] === ",") i++;
      }
    }
    if (c === '"' || c === "'") return str();
    const m = /^-?[0-9.]+(e-?\d+)?|^true|^false|^null|^undefined/.exec(text.slice(i, i + 32));
    if (!m) throw new Error(`Unexpected token near ${text.slice(i - 40, i + 40)}`);
    i += m[0].length;
    if (m[0] === "true") return true;
    if (m[0] === "false") return false;
    if (m[0] === "null" || m[0] === "undefined") return null;
    return Number(m[0]);
  };
  return value();
}

async function load(name) {
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`Couldn't download ${name} (${res.status})`);
  return parseDataFile(await res.text());
}

const [pokedex, learnsets] = await Promise.all([load("pokedex.ts"), load("learnsets.ts")]);

const wanted = new Set(CATEGORIES.flatMap((c) => c.moves.map(([name]) => toId(name))));

// Earliest generation each species can learn each wanted move, following
// forme bases and pre-evolutions (egg/tutor moves live on the earliest stage).
function ownMoves(id) {
  const learnset = learnsets[id]?.learnset;
  if (!learnset) return null;
  const out = {};
  for (const [move, sources] of Object.entries(learnset)) {
    if (!wanted.has(move)) continue;
    const gens = sources.map((s) => parseInt(String(s)[0], 10)).filter((n) => n > 0);
    if (gens.length) out[move] = Math.min(...gens);
  }
  return out;
}

function speciesMoves(id, seen = new Set()) {
  if (seen.has(id)) return {};
  seen.add(id);
  const entry = pokedex[id];
  let moves = ownMoves(id);
  if (!moves && entry) {
    const from = entry.changesFrom ?? entry.battleOnly ?? entry.baseSpecies;
    const base = Array.isArray(from) ? from[0] : from;
    if (base && toId(base) !== id) moves = speciesMoves(toId(base), seen);
  }
  const merged = { ...(moves ?? {}) };
  if (entry?.prevo) {
    for (const [m, g] of Object.entries(speciesMoves(toId(entry.prevo), seen))) {
      merged[m] = Math.min(merged[m] ?? 99, g);
    }
  }
  return merged;
}

const species = {};
for (const [id, entry] of Object.entries(pokedex)) {
  if (!entry || typeof entry.num !== "number" || entry.num <= 0) continue;
  species[id] = {
    n: entry.name,
    num: entry.num,
    a: [...new Set(Object.values(entry.abilities ?? {}))],
    m: speciesMoves(id),
  };
}

const out = {
  generatedAt: new Date().toISOString(),
  source: "Pokémon Showdown data (smogon/pokemon-showdown)",
  categories: CATEGORIES.map((c) => ({ ...c, moves: c.moves.map(([name, type]) => ({ id: toId(name), name, type })) })),
  species,
};

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "lib", "prep-data.json");
writeFileSync(target, JSON.stringify(out));
console.log(`Wrote ${Object.keys(species).length} species to lib/prep-data.json`);
