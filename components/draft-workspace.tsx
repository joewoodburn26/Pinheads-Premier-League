"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { PointEditor } from "@/components/point-editor";
import { TypeBadge } from "@/components/type-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { defenseProfile, pokemonTypes, pokemonTypesFor } from "@/lib/type-chart";
import type { Pokemon, PokemonType } from "@/lib/types";

// ── Stat bar (same as pokemon-card) ─────────────────────────────────────────

const STAT_KEYS: { key: keyof Pick<Pokemon, "hp" | "attack" | "defense" | "specialAttack" | "specialDefense" | "speed" | "bst">; label: string }[] = [
  { key: "hp",             label: "HP"     },
  { key: "attack",         label: "Atk"    },
  { key: "defense",        label: "Def"    },
  { key: "specialAttack",  label: "Sp.Atk" },
  { key: "specialDefense", label: "Sp.Def" },
  { key: "speed",          label: "Speed"  },
];

function statColor(value: number): string {
  if (value >= 150) return "bg-blue-500";
  if (value >= 120) return "bg-green-700";
  if (value >= 90)  return "bg-green-500";
  if (value >= 60)  return "bg-yellow-400";
  if (value >= 30)  return "bg-orange-400";
  return "bg-red-500";
}

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 shrink-0 text-right text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${statColor(value)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 font-mono font-semibold">{value}</span>
    </div>
  );
}

// ── Sort control ─────────────────────────────────────────────────────────────

type SortKey = "pointValue" | "bst" | "hp" | "attack" | "defense" | "specialAttack" | "specialDefense" | "speed";
type SortDir = "asc" | "desc";

