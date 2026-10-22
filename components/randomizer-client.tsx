"use client";

import { useState, useCallback, useTransition } from "react";
import { RefreshCw, Lock, Unlock, Dices, ArrowRight } from "lucide-react";
import type { Pokemon } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormatOption = {
  label: string;
  value: string;
  url: string | null;
};

const FORMAT_OPTIONS: FormatOption[] = [
  { label: "All Pokémon (no restriction)",  value: "all",      url: null },
  { label: "Gen 9 National Dex",            value: "gen9",     url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/formats-data.ts" },
  { label: "Pokémon Champions",             value: "champs",   url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/champions/formats-data.ts" },
  { label: "Gen 8 National Dex",            value: "gen8",     url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen8/formats-data.ts" },
  { label: "Gen 7 National Dex",            value: "gen7",     url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen7/formats-data.ts" },
  { label: "Gen 6 National Dex",            value: "gen6",     url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen6/formats-data.ts" },
  { label: "Gen 5 National Dex",            value: "gen5",     url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen5/formats-data.ts" },
  { label: "Gen 4 National Dex",            value: "gen4",     url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen4/formats-data.ts" },
  { label: "Gen 3 National Dex",            value: "gen3",     url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen3/formats-data.ts" },
  { label: "Gen 2 National Dex",            value: "gen2",     url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen2/formats-data.ts" },
  { label: "Gen 1 National Dex",            value: "gen1",     url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen1/formats-data.ts" },
];

const ALL_TYPES = [
  "Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison",
  "Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy",
];

const TYPE_COLORS: Record<string, string> = {
  Normal:"bg-gray-400",Fire:"bg-orange-500",Water:"bg-blue-500",Electric:"bg-yellow-400",
  Grass:"bg-green-500",Ice:"bg-cyan-300",Fighting:"bg-red-600",Poison:"bg-purple-500",
  Ground:"bg-yellow-600",Flying:"bg-indigo-400",Psychic:"bg-pink-500",Bug:"bg-lime-500",
  Rock:"bg-yellow-700",Ghost:"bg-purple-700",Dragon:"bg-indigo-600",Dark:"bg-gray-700",
  Steel:"bg-gray-500",Fairy:"bg-pink-300",
};

type StageFilter = "any" | "final" | "nfe" | "base" | "middle";
// final  = can't evolve further (includes Pokémon that never evolve)
// nfe    = can still evolve
// base   = first stage of a line that evolves (no prevo, has evos)
// middle = evolved once and can evolve again (has prevo + evos)

/** Highest National Dex number available in each generation. */
const GEN_MAX_DEX: Record<string, number> = {
  gen1: 151, gen2: 251, gen3: 386, gen4: 493, gen5: 649,
  gen6: 721, gen7: 809, gen8: 905,
};

/** Evolution stages follow the selected generation; "all", gen9 and champs use the latest games. */
function maxDexForFormat(format: string): number {
  return GEN_MAX_DEX[format] ?? Infinity;
}

// ─── Showdown data fetchers ────────────────────────────────────────────────────

const fetchCache = new Map<string, Promise<unknown>>();

function cachedFetch<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!fetchCache.has(key)) fetchCache.set(key, fn());
  return fetchCache.get(key) as Promise<T>;
}

/** Fetch a Showdown data file via the server-side proxy (avoids CORS). */
async function fetchShowdown(url: string): Promise<string> {
  const res = await fetch(`/api/showdown?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Failed to fetch Showdown data (${res.status})`);
  return res.text();
}

/** Returns Set of lowercase Pokémon names that are legal in the format (not Illegal / nonstandard). */
async function fetchLegalSet(url: string): Promise<Set<string>> {
  return cachedFetch(`legal:${url}`, async () => {
    const text = await fetchShowdown(url);
    const legal = new Set<string>();
    const re = /^\s{0,4}(\w+)\s*:\s*\{([^}]*)\}/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const name = m[1].toLowerCase();
      const body = m[2];
      if (/tier\s*:\s*["']Illegal["']/.test(body)) continue;
      if (/isNonstandard\s*:/.test(body)) continue;
      legal.add(name);
    }
    return legal;
  });
}

/** One Showdown pokedex entry, reduced to what we need for evolution stages. */
type EvoEntry = {
  num: number;
  isForme: boolean;      // alternate forme (regional, mega, etc.)
  prevo: string | null;  // Showdown id of what it evolves from
  evos: string[];        // Showdown ids of what it evolves into
};

type EvoData = {
  byId: Map<string, EvoEntry>;
  baseIdByNum: Map<number, string>; // dex number → base-forme id (fallback lookup)
};

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function fetchEvoData(): Promise<EvoData> {
  return cachedFetch("evodata", async () => {
    const url = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/pokedex.ts";
    const text = await fetchShowdown(url);
    const byId = new Map<string, EvoEntry>();
    const baseIdByNum = new Map<number, string>();

    // Each top-level entry looks like:
    //   \tpokemonname: {
    //     num: 25, ..., prevo: "Pichu", evos: ["Raichu", "Raichu-Alola"], ...
    //   },
    // Track brace depth so we only read fields that belong to the entry itself.
    const entryStart = /^\t([a-z0-9]+)\s*:\s*\{/i;
    let currentId = "";
    let depth = 0;
    let entry: EvoEntry = { num: 0, isForme: false, prevo: null, evos: [] };

    const finish = () => {
      if (!currentId) return;
      byId.set(currentId, entry);
      if (!entry.isForme && entry.num > 0 && !baseIdByNum.has(entry.num)) {
        baseIdByNum.set(entry.num, currentId);
      }
      currentId = "";
    };

    for (const line of text.split("\n")) {
      if (depth === 0) {
        const m = entryStart.exec(line);
        if (!m) continue;
        currentId = m[1].toLowerCase();
        entry = { num: 0, isForme: false, prevo: null, evos: [] };
        depth = 1;
        for (let i = line.indexOf("{") + 1; i < line.length; i++) {
          if (line[i] === "{") depth++;
          else if (line[i] === "}") { depth--; if (depth === 0) { finish(); break; } }
        }
        continue;
      }

      if (depth === 1) {
        const num = /^\s*num\s*:\s*(-?\d+)/.exec(line);
        if (num) entry.num = Number(num[1]);
        if (/^\s*forme\s*:/.test(line)) entry.isForme = true;
        const prevo = /^\s*prevo\s*:\s*["']([^"']+)["']/.exec(line);
        if (prevo) entry.prevo = toId(prevo[1]);
        const evos = /^\s*evos\s*:\s*\[([^\]]*)\]/.exec(line);
        if (evos) {
          entry.evos = Array.from(evos[1].matchAll(/["']([^"']+)["']/g), (x) => toId(x[1]));
        }
      }

      for (const ch of line) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) { finish(); break; }
        }
      }
    }

    return { byId, baseIdByNum };
  });
}

const REGION_PREFIXES: [RegExp, string][] = [
  [/\balolan\b/i,   "alola"],
  [/\bgalarian\b/i, "galar"],
  [/\bhisuian\b/i,  "hisui"],
  [/\bpaldean\b/i,  "paldea"],
];

/** Find the Showdown entry for one of our Pokémon (name → regional rewrite → dex number). */
function findEvoEntry(p: Pokemon, data: EvoData): EvoEntry | undefined {
  const direct = data.byId.get(toId(p.name));
  if (direct) return direct;

  // "Galarian Corsola" / "Corsola (Galarian Form)" → "corsolagalar"
  for (const [re, suffix] of REGION_PREFIXES) {
    if (re.test(p.name)) {
      const base = toId(p.name.replace(re, "").replace(/\bform\b/i, ""));
      const regional = data.byId.get(base + suffix);
      if (regional) return regional;
    }
  }

  // Fall back to the base species by dex number
  const baseId = data.baseIdByNum.get(p.dexNumber);
  return baseId ? data.byId.get(baseId) : undefined;
}

/** Does this Pokémon still evolve / have a pre-evolution, counting only Pokémon that exist by maxDex? */
function evoInfo(entry: EvoEntry, data: EvoData, maxDex: number) {
  const exists = (id: string) => {
    const e = data.byId.get(id);
    return !e || e.num <= maxDex; // unknown id → assume it exists
  };
  return {
    hasPrev: entry.prevo !== null && exists(entry.prevo),
    hasEvos: entry.evos.some(exists),
  };
}

function normalizeForShowdown(name: string): string {
  return toId(name);
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function PokemonResultCard({
  pokemon,
  locked,
  onToggleLock,
}: {
  pokemon: Pokemon;
  locked: boolean;
  onToggleLock: () => void;
}) {
  const typeColor = TYPE_COLORS[pokemon.primaryType] ?? "bg-gray-500";
  return (
    <div className={`relative rounded-xl border bg-card p-4 flex flex-col items-center gap-2 transition-all ${locked ? "ring-2 ring-yellow-400" : ""}`}>
      <button
        onClick={onToggleLock}
        className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${locked ? "text-yellow-400 hover:text-yellow-300" : "text-muted-foreground hover:text-foreground"}`}
        title={locked ? "Unlock" : "Lock this Pokémon"}
      >
        {locked ? <Lock size={16} /> : <Unlock size={16} />}
      </button>
      <div className="h-20 w-20 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pokemon.spriteUrl} alt={pokemon.name} className="h-full w-full object-contain" style={{ imageRendering: "pixelated" }} />
      </div>
      <p className="font-bold text-sm text-center leading-tight">{pokemon.name}</p>
      <div className="flex gap-1 flex-wrap justify-center">
        <span className={`${typeColor} rounded px-2 py-0.5 text-xs font-semibold text-white uppercase`}>{pokemon.primaryType}</span>
        {pokemon.secondaryType && (
          <span className={`${TYPE_COLORS[pokemon.secondaryType] ?? "bg-gray-500"} rounded px-2 py-0.5 text-xs font-semibold text-white uppercase`}>{pokemon.secondaryType}</span>
        )}
      </div>
      <p className="text-muted-foreground text-xs">{pokemon.pointValue} pts</p>
      <p className="text-muted-foreground text-xs">BST {pokemon.bst}</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function RandomizerClient({ allPokemon }: { allPokemon: Pokemon[] }) {
  // Filters
  const [count, setCount]               = useState(6);
  const [minPts, setMinPts]             = useState<number | "">(1);
  const [maxPts, setMaxPts]             = useState<number | "">(20);
  const [minBst, setMinBst]             = useState<number | "">(200);
  const [maxBst, setMaxBst]             = useState<number | "">(700);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [allowLegendary, setAllowLegendary] = useState(false);
  const [allowMythical,  setAllowMythical]  = useState(false);
  const [allowParadox,   setAllowParadox]   = useState(false);
  const [formatValue, setFormatValue]   = useState("all");
  const [budgetCap, setBudgetCap]       = useState<number | "">("");
  const [stageFilter, setStageFilter]   = useState<StageFilter>("any");
  // Draft legality: "legal" = only non-banned (default), "banned" = only banned, "any" = all
  const [draftLegality, setDraftLegality] = useState<"legal" | "banned" | "any">("legal");

  // Results
  const [results, setResults]   = useState<Pokemon[]>([]);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sendSuccess, setSendSuccess] = useState(false);

  const toggleType = (t: string) =>
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const toggleLock = (id: string) =>
    setLockedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });

  // Send locked Pokémon to Draft page via sessionStorage
  const sendToDraft = () => {
    const locked = results.filter(r => lockedIds.has(r.id));
    if (locked.length === 0) return;
    try {
      sessionStorage.setItem("randomizer_picks", JSON.stringify(locked.map(p => p.id)));
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch {
      // sessionStorage unavailable
    }
    // Navigate to draft
    window.location.href = "/draft";
  };

  const randomize = useCallback(() => {
    startTransition(async () => {
      setError(null);
      setSendSuccess(false);
      try {
        // 1. Format legality
        let legalSet: Set<string> | null = null;
        const fmt = FORMAT_OPTIONS.find(f => f.value === formatValue);
        if (fmt?.url) legalSet = await fetchLegalSet(fmt.url);

        // 2. Evo stage (fetch only if needed)
        let evoData: EvoData | null = null;
        if (stageFilter !== "any") evoData = await fetchEvoData();

        // 3. Base pool — apply draft legality filter
        let pool: Pokemon[];
        if (draftLegality === "legal") {
          pool = allPokemon.filter(p => !p.banned);
        } else if (draftLegality === "banned") {
          pool = allPokemon.filter(p => p.banned);
        } else {
          pool = [...allPokemon];
        }

        // 4. Point range
        if (minPts !== "") pool = pool.filter(p => p.pointValue >= (minPts as number));
        if (maxPts !== "") pool = pool.filter(p => p.pointValue <= (maxPts as number));

        // 5. BST range
        if (minBst !== "") pool = pool.filter(p => (p.bst ?? 0) >= (minBst as number));
        if (maxBst !== "") pool = pool.filter(p => (p.bst ?? 0) <= (maxBst as number));

        // 6. Type filter
        if (selectedTypes.length > 0) {
          pool = pool.filter(p =>
            selectedTypes.includes(p.primaryType) ||
            (p.secondaryType && selectedTypes.includes(p.secondaryType))
          );
        }

        // 7. Category
        if (!allowLegendary) pool = pool.filter(p => !p.legendary);
        if (!allowMythical)  pool = pool.filter(p => !p.mythical);
        if (!allowParadox)   pool = pool.filter(p => !p.paradox);

        // 8. Format legality
        if (legalSet) pool = pool.filter(p => legalSet!.has(normalizeForShowdown(p.name)));

        // 9. Evo stage filter
        if (stageFilter !== "any" && evoData) {
          const maxDex = maxDexForFormat(formatValue);
          pool = pool.filter(p => {
            const entry = findEvoEntry(p, evoData!);
            // Unmatched names stay in the pool and are treated as fully evolved
            if (!entry) return stageFilter === "final";
            const { hasPrev, hasEvos } = evoInfo(entry, evoData!, maxDex);
            switch (stageFilter) {
              case "final":  return !hasEvos;
              case "nfe":    return hasEvos;
              case "base":   return !hasPrev && hasEvos;
              case "middle": return hasPrev && hasEvos;
              default:       return true;
            }
          });
        }

        // 10. Assemble: keep locked, pick rest
        const locked = results.filter(r => lockedIds.has(r.id));
        const lockedPts = locked.reduce((s, p) => s + p.pointValue, 0);
        const needed = count - locked.length;

        if (needed < 0) {
          setError(`${locked.length} locked but only want ${count}. Unlock some first.`);
          return;
        }

        const lockedIdSet = new Set(locked.map(p => p.id));
        let remaining = pool.filter(p => !lockedIdSet.has(p.id));

        if (remaining.length < needed) {
          setError(`Only ${remaining.length} Pokémon match your filters (need ${needed}). Loosen the filters.`);
          return;
        }

        // 11. Budget cap
        if (budgetCap !== "" && needed > 0) {
          const ptsLeft = (budgetCap as number) - lockedPts;
          remaining = remaining.sort(() => Math.random() - 0.5);
          const picked: Pokemon[] = [];
          let spent = 0;
          for (const p of remaining) {
            if (picked.length >= needed) break;
            if (spent + p.pointValue <= ptsLeft) { picked.push(p); spent += p.pointValue; }
          }
          if (picked.length < needed) {
            setError(`Budget too tight — only ${picked.length} fit within ${ptsLeft} pts. Increase budget or loosen filters.`);
            return;
          }
          setResults([...locked, ...picked]);
          return;
        }

        // 12. Simple pick
        const shuffled = [...remaining].sort(() => Math.random() - 0.5);
        setResults([...locked, ...shuffled.slice(0, needed)]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }, [allPokemon, count, minPts, maxPts, minBst, maxBst, selectedTypes,
      allowLegendary, allowMythical, allowParadox, formatValue, budgetCap,
      stageFilter, draftLegality, results, lockedIds]);

  const lockedCount = results.filter(r => lockedIds.has(r.id)).length;

  return (
    <div className="space-y-6">
      {/* ── Filters ── */}
      <div className="rounded-xl border bg-card p-5 space-y-5">
        <h2 className="font-semibold text-base">Filters</h2>

        {/* Row 1: Count + Format */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Number of Pokémon ({count})</label>
            <input type="range" min={1} max={12} value={count} onChange={e => setCount(Number(e.target.value))} className="w-full accent-blue-500" />
            <div className="flex justify-between text-xs text-muted-foreground"><span>1</span><span>12</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Format / Generation</label>
            <select value={formatValue} onChange={e => setFormatValue(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              {FORMAT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Stage + Draft Legality */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Evolution Stage</label>
            <div className="flex flex-wrap gap-2">
              {([
                ["Any",               "any"],
                ["Fully Evolved",     "final"],
                ["Not Fully Evolved", "nfe"],
                ["Base Stage",        "base"],
                ["Middle Stage",      "middle"],
              ] as [string, StageFilter][]).map(([label, val]) => (
                <button
                  key={val}
                  onClick={() => setStageFilter(val)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${stageFilter === val ? "bg-blue-600 border-blue-600 text-white" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Draft Legality</label>
            <div className="flex flex-wrap gap-2">
              {([
                ["Draft Legal Only",   "legal",  "For use in league draft"],
                ["Banned Only",        "banned", "Legendaries/etc. for fun battles"],
                ["All (ignore ban)",   "any",    "No restriction"],
              ] as [string, "legal"|"banned"|"any", string][]).map(([label, val, hint]) => (
                <button
                  key={val}
                  onClick={() => setDraftLegality(val)}
                  title={hint}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${draftLegality === val ? "bg-blue-600 border-blue-600 text-white" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {draftLegality === "banned" && (
              <p className="mt-1.5 text-xs text-yellow-400/80">Showing Pokémon banned from your draft (legendaries, mythicals, etc.)</p>
            )}
          </div>
        </div>

        {/* Row 3: Points + BST */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Min Pts</label>
            <input type="number" min={1} max={20} value={minPts} onChange={e => setMinPts(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Max Pts</label>
            <input type="number" min={1} max={20} value={maxPts} onChange={e => setMaxPts(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Min BST</label>
            <input type="number" min={100} max={800} value={minBst} onChange={e => setMinBst(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Max BST</label>
            <input type="number" min={100} max={800} value={maxBst} onChange={e => setMaxBst(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </div>
        </div>

        {/* Row 4: Budget Cap */}
        <div className="flex items-center gap-3">
          <div className="w-48">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Budget Cap (optional)</label>
            <input type="number" min={1} max={999} placeholder="e.g. 105" value={budgetCap} onChange={e => setBudgetCap(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">Total points of all picks must not exceed this value.</p>
        </div>

        {/* Row 5: Types */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Type Filter (leave empty for all)</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_TYPES.map(t => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`rounded px-2.5 py-1 text-xs font-semibold uppercase transition-opacity ${TYPE_COLORS[t] ?? "bg-gray-500"} text-white ${selectedTypes.includes(t) ? "opacity-100 ring-2 ring-white" : "opacity-40 hover:opacity-70"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Row 6: Categories */}
        <div className="flex flex-wrap gap-4">
          {([
            ["Include Legendaries", allowLegendary, setAllowLegendary],
            ["Include Mythicals",   allowMythical,  setAllowMythical],
            ["Include Paradox",     allowParadox,   setAllowParadox],
          ] as [string, boolean, (v: boolean) => void][]).map(([label, val, setter]) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer select-none text-sm">
              <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} className="h-4 w-4 rounded accent-blue-500" />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* ── Action Row ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={randomize}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-bold text-white shadow transition hover:bg-blue-500 disabled:opacity-50"
        >
          {isPending
            ? <><RefreshCw size={18} className="animate-spin" /> Randomizing…</>
            : <><Dices size={18} /> Randomize!</>
          }
        </button>

        {/* Send to Draft button — only shown when there are locked picks */}
        {lockedCount > 0 && (
          <button
            onClick={sendToDraft}
            className="flex items-center gap-2 rounded-lg border border-green-500 bg-green-500/10 px-5 py-3 text-sm font-semibold text-green-400 transition hover:bg-green-500/20"
          >
            <ArrowRight size={16} />
            Send {lockedCount} locked to Draft
          </button>
        )}

        {sendSuccess && (
          <span className="text-xs text-green-400">Sent! Redirecting to Draft…</span>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* ── Results ── */}
      {results.length > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {results.map(p => (
              <PokemonResultCard
                key={p.id}
                pokemon={p}
                locked={lockedIds.has(p.id)}
                onToggleLock={() => toggleLock(p.id)}
              />
            ))}
          </div>
        </div>
      ) : !error ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <Dices size={48} className="mb-4 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">Set your filters and hit Randomize!</p>
          <p className="text-xs text-muted-foreground mt-1 opacity-60">Lock individual results to keep them on re-rolls. Send locked picks to the Draft page.</p>
        </div>
      ) : null}
    </div>
  );
}
