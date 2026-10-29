// Read and write Pokémon Showdown's team text format:
//
//   Garchomp @ Choice Scarf
//   Ability: Rough Skin
//   Tera Type: Steel
//   EVs: 252 Atk / 4 SpD / 252 Spe
//   Jolly Nature
//   - Earthquake
//
// In Pokémon Champions the "EVs:" numbers are stat points (0–32).

export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
export type Stats = Record<StatKey, number>;

export const STAT_KEYS: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];
export const STAT_LABEL: Record<StatKey, string> = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
const LABEL_TO_KEY: Record<string, StatKey> = { hp: "hp", atk: "atk", def: "def", spa: "spa", spd: "spd", spe: "spe" };

export type CalcSet = {
  species: string;
  nickname?: string;
  item: string;
  ability: string;
  level: number;
  nature: string;
  evs: Stats;
  ivs: Stats;
  teraType?: string;
  moves: string[];
};

export const zeroStats = (): Stats => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
export const maxIvs = (): Stats => ({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });

function parseStatLine(text: string, into: Stats) {
  for (const part of text.split("/")) {
    const m = /^\s*(\d+)\s+([A-Za-z]+)\s*$/.exec(part);
    if (!m) continue;
    const key = LABEL_TO_KEY[m[2].toLowerCase()];
    if (key) into[key] = Number(m[1]);
  }
}

function parseOne(block: string, defaultLevel: number): CalcSet | null {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  // "Nickname (Species) (M) @ Item"
  const [rawHead, item = ""] = lines[0].split(" @ ");
  const head = rawHead.replace(/\s*\((M|F)\)\s*$/, "").trim();
  let species = head;
  let nickname: string | undefined;
  const nick = /^(.*)\(([^()]+)\)$/.exec(head);
  if (nick) {
    nickname = nick[1].trim();
    species = nick[2].trim();
  }
  if (!species) return null;

  const set: CalcSet = {
    species,
    nickname,
    item: item.trim(),
    ability: "",
    level: defaultLevel,
    nature: "Serious",
    evs: zeroStats(),
    ivs: maxIvs(),
    moves: [],
  };

  for (const line of lines.slice(1)) {
    if (line.startsWith("Ability:")) set.ability = line.slice(8).trim();
    else if (line.startsWith("Level:")) set.level = Number(line.slice(6)) || defaultLevel;
    else if (line.startsWith("Tera Type:")) set.teraType = line.slice(10).trim();
    else if (line.startsWith("EVs:")) parseStatLine(line.slice(4), set.evs);
    else if (line.startsWith("IVs:")) parseStatLine(line.slice(4), set.ivs);
    else if (/ Nature$/.test(line)) set.nature = line.replace(/ Nature$/, "").trim();
    else if (line.startsWith("-") || line.startsWith("~")) {
      const move = line.slice(1).trim().split(" / ")[0].replace(/^Hidden Power \[(\w+)\]$/, "Hidden Power $1");
      if (move && set.moves.length < 4) set.moves.push(move);
    }
  }
  return set;
}

/** Parse a pasted team (or a single set). Blank lines separate Pokémon. */
export function parseTeam(text: string, defaultLevel = 100): CalcSet[] {
  return text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((b) => b.replace(/^=== .* ===$/m, "")) // teambuilder headers
    .map((b) => parseOne(b, defaultLevel))
    .filter((s): s is CalcSet => !!s);
}

function statLine(stats: Stats, skip: number) {
  return STAT_KEYS.filter((k) => stats[k] !== skip).map((k) => `${stats[k]} ${STAT_LABEL[k]}`).join(" / ");
}

export function exportSet(set: CalcSet, opts: { champions?: boolean } = {}): string {
  const lines: string[] = [];
  const name = set.nickname && set.nickname !== set.species ? `${set.nickname} (${set.species})` : set.species;
  lines.push(set.item ? `${name} @ ${set.item}` : name);
  if (set.ability) lines.push(`Ability: ${set.ability}`);
  if (!opts.champions && set.level !== 100) lines.push(`Level: ${set.level}`);
  if (set.teraType) lines.push(`Tera Type: ${set.teraType}`);
  const evs = statLine(set.evs, 0);
  if (evs) lines.push(`EVs: ${evs}`);
  lines.push(`${set.nature} Nature`);
  if (!opts.champions) {
    const ivs = statLine(set.ivs, 31);
    if (ivs) lines.push(`IVs: ${ivs}`);
  }
  for (const m of set.moves) if (m) lines.push(`- ${m.replace(/^Hidden Power (\w+)$/, "Hidden Power [$1]")}`);
  return lines.join("\n");
}