function SortButton({ label, sortKey, current, dir, onClick }: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
      }`}
    >
      {label}
      {active ? (dir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : null}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [25, 50, 100, "ALL"] as const;
type PageSize = 25 | 50 | 100 | "ALL";

export function DraftWorkspace({ pokemon, budget }: { pokemon: Pokemon[]; budget: number }) {
  const legal = pokemon.filter((mon) => !mon.legendary && !mon.mythical && !mon.paradox);

  // ── Filter state ──
  const [query, setQuery]           = useState("");
  const [types, setTypes]           = useState<PokemonType[]>([]);
  const [minPts, setMinPts]         = useState("");
  const [maxPts, setMaxPts]         = useState("");

  // ── Sort state ──
  const [sortKey, setSortKey]       = useState<SortKey>("pointValue");
  const [sortDir, setSortDir]       = useState<SortDir>("desc");

  // ── Pagination state ──
  const [pageSize, setPageSize]     = useState<PageSize>(25);
  const [page, setPage]             = useState(1);

  // ── Builder state ──
  const [builder, setBuilder]       = useState<Pokemon[]>([]);

  // ── Type toggle ──
  function toggleType(type: PokemonType) {
    setTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setPage(1);
  }

  // ── Sort toggle ──
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  }

  // ── Filtered + sorted list ──
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const min = minPts === "" ? 0 : parseInt(minPts);
    const max = maxPts === "" ? Infinity : parseInt(maxPts);

    return legal
      .filter((mon) => {
        if (!mon.name.toLowerCase().includes(q)) return false;
        if (mon.pointValue < min || mon.pointValue > max) return false;
        // Multi-type: pokemon must have ALL selected types
        if (types.length > 0) {
          const monTypes = pokemonTypesFor(mon);
          if (!types.every((t) => monTypes.includes(t))) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const diff = a[sortKey] - b[sortKey];
        return sortDir === "desc" ? -diff : diff;
      });
  }, [legal, query, types, minPts, maxPts, sortKey, sortDir]);

  // ── Paginated slice ──
  const totalPages = pageSize === "ALL" ? 1 : Math.ceil(filtered.length / pageSize);
  const paginated = pageSize === "ALL" ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);

  // ── Builder stats ──
  const used = builder.reduce((sum, mon) => sum + mon.pointValue, 0);
  const avgBst = builder.length ? Math.round(builder.reduce((sum, mon) => sum + mon.bst, 0) / builder.length) : 0;
  const typeDistribution = pokemonTypes.map((t) => ({
    type: t,
    count: builder.filter((mon) => pokemonTypesFor(mon).includes(t)).length,
  })).filter((r) => r.count > 0);
  const weaknesses = pokemonTypes.map((t) => ({
    type: t,
    count: builder.filter((mon) => defenseProfile(pokemonTypesFor(mon)).weaknesses.includes(t)).length,
  })).filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  const speeds = [...builder].sort((a, b) => b.speed - a.speed);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section className="space-y-4">

        {/* ── Filter bar ── */}
        <div className="space-y-3 rounded-lg border bg-card p-4">

          {/* Row 1: Search + point range */}
          <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px]">
            <label className="relative">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
              <Input
                className="pl-9"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search Pokémon"
              />
            </label>
            <Input
              type="number"
              placeholder="Min pts"
              value={minPts}
              onChange={(e) => { setMinPts(e.target.value); setPage(1); }}
            />
            <Input
              type="number"
              placeholder="Max pts"
              value={maxPts}
              onChange={(e) => { setMaxPts(e.target.value); setPage(1); }}
            />
          </div>

          {/* Row 2: Type filter — multi-select */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Type Filter {types.length > 0 && `(${types.length} selected — must have ALL)`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {types.length > 0 && (
                <button
                  onClick={() => { setTypes([]); setPage(1); }}
                  className="rounded px-2 py-1 text-xs bg-destructive/20 text-destructive hover:bg-destructive/30"
                >
                  Clear
                </button>
              )}
              {pokemonTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`rounded-md border px-2 py-1 transition-colors ${
                    types.includes(type)
                      ? "border-primary bg-primary/20 ring-1 ring-primary"
                      : "bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <TypeBadge type={type} />
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Sort controls */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sort By
            </p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: "pointValue", label: "Points"  },
                { key: "bst",        label: "BST"     },
                { key: "hp",         label: "HP"      },
                { key: "attack",     label: "Attack"  },
                { key: "defense",    label: "Defense" },
                { key: "specialAttack",  label: "Sp.Atk" },
                { key: "specialDefense", label: "Sp.Def" },
                { key: "speed",      label: "Speed"   },
              ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                <SortButton
                  key={key}
                  label={label}
                  sortKey={key}
                  current={sortKey}
                  dir={sortDir}
                  onClick={handleSort}
                />
              ))}
            </div>
          </div>

          {/* Row 4: Results count + page size */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            <p className="text-xs text-muted-foreground">
              {filtered.length} Pokémon found
            </p>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Show:</span>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() => { setPageSize(size as PageSize); setPage(1); }}
                  className={`rounded px-2 py-1 font-medium transition-colors ${
                    pageSize === size
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Pokémon list ── */}
        <div className="space-y-3">
          {paginated.map((mon) => (
            <Card key={mon.id} className="p-4">
              <div className="flex items-start gap-4">
                {/* Sprite */}
                <Image
                  src={mon.spriteUrl}
                  alt={mon.name}
                  width={80}
                  height={80}
                  className="size-20 shrink-0 object-contain"
                />

                {/* Name + types + stats */}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold">{mon.name}</h3>
                    <div className="flex flex-wrap gap-1">
                      {pokemonTypesFor(mon).map((t) => <TypeBadge key={t} type={t} />)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {STAT_KEYS.map(({ key, label }) => (
                      <StatBar key={key} label={label} value={mon[key]} max={key === "bst" ? 720 : 255} />
                    ))}
                    {/* BST sum row */}
                    <div className="flex items-center gap-2 border-t pt-1 text-xs">
                      <span className="w-12 shrink-0 text-right font-semibold">BST</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{ width: `${Math.min(100, Math.round((mon.bst / 720) * 100))}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 font-mono font-black">{mon.bst}</span>
                    </div>
                  </div>
                </div>

                {/* Points + actions */}
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-3xl font-black leading-none">{mon.pointValue}</p>
                    <p className="text-xs text-muted-foreground">pts</p>
                  </div>
                  <PointEditor pokemonId={mon.id} value={mon.pointValue} />
                  <Button
                    variant="secondary"
                    disabled={builder.length >= 10 || builder.some((b) => b.id === mon.id)}
                    onClick={() => setBuilder([...builder, mon])}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* ── Pagination ── */}
        {pageSize !== "ALL" && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </Button>
          </div>
        )}
      </section>

      {/* ── Team Builder sidebar ── */}
      <aside className="space-y-4">
        <Card className="p-4">
          <h2 className="text-xl font-black">Team Builder</h2>
          <p className="text-sm text-muted-foreground">Client-side only. Nothing here is saved.</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-md bg-muted p-3"><b>{used}</b><br />Used</div>
            <div className="rounded-md bg-muted p-3"><b>{budget - used}</b><br />Left</div>
            <div className="rounded-md bg-muted p-3"><b>{avgBst}</b><br />Avg BST</div>
          </div>
          <div className="mt-4 space-y-2">
            {builder.map((mon) => (
              <div key={mon.id} className="flex items-center justify-between rounded-md bg-muted p-2 text-sm">
                <span>{mon.name} · {mon.pointValue}pts</span>
                <button onClick={() => setBuilder(builder.filter((b) => b.id !== mon.id))}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <h3 className="font-bold">Type Distribution</h3>
          <p className="text-sm text-muted-foreground">
            {typeDistribution.map((r) => `${r.type} ×${r.count}`).join(" · ") || "No Pokémon selected"}
          </p>
          <h3 className="font-bold">Weakness Summary</h3>
          <p className="text-sm text-muted-foreground">
            {weaknesses.slice(0, 8).map((r) => `${r.type} ×${r.count}`).join(" · ") || "No weaknesses yet"}
          </p>
          <h3 className="font-bold">Speed Tiers</h3>
          <p className="text-sm text-muted-foreground">
            {speeds.map((mon) => `${mon.name} ${mon.speed}`).join(" · ") || "No Pokémon selected"}
          </p>
        </Card>
      </aside>
    </div>
  );
}