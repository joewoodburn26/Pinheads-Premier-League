// Smogon's analysis sets, loaded in the browser from data.pkmn.cc — the same
// data the Showdown calculator ships. Shape: { Species: { tier: { setName: set } } }.

import { maxIvs, zeroStats, type CalcSet, type StatKey, type Stats } from "@/lib/showdown-text";

type RawStats = Partial<Record<StatKey, number>>;
type RawSet = {
  moves?: (string | string[])[];
  ability?: string | string[];
  item?: string | string[];
  nature?: string | string[];
  teraType?: string | string[];
  teratypes?: string | string[];
  evs?: RawStats | RawStats[];
  ivs?: RawStats | RawStats[];
  level?: number;
};
type SetsFile = Record<string, Record<string, Record<string, RawSet>>>;

export type NamedSet = { label: string; set: CalcSet };

const files = new Map<string, Promise<SetsFile | null>>();

function load(file: string): Promise<SetsFile | null> {
  let p = files.get(file);
  if (!p) {
    p = fetch(`https://data.pkmn.cc/sets/${file}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SetsFile>) : null))
      .catch(() => null);
    files.set(file, p);
  }
  return p;
}

const first = <T,>(v: T | T[] | undefined): T | undefined => (Array.isArray(v) ? v[0] : v);

function stats(raw: RawStats | RawStats[] | undefined, base: Stats): Stats {
  const r = first(raw) ?? {};
  return { ...base, ...r };
}

const TIER_NAMES: Record<string, string> = {
  ou: "OU", uu: "UU", ru: "RU", nu: "NU", pu: "PU", zu: "ZU", lc: "LC", ubers: "Ubers", uber: "Ubers",
  nationaldex: "NatDex OU", nationaldexubers: "NatDex Ubers", nationaldexuu: "NatDex UU", nationaldexmonotype: "NatDex Mono",
  doublesou: "Doubles OU", monotype: "Monotype", anythinggoes: "AG", "1v1": "1v1", vgc: "VGC",
};

function tierLabel(tier: string) {
  if (TIER_NAMES[tier]) return TIER_NAMES[tier];
  if (/^vgc\d+/.test(tier)) return `VGC ${tier.slice(3, 7)}`;
  if (/^battlestadium/.test(tier)) return "BSS";
  return tier.toUpperCase();
}

/** Tiers we'd rather open with, by season format. */
function tierRank(tier: string, natdex: boolean) {
  const order = natdex
    ? ["nationaldex", "nationaldexubers", "ou", "ubers", "doublesou"]
    : ["ou", "ubers", "doublesou"];
  const i = order.indexOf(tier);
  return i < 0 ? order.length + (tier.startsWith("vgc") ? 0 : 1) : i;
}

/**
 * Smogon sets for a species. `calcGen` 0 = Champions, otherwise the generation.
 * Best match for the season first. Empty when the source can't be reached.
 */
export async function smogonSets(species: string, calcGen: number, level: number, natdex: boolean): Promise<NamedSet[]> {
  const data = await load(calcGen === 0 ? "champions" : `gen${calcGen}`);
  const bySpecies = data?.[species] ?? data?.[species.replace(/-.*$/, "")];
  if (!bySpecies || typeof bySpecies !== "object") return [];

  const out: { rank: number; named: NamedSet }[] = [];
  for (const [tier, sets] of Object.entries(bySpecies)) {
    if (!sets || typeof sets !== "object") continue;
    for (const [setName, raw] of Object.entries(sets)) {
      if (!raw || !Array.isArray(raw.moves)) continue;
      const set: CalcSet = {
        species,
        item: first(raw.item) ?? "",
        ability: first(raw.ability) ?? "",
        level: raw.level ?? level,
        nature: first(raw.nature) ?? "Serious",
        evs: stats(raw.evs, zeroStats()),
        ivs: stats(raw.ivs, maxIvs()),
        teraType: first(raw.teraType ?? raw.teratypes),
        moves: raw.moves.map((m) => first(m) ?? "").filter(Boolean).slice(0, 4),
      };
      out.push({ rank: tierRank(tier, natdex), named: { label: `${tierLabel(tier)} · ${setName}`, set } });
    }
  }
  return out.sort((a, b) => a.rank - b.rank).map((o) => o.named);
}
