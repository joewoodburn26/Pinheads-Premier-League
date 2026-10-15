"use client";

import { useState, useCallback, useTransition } from "react";
import { RefreshCw, Lock, Unlock, Dices } from "lucide-react";
import type { Pokemon } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormatOption = {
  label: string;
  value: string;    // e.g. "gen9" | "gen8" | … | "all"
  url: string | null;
};

const FORMAT_OPTIONS: FormatOption[] = [
  { label: "All Pokémon (no restriction)", value: "all", url: null },
  { label: "Gen 9 National Dex", value: "gen9", url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/formats-data.ts" },
  { label: "Gen 8 National Dex", value: "gen8", url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen8/formats-data.ts" },
  { label: "Gen 7 National Dex", value: "gen7", url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen7/formats-data.ts" },
  { label: "Gen 6 National Dex", value: "gen6", url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen6/formats-data.ts" },
  { label: "Gen 5 National Dex", value: "gen5", url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen5/formats-data.ts" },
  { label: "Gen 4 National Dex", value: "gen4", url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen4/formats-data.ts" },
  { label: "Gen 3 National Dex", value: "gen3", url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen3/formats-data.ts" },
  { label: "Gen 2 National Dex", value: "gen2", url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen2/formats-data.ts" },
  { label: "Gen 1 National Dex", value: "gen1", url: "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen1/formats-data.ts" },
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

// ─── Showdown parser ──────────────────────────────────────────────────────────

/** Returns a Set of lowercase Pokémon names that are legal in the format. */
async function fetchLegalSet(url: string): Promise<Set<string>> {
  const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Failed to fetch format data (${res.status})`);
  const text = await res.text();

  const legal = new Set<string>();
  // Parse entries like:  bulbasaur: { tier: "LC", ... }
  // or                   bulbasaur: { isNonstandard: "Past", tier: "Illegal", ... }
  const entryRe = /^\s{0,4}(\w+)\s*:\s*\{([^}]*)\}/gm;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(text)) !== null) {
    const name = m[1].toLowerCase();
    const body = m[2];
    // Skip if tier is Illegal or isNonstandard is present
    if (/tier\s*:\s*["']Illegal["']/.test(body)) continue;
    if (/isNonstandard\s*:/.test(body)) continue;
    legal.add(name);
  }
  return legal;
}

// Normalize a Pokémon name to the key used in formats-data
// e.g. "Miraidon" → "miraidon", "Wo-Chien" → "wochien"
function normalizeForShowdown(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// ─── Randomizer Card ─────────────────────────────────────────────────────────

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
      {/* Lock button */}
      <button
        onClick={onToggleLock}
        className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${locked ? "text-yellow-400 hover:text-yellow-300" : "text-muted-foreground hover:text-foreground"}`}
        title={locked ? "Unlock" : "Lock this Pokémon"}
      >
        {locked ? <Lock size={16} /> : <Unlock size={16} />}
      </button>

      {/* Sprite */}
      <div className="h-20 w-20 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pokemon.spriteUrl}
          alt={pokemon.name}
          className="h-full w-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      {/* Name */}
      <p className="font-bold text-sm text-center leading-tight">{pokemon.name}</p>

      {/* Types */}
      <div className="flex gap-1 flex-wrap justify-center">
        <span className={`${typeColor} rounded px-2 py-0.5 text-xs font-semibold text-white uppercase`}>
          {pokemon.primaryType}
        </span>
        {pokemon.secondaryType && (
          <span className={`${TYPE_COLORS[pokemon.secondaryType] ?? "bg-gray-500"} rounded px-2 py-0.5 text-xs font-semibold text-white uppercase`}>
            {pokemon.secondaryType}
          </span>
        )}
      </div>

      {/* Point value */}
      <p className="text-muted-foreground text-xs">{pokemon.pointValue} pts</p>

      {/* BST */}
      <p className="text-muted-foreground text-xs">BST {pokemon.bst}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RandomizerClient({ allPokemon }: { allPokemon: Pokemon[] }) {
  // Filters
  const [count, setCount] = useState(6);
  const [minPts, setMinPts] = useState<number | "">(1);
  const [maxPts, setMaxPts] = useState<number | "">(20);
  const [minBst, setMinBst] = useState<number | "">(200);
  const [maxBst, setMaxBst] = useState<number | "">(700);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [allowLegendary, setAllowLegendary] = useState(false);
  const [allowMythical, setAllowMythical] = useState(false);
  const [allowParadox, setAllowParadox] = useState(false);
  const [formatValue, setFormatValue] = useState("gen9");
  const [budgetCap, setBudgetCap] = useState<number | "">("");

  // State
  const [results, setResults] = useState<Pokemon[]>([]);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleType = (t: string) => {
    setSelectedTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const toggleLock = (id: string) => {
    setLockedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const randomize = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        // 1. Get legal set from Showdown if needed
        let legalSet: Set<string> | null = null;
        const fmt = FORMAT_OPTIONS.find(f => f.value === formatValue);
        if (fmt?.url) {
          legalSet = await fetchLegalSet(fmt.url);
        }

        // 2. Build candidate pool from non-banned Pokémon
        let pool = allPokemon.filter(p => !p.banned);

        // 3. Apply point range
        if (minPts !== "") pool = pool.filter(p => p.pointValue >= (minPts as number));
        if (maxPts !== "") pool = pool.filter(p => p.pointValue <= (maxPts as number));

        // 4. Apply BST range
        if (minBst !== "") pool = pool.filter(p => (p.bst ?? 0) >= (minBst as number));
        if (maxBst !== "") pool = pool.filter(p => (p.bst ?? 0) <= (maxBst as number));

        // 5. Apply type filter (must have at least one matching type)
        if (selectedTypes.length > 0) {
          pool = pool.filter(p =>
            selectedTypes.includes(p.primaryType) ||
            (p.secondaryType && selectedTypes.includes(p.secondaryType))
          );
        }

        // 6. Apply category restrictions
        if (!allowLegendary) pool = pool.filter(p => !p.legendary);
        if (!allowMythical)  pool = pool.filter(p => !p.mythical);
        if (!allowParadox)   pool = pool.filter(p => !p.paradox);

        // 7. Apply format legality (hard restriction)
        if (legalSet) {
          pool = pool.filter(p => legalSet!.has(normalizeForShowdown(p.name)));
        }

        // 8. Keep locked Pokémon, pick from remainder
        const locked = results.filter(r => lockedIds.has(r.id));
        const lockedPts = locked.reduce((sum, p) => sum + p.pointValue, 0);
        const needed = count - locked.length;

        if (needed < 0) {
          setError(`You have ${locked.length} locked Pokémon but only want ${count} total. Unlock some first.`);
          return;
        }

        // Remove locked from pool so we don't double-pick
        const lockedIdSet = new Set(locked.map(p => p.id));
        let remaining = pool.filter(p => !lockedIdSet.has(p.id));

        if (remaining.length < needed) {
          setError(`Only ${remaining.length} Pokémon match your filters (need ${needed} more). Loosen the filters.`);
          return;
        }

        // 9. Budget cap: if set, respect it for the picks (locked pts already counted)
        if (budgetCap !== "" && needed > 0) {
          const ptsLeft = (budgetCap as number) - lockedPts;
          // Simple greedy random: shuffle then pick greedily within budget
          remaining = remaining.sort(() => Math.random() - 0.5);
          const picked: Pokemon[] = [];
          let spent = 0;
          for (const p of remaining) {
            if (picked.length >= needed) break;
            if (spent + p.pointValue <= ptsLeft) {
              picked.push(p);
              spent += p.pointValue;
            }
          }
          if (picked.length < needed) {
            setError(`Budget too tight — only found ${picked.length} Pokémon within ${ptsLeft} pts. Increase the budget cap or loosen filters.`);
            return;
          }
          setResults([...locked, ...picked]);
          return;
        }

        // 10. Simple random pick (no budget cap)
        const shuffled = [...remaining].sort(() => Math.random() - 0.5);
        const picked = shuffled.slice(0, needed);
        setResults([...locked, ...picked]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }, [allPokemon, count, minPts, maxPts, minBst, maxBst, selectedTypes,
      allowLegendary, allowMythical, allowParadox, formatValue, budgetCap,
      results, lockedIds]);

  const totalPts = results.reduce((s, p) => s + p.pointValue, 0);

  return (
    <div className="space-y-6">
      {/* ── Filter Panel ── */}
      <div className="rounded-xl border bg-card p-5 space-y-5">
        <h2 className="font-semibold text-base">Filters</h2>

        {/* Row 1: Count + Format */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Number of Pokémon ({count})
            </label>
            <input
              type="range" min={1} max={12} value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span><span>12</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Format / Generation (Legal Pokémon only)
            </label>
            <select
              value={formatValue}
              onChange={e => setFormatValue(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {FORMAT_OPTIONS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Points + Budget */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Min Pts</label>
            <input
              type="number" min={1} max={20}
              value={minPts}
              onChange={e => setMinPts(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Max Pts</label>
            <input
              type="number" min={1} max={20}
              value={maxPts}
              onChange={e => setMaxPts(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Min BST</label>
            <input
              type="number" min={100} max={800}
              value={minBst}
              onChange={e => setMinBst(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Max BST</label>
            <input
              type="number" min={100} max={800}
              value={maxBst}
              onChange={e => setMaxBst(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Row 3: Budget Cap */}
        <div className="flex items-center gap-3">
          <div className="w-48">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Budget Cap (optional)
            </label>
            <input
              type="number" min={1} max={999} placeholder="e.g. 105"
              value={budgetCap}
              onChange={e => setBudgetCap(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            If set, total points of all picked Pokémon must not exceed this value.
          </p>
        </div>

        {/* Row 4: Type filter */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">
            Type Filter (must have at least one selected type — leave empty for all)
          </label>
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

        {/* Row 5: Category toggles */}
        <div className="flex flex-wrap gap-4">
          {([
            ["Include Legendaries", allowLegendary, setAllowLegendary],
            ["Include Mythicals",   allowMythical,  setAllowMythical],
            ["Include Paradox",     allowParadox,   setAllowParadox],
          ] as [string, boolean, (v: boolean) => void][]).map(([label, val, setter]) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer select-none text-sm">
              <input
                type="checkbox" checked={val}
                onChange={e => setter(e.target.checked)}
                className="h-4 w-4 rounded accent-blue-500"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* ── Randomize Button ── */}
      <div className="flex items-center gap-4">
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
        {results.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {results.length} Pokémon · <span className="font-semibold text-foreground">{totalPts} pts total</span>
            {lockedIds.size > 0 && ` · ${lockedIds.size} locked`}
          </p>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Results Grid ── */}
      {results.length > 0 && (
        <div>
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

          {/* Summary row */}
          <div className="mt-4 flex flex-wrap gap-6 rounded-xl border bg-card px-5 py-3 text-sm">
            <div>
              <span className="text-muted-foreground">Total pts: </span>
              <span className="font-bold">{totalPts}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Avg BST: </span>
              <span className="font-bold">
                {Math.round(results.reduce((s, p) => s + (p.bst ?? 0), 0) / results.length)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Types covered: </span>
              <span className="font-bold">
                {Array.from(new Set(results.flatMap(p => [p.primaryType, p.secondaryType].filter(Boolean)))).length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {results.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <Dices size={48} className="mb-4 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">Set your filters and hit Randomize!</p>
          <p className="text-xs text-muted-foreground mt-1 opacity-60">Lock individual results to keep them on re-rolls.</p>
        </div>
      )}
    </div>
  );
}
