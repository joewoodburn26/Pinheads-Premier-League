// Builds lib/prep-data.json from Pokémon Showdown's data. Used by the Prep tab
// and the Draft room's move/ability search.
//
//   node scripts/build-prep-data.mjs
//
// Re-run it when new games/learnsets come out. For every species it stores:
//   - abilities
//   - every move it can learn, with the earliest generation (National Dex rules)
//   - its Pokémon Champions movepool and whether it's available in Champions

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

async function download(name) {
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`Couldn't download ${name} (${res.status})`);
  return res.text();
}
const load = async (name) => parseDataFile(await download(name));

// moves.ts contains code, so read just each move's name and type line by line
function parseMoves(text) {
  const moves = {};
  let current = null;
  for (const line of text.split("\n")) {
    const key = /^\t"?([a-z0-9]+)"?: \{\s*$/.exec(line);
    if (key) { current = { id: key[1] }; continue; }
    if (!current) continue;
    const name = /^\t\tname: "(.+)",\s*$/.exec(line);
    if (name) current.name = name[1];
    const type = /^\t\ttype: "(.+)",\s*$/.exec(line);
    if (type) current.type = type[1];
    const nonstd = /^\t\tisNonstandard: "(.+)",\s*$/.exec(line);
    if (nonstd) current.nonstandard = nonstd[1];
    if (/^\t\},?\s*$/.test(line)) {
      if (current.name && current.type) moves[current.id] = current;
      current = null;
    }
  }
  return moves;
}

const [pokedex, learnsets, champLearnsets, champFormats, movesText] = await Promise.all([
  load("pokedex.ts"),
  load("learnsets.ts"),
  load("mods/champions/learnsets.ts"),
  load("mods/champions/formats-data.ts"),
  download("moves.ts"),
]);
const moveInfo = parseMoves(movesText);

// Moves we list: anything a species can learn, minus Z/Max/CAP-only moves
const SKIP_NONSTANDARD = new Set(["Gigantamax", "CAP", "LGPE", "Custom"]);
const usableMove = (id) => {
  const m = moveInfo[id];
  return m && !SKIP_NONSTANDARD.has(m.nonstandard) && !/^(max|gmax)/.test(id);
};

// ── National Dex learnsets: earliest generation per move ──────────────────────
// Follows forme bases and pre-evolutions (egg/tutor moves live on the earliest stage).
function ownMoves(table, id) {
  const learnset = table[id]?.learnset;
  if (!learnset) return null;
  const out = {};
  for (const [move, sources] of Object.entries(learnset)) {
    if (!usableMove(move)) continue;
    const gens = sources.map((s) => parseInt(String(s)[0], 10)).filter((n) => n > 0);
    if (gens.length) out[move] = Math.min(...gens);
  }
  return out;
}

function baseOf(entry, id) {
  const from = entry?.changesFrom ?? entry?.battleOnly ?? entry?.baseSpecies;
  const base = Array.isArray(from) ? from[0] : from;
  return base && toId(base) !== id ? toId(base) : null;
}

function speciesMoves(table, id, withPrevos, seen = new Set()) {
  if (seen.has(id)) return {};
  seen.add(id);
  const entry = pokedex[id];
  let moves = ownMoves(table, id);
  if (!moves) {
    const base = baseOf(entry, id);
    if (base) moves = speciesMoves(table, base, withPrevos, seen);
  }
  const merged = { ...(moves ?? {}) };
  if (withPrevos && entry?.prevo) {
    for (const [m, g] of Object.entries(speciesMoves(table, toId(entry.prevo), withPrevos, seen))) {
      merged[m] = Math.min(merged[m] ?? 99, g);
    }
  }
  return merged;
}

// ── Pokémon Champions availability ────────────────────────────────────────────
function inChampions(id) {
  const f = champFormats[id] ?? champFormats[baseOf(pokedex[id], id) ?? ""];
  return !!f && f.tier !== "Illegal" && !f.isNonstandard;
}

// ── Assemble ──────────────────────────────────────────────────────────────────
const moveIndex = new Map();
const moveList = [];
const idx = (id) => {
  if (!moveIndex.has(id)) {
    moveIndex.set(id, moveList.length);
    moveList.push([id, moveInfo[id].name, moveInfo[id].type]);
  }
  return moveIndex.get(id);
};

const species = {};
for (const [id, entry] of Object.entries(pokedex)) {
  if (!entry || typeof entry.num !== "number" || entry.num <= 0) continue;
  const natdex = speciesMoves(learnsets, id, true);
  const record = {
    n: entry.name,
    num: entry.num,
    a: [...new Set(Object.values(entry.abilities ?? {}))],
    // "moveIndex.gen,moveIndex.gen,…"
    l: Object.entries(natdex).map(([m, g]) => `${idx(m)}.${g}`).join(","),
  };
  if (inChampions(id)) {
    record.ch = 1;
    const champ = speciesMoves(champLearnsets, id, false);
    record.c = Object.keys(champ).map(idx).join(",");
  }
  species[id] = record;
}

const out = {
  generatedAt: new Date().toISOString(),
  source: "Pokémon Showdown data (smogon/pokemon-showdown)",
  categories: CATEGORIES.map((c) => ({ ...c, moves: c.moves.map(([name, type]) => ({ id: toId(name), name, type })) })),
  /** [id, name, type] — learnsets refer to moves by position in this list */
  moves: moveList,
  species,
};

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "lib", "prep-data.json");
writeFileSync(target, JSON.stringify(out));
console.log(`Wrote ${Object.keys(species).length} species and ${moveList.length} moves to lib/prep-data.json`);
