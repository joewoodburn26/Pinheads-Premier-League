// Season formats (shared by the Seasons and Point Restructure pages).
// Plain data, safe to import in the browser (unlike lib/dex.ts).

export const FORMAT_OPTIONS = [
  { label: "All Pokémon (no restriction)", value: "all" },
  { label: "Gen 9 National Dex", value: "gen9" },
  { label: "Pokémon Champions", value: "champs" },
  { label: "Gen 8 National Dex", value: "gen8" },
  { label: "Gen 7 National Dex", value: "gen7" },
  { label: "Gen 6 National Dex", value: "gen6" },
  { label: "Gen 5 National Dex", value: "gen5" },
  { label: "Gen 4 National Dex", value: "gen4" },
  { label: "Gen 3 National Dex", value: "gen3" },
  { label: "Gen 2 National Dex", value: "gen2" },
  { label: "Gen 1 National Dex", value: "gen1" },
] as const;

export const formatName = (format?: string) =>
  FORMAT_OPTIONS.find((f) => f.value === (format ?? "all"))?.label ?? format ?? "All Pokémon";

/** Same rule as isAvailable in lib/dex.ts, from a Pokémon's generation and Champions flag. */
export function legalIn(format: string, mon: { gen: number; champions: boolean }): boolean {
  if (format === "champs") return mon.champions;
  const gen = /^gen(\d)$/.exec(format);
  return gen ? mon.gen <= Number(gen[1]) : true;
}
