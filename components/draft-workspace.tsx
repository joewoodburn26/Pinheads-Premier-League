"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Search, X, LayoutList, LayoutGrid, ChevronUp, ChevronDown } from "lucide-react";
import { TypeBadge } from "@/components/type-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { defenseProfile, pokemonTypes, pokemonTypesFor } from "@/lib/type-chart";
import type { Pokemon, PokemonType } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "list" | "tier";
type SortKey = "pointValue" | "bst" | "hp" | "attack" | "defense" | "specialAttack" | "specialDefense" | "speed" | "dexNumber" | "name";
type SortDir = "asc" | "desc";
type PageSize = 25 | 50 | 100 | "ALL";

// ─── Stat bar (list view) ─────────────────────────────────────────────────────

const STAT_KEYS: { key: keyof Pick<Pokemon, "hp" | "attack" | "defense" | "specialAttack" | "specialDefense" | "speed">; label: string }[] = [
  { key: "hp",             label: "HP"     },
  { key: "attack",         label: "Atk"    },
  { key: "defense",        label: "Def"    },
  { key: "specialAttack",  label: "Sp.Atk" },
  { key: "specialDefense", label: "Sp.Def" },
  { key: "speed",          label: "Speed"  },
];

function statColor(v: number) {
  if (v >= 150) return "bg-blue-500";
  if (v >= 120) return "bg-green-700";
  if (v >= 90)  return "bg-green-500";
  if (v >= 60)  return "bg-yellow-400";
  if (v >= 30)  return "bg-orange-400";
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

// ─── Sort button (list view) ──────────────────────────────────────────────────

function SortBtn({ label, sortKey, current, dir, onClick }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
    >
      {label}
      {active ? (dir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : null}
    </button>
  );
}

// ─── Tier cell (tier view) ────────────────────────────────────────────────────

function TierCell({ mon, onAdd, inBuilder }: { mon: Pokemon; onAdd: () => void; inBuilder: boolean }) {
  const types = pokemonTypesFor(mon);
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-lg border bg-card p-2 text-center cursor-pointer hover:border-primary/60 transition-colors"
      onClick={() => { if (!inBuilder) onAdd(); }}
      title={inBuilder ? "Already in team builder" : `Add ${mon.name} to builder`}
    >
      <Image src={mon.spriteUrl} alt={mon.name} width={56} height={56} className="size-12 object-contain" />
      <p className="text-xs font-semibold leading-tight">{mon.name}</p>
      <div className="flex flex-wrap justify-center gap-0.5">
        {types.map((t) => <TypeBadge key={t} type={t} />)}
      </div>
      {inBuilder && <p className="text-[10px] text-primary font-bold">✓ Added</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DraftWorkspace({ pokemon, budget }: { pokemon: Pokemon[]; budget: number }) {
  const legal = useMemo(
    () => pokemon.filter((m) => !m.legendary && !m.mythical && !m.paradox),
    [pokemon]
  );

  // ── Shared filter state (persists across view toggle) ──
  const [query, setQuery]     = useState("");
  const [types, setTypes]     = useState<PokemonType[]>([]);
  const [minPts, setMinPts]   = useState("");
  const [maxPts, setMaxPts]   = useState("");

  // ── List view state ──
  const [sortKey, setSortKey] = useState<SortKey>("dexNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [page, setPage]       = useState(1);

  // ── View toggle ──
  const [view, setView]       = useState<ViewMode>("list");

  // ── Builder (shared) ──
  const [builder, setBuilder] = useState<Pokemon[]>([]);

  // ── Type filter toggle ──
  function toggleType(t: PokemonType) {
    setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
    setPage(1);
  }

  // ── Sort toggle ──
  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir(key === "name" || key === "dexNumber" ? "asc" : "desc"); }
    setPage(1);
  }

  // ── Filtered list (shared between both views) ──
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const min = minPts === "" ? 0 : parseInt(minPts);
    const max = maxPts === "" ? Infinity : parseInt(maxPts);
    return legal.filter((m) => {
      if (!m.name.toLowerCase().includes(q)) return false;
      if (m.pointValue < min || m.pointValue > max) return false;
      if (types.length > 0) {
        const mt = pokemonTypesFor(m);
        if (!types.every((t) => mt.includes(t))) return false;
      }
      return true;
    });
  }, [legal, query, types, minPts, maxPts]);

  // ── Sorted list (list view only) ──
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortKey === "name") diff = a.name.localeCompare(b.name);
      else diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? diff : -diff;
    });
  }, [filtered, sortKey, sortDir]);

  const PAGE_SIZES: PageSize[] = [25, 50, 100, "ALL"];
  const totalPages = pageSize === "ALL" ? 1 : Math.ceil(sorted.length / (pageSize as number));
  const paginated = pageSize === "ALL" ? sorted : sorted.slice((page - 1) * (pageSize as number), page * (pageSize as number));

  // ── Tier view: group filtered by pointValue, sorted desc, alpha within tier ──
  const tierGroups = useMemo(() => {
    const byPts = new Map<number, Pokemon[]>();
    [...filtered]
      .sort((a, b) => a.name.localeCompare(b.name)) // alpha within tier
      .forEach((m) => {
        const arr = byPts.get(m.pointValue) ?? [];
        arr.push(m);
        byPts.set(m.pointValue, arr);
      });
    // Sort tiers descending (20 at top)
    return [...byPts.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  // ── Builder stats ──
  const used    = builder.reduce((s, m) => s + m.pointValue, 0);
  const avgBst  = builder.length ? Math.round(builder.reduce((s, m) => s + m.bst, 0) / builder.length) : 0;
  const typeDist = pokemonTypes.map((t) => ({ type: t, count: builder.filter((m) => pokemonTypesFor(m).includes(t)).length })).filter((r) => r.count > 0);
  const weaknesses = pokemonTypes.map((t) => ({ type: t, count: builder.filter((m) => defenseProfile(pokemonTypesFor(m)).weaknesses.includes(t)).length })).filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  const speeds  = [...builder].sort((a, b) => b.speed - a.speed);

  // ── Shared filter bar ──
  const filterBar = (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      {/* Row 1: search + points */}
      <div className="grid gap-3 sm:grid-cols-[1fr_110px_110px]">
        <label className="relative">
          <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
          <Input className="pl-9" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search Pokémon" />
        </label>
        <Input type="number" placeholder="Min pts" value={minPts} onChange={(e) => { setMinPts(e.target.value); setPage(1); }} />
        <Input type="number" placeholder="Max pts" value={maxPts} onChange={(e) => { setMaxPts(e.target.value); setPage(1); }} />
      </div>

      {/* Row 2: type filter */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Type {types.length > 0 && `(${types.length} — must have ALL)`}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {types.length > 0 && (
            <button onClick={() => { setTypes([]); setPage(1); }} className="rounded px-2 py-1 text-xs bg-destructive/20 text-destructive hover:bg-destructive/30">
              Clear
            </button>
          )}
          {pokemonTypes.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`rounded-md border px-2 py-1 transition-colors ${types.includes(t) ? "border-primary bg-primary/20 ring-1 ring-primary" : "bg-muted/50 hover:bg-muted"}`}
            >
              <TypeBadge type={t} />
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: list-view-only sort + pagination */}
      {view === "list" && (
        <>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sort By</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: "dexNumber",      label: "Pokédex #"  },
                { key: "name",           label: "A–Z"        },
                { key: "pointValue",     label: "Points"     },
                { key: "bst",            label: "BST"        },
                { key: "hp",             label: "HP"         },
                { key: "attack",         label: "Attack"     },
                { key: "defense",        label: "Defense"    },
                { key: "specialAttack",  label: "Sp.Atk"     },
                { key: "specialDefense", label: "Sp.Def"     },
                { key: "speed",          label: "Speed"      },
              ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                <SortBtn key={key} label={label} sortKey={key} current={sortKey} dir={sortDir} onClick={handleSort} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
            <p className="text-muted-foreground">{filtered.length} Pokémon</p>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Show:</span>
              {PAGE_SIZES.map((s) => (
                <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
                  className={`rounded px-2 py-1 font-medium transition-colors ${pageSize === s ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {view === "tier" && (
        <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
          <p>{filtered.length} Pokémon across {tierGroups.length} tiers · alphabetical within tier</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section className="space-y-4">

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            <LayoutList size={16} /> List View
          </button>
          <button
            onClick={() => setView("tier")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${view === "tier" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            <LayoutGrid size={16} /> Tier View
          </button>
        </div>

        {/* Filter bar */}
        {filterBar}

        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <>
            <div className="space-y-3">
              {paginated.map((mon) => {
                const inBuilder = builder.some((b) => b.id === mon.id);
                const canAdd = !inBuilder && builder.length < 10;
                return (
                  <Card
                    key={mon.id}
                    onClick={() => {
                      if (inBuilder) {
                        setBuilder(builder.filter((b) => b.id !== mon.id));
                      } else if (canAdd) {
                        setBuilder([...builder, mon]);
                      }
                    }}
                    className={`p-4 cursor-pointer transition-all ${
                      inBuilder
                        ? "border-primary/60 bg-primary/5 ring-1 ring-primary/40"
                        : canAdd
                        ? "hover:border-primary/40 hover:bg-muted/30"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <Image src={mon.spriteUrl} alt={mon.name} width={80} height={80} className="size-20 shrink-0 object-contain" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">#{String(mon.dexNumber).padStart(4, "0")}</span>
                          <h3 className="text-lg font-bold">{mon.name}</h3>
                          <div className="flex flex-wrap gap-1">
                            {pokemonTypesFor(mon).map((t) => <TypeBadge key={t} type={t} />)}
                          </div>
                          {inBuilder && (
                            <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                              ✓ Added — click to remove
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {STAT_KEYS.map(({ key, label }) => (
                            <StatBar key={key} label={label} value={mon[key]} max={255} />
                          ))}
                          <div className="flex items-center gap-2 border-t pt-1 text-xs">
                            <span className="w-12 shrink-0 text-right font-semibold">BST</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(100, Math.round((mon.bst / 720) * 100))}%` }} />
                            </div>
                            <span className="w-8 shrink-0 font-mono font-black">{mon.bst}</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-3xl font-black leading-none">{mon.pointValue}</p>
                        <p className="text-xs text-muted-foreground">pts</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {pageSize !== "ALL" && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</Button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="secondary" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next →</Button>
              </div>
            )}
          </>
        )}

        {/* ── TIER VIEW ── */}
        {view === "tier" && (
          <div className="space-y-0">
            {tierGroups.map(([pts, mons]) => (
              <div key={pts}>
                {/* Sticky tier header — top-[121px] accounts for nav (~57px) + filter bar (~64px) */}
                <div className="sticky top-[90px] z-20 flex items-center gap-3 border-b border-t bg-background/95 backdrop-blur px-2 py-2">
                  <span className="text-2xl font-black">{pts}</span>
                  <span className="text-sm font-semibold text-muted-foreground">pts</span>
                  <span className="ml-auto text-xs text-muted-foreground">{mons.length} Pokémon</span>
                </div>

                {/* Grid of cells */}
                <div className="grid grid-cols-3 gap-2 py-3 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10">
                  {mons.map((mon) => (
                    <TierCell
                      key={mon.id}
                      mon={mon}
                      inBuilder={builder.some((b) => b.id === mon.id)}
                      onAdd={() => {
                        if (builder.some((b) => b.id === mon.id)) {
                          setBuilder(builder.filter((b) => b.id !== mon.id));
                        } else if (builder.length < 10) {
                          setBuilder([...builder, mon]);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── TEAM BUILDER SIDEBAR — sticky ── */}
      <aside className="space-y-4">
        <div className="sticky top-[100px] space-y-4">
          <Card className="p-4">
            <h2 className="text-xl font-black">Team Builder</h2>
            <p className="text-sm text-muted-foreground">Client-side only. Not saved.</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-md bg-muted p-3"><b>{used}</b><br />Used</div>
              <div className="rounded-md bg-muted p-3"><b>{budget - used}</b><br />Left</div>
              <div className="rounded-md bg-muted p-3"><b>{avgBst}</b><br />Avg BST</div>
            </div>
            <div className="mt-4 space-y-2">
              {builder.length === 0 && <p className="text-xs text-muted-foreground">No Pokémon added yet.</p>}
              {builder.map((mon) => (
                <div key={mon.id} className="flex items-center justify-between rounded-md bg-muted p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Image src={mon.spriteUrl} alt={mon.name} width={32} height={32} className="size-7 object-contain" />
                    <span>{mon.name} · {mon.pointValue}pts</span>
                  </div>
                  <button onClick={() => setBuilder(builder.filter((b) => b.id !== mon.id))}><X size={16} /></button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <h3 className="font-bold">Type Distribution</h3>
            <p className="text-sm text-muted-foreground">{typeDist.map((r) => `${r.type} ×${r.count}`).join(" · ") || "No Pokémon selected"}</p>
            <h3 className="font-bold">Weakness Summary</h3>
            <p className="text-sm text-muted-foreground">{weaknesses.slice(0, 8).map((r) => `${r.type} ×${r.count}`).join(" · ") || "No weaknesses yet"}</p>
            <h3 className="font-bold">Speed Tiers</h3>
            <p className="text-sm text-muted-foreground">{speeds.map((m) => `${m.name} ${m.speed}`).join(" · ") || "No Pokémon selected"}</p>
          </Card>
        </div>
      </aside>
    </div>
  );
}
