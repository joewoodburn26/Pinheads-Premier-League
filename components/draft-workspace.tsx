"use client";

import Image from "next/image";
import { useMemo, useState, useEffect } from "react";
import { Search, X, LayoutList, LayoutGrid, ChevronUp, ChevronDown, Share2, Download, Trash2 } from "lucide-react";
import { TypeBadge } from "@/components/type-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { multiplier, pokemonTypes, pokemonTypesFor, typeColors } from "@/lib/type-chart";
import type { Pokemon, PokemonType } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "list" | "tier";
type SortKey = "pointValue" | "bst" | "hp" | "attack" | "defense" | "specialAttack" | "specialDefense" | "speed" | "dexNumber" | "name";
type SortDir = "asc" | "desc";
type PageSize = 25 | 50 | 100 | "ALL";

interface BuilderSlot {
  pokemon: Pokemon;
  note: string;
}

// ─── Stat helpers ─────────────────────────────────────────────────────────────

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

// ─── Sort button ──────────────────────────────────────────────────────────────

function SortBtn({ label, sortKey, current, dir, onClick }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button onClick={() => onClick(sortKey)}
      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
      {label}
      {active ? (dir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : null}
    </button>
  );
}

// ─── Tier cell ────────────────────────────────────────────────────────────────

function TierCell({ mon, inBuilder, onToggle }: {
  mon: Pokemon; inBuilder: boolean; onToggle: () => void;
}) {
  const types = pokemonTypesFor(mon);
  return (
    <div onClick={onToggle}
      className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center cursor-pointer transition-colors ${
        inBuilder ? "border-primary bg-primary/10 ring-1 ring-primary" : "bg-card hover:border-primary/40 hover:bg-muted/30"
      }`}
      title={inBuilder ? `Remove ${mon.name}` : `Add ${mon.name}`}
    >
      <Image src={mon.spriteUrl} alt={mon.name} width={56} height={56} className="size-12 object-contain" />
      <p className="text-xs font-semibold leading-tight">{mon.name}</p>
      <div className="flex flex-wrap justify-center gap-0.5">
        {types.map((t) => <TypeBadge key={t} type={t} />)}
      </div>
      {inBuilder && <p className="text-[10px] text-primary font-bold">✓</p>}
    </div>
  );
}

// ─── Coverage map ─────────────────────────────────────────────────────────────

function CoverageMap({ slots }: { slots: BuilderSlot[] }) {
  const pokemon = slots.map(s => s.pokemon);

  const coverage = useMemo(() => {
    return pokemonTypes.map(defType => {
      // How many of our Pokémon can hit this type super effectively
      const hits = pokemon.filter(mon =>
        pokemonTypesFor(mon).some(atkType => {
              return multiplier(atkType, [defType]) > 1;
        })
      ).length;
      // How many of our Pokémon are weak to this type
      const weakTo = pokemon.filter(mon => {
          return multiplier(defType, pokemonTypesFor(mon)) > 1;
      }).length;
      return { type: defType, hits, weakTo };
    });
  }, [pokemon]);

  if (pokemon.length === 0) return (
    <p className="text-xs text-muted-foreground italic">Add Pokémon to see coverage</p>
  );

  return (
    <div className="grid grid-cols-6 gap-1">
      {coverage.map(({ type, hits, weakTo }) => {
        const bg = hits >= 3 ? "bg-green-500/30 border-green-500/50" :
                   hits >= 1 ? "bg-green-500/10 border-green-500/20" :
                   "bg-muted/30 border-border";
        const weakBadge = weakTo >= 3 ? "text-red-400 font-black" :
                          weakTo >= 2 ? "text-orange-400 font-bold" :
                          weakTo === 1 ? "text-yellow-400" : "text-muted-foreground";
        return (
          <div key={type} className={`rounded border p-1 text-center ${bg}`} title={`${type}: ${hits} hits, ${weakTo} weak`}>
            <p className="text-[9px] font-semibold truncate" style={{ color: typeColors[type] }}>{type.slice(0, 3)}</p>
            <p className="text-[10px] font-bold text-green-400">{hits > 0 ? `↑${hits}` : "—"}</p>
            <p className={`text-[10px] ${weakBadge}`}>{weakTo > 0 ? `↓${weakTo}` : ""}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Role balance ─────────────────────────────────────────────────────────────

function RoleBalance({ slots }: { slots: BuilderSlot[] }) {
  const pokemon = slots.map(s => s.pokemon);
  if (pokemon.length === 0) return <p className="text-xs text-muted-foreground italic">No Pokémon added</p>;

  const roles = pokemon.map(mon => {
    const stats = { atk: mon.attack, spA: mon.specialAttack, def: mon.defense, spD: mon.specialDefense };
    const maxStat = Math.max(stats.atk, stats.spA, stats.def, stats.spD);
    if (maxStat === stats.atk) return "Physical";
    if (maxStat === stats.spA) return "Special";
    return "Defensive";
  });

  const counts = {
    Physical: roles.filter(r => r === "Physical").length,
    Special:  roles.filter(r => r === "Special").length,
    Defensive:roles.filter(r => r === "Defensive").length,
  };
  const total = pokemon.length;

  return (
    <div className="space-y-1.5">
      {(["Physical", "Special", "Defensive"] as const).map(role => {
        const count = counts[role];
        const pct = Math.round(count / total * 100);
        const color = role === "Physical" ? "bg-red-500" : role === "Special" ? "bg-blue-500" : "bg-green-600";
        return (
          <div key={role} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-muted-foreground">{role}</span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-6 text-right font-bold">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Threat score ─────────────────────────────────────────────────────────────

function ThreatScore({ slots }: { slots: BuilderSlot[] }) {
  const pokemon = slots.map(s => s.pokemon);
  if (pokemon.length === 0) return <p className="text-xs text-muted-foreground italic">No Pokémon added</p>;

  const weaknessCounts = pokemonTypes.map(type => ({
    type,
    count: pokemon.filter(mon => {
      return multiplier(type, pokemonTypesFor(mon)) > 1;
    }).length,
  })).filter(r => r.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="space-y-1.5">
      {weaknessCounts.map(({ type, count }) => (
        <div key={type} className="flex items-center gap-2 text-xs">
          <TypeBadge type={type} />
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-red-500/70"
              style={{ width: `${Math.min(100, count / pokemon.length * 100)}%` }} />
          </div>
          <span className={`w-6 text-right font-bold ${count >= 3 ? "text-red-400" : count >= 2 ? "text-orange-400" : "text-yellow-400"}`}>
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Speed tiers ──────────────────────────────────────────────────────────────

function SpeedTiers({ slots }: { slots: BuilderSlot[] }) {
  const pokemon = slots.map(s => s.pokemon);
  if (pokemon.length === 0) return <p className="text-xs text-muted-foreground italic">No Pokémon added</p>;

  const sorted = [...pokemon].sort((a, b) => b.speed - a.speed);
  const maxSpe = sorted[0].speed;

  return (
    <div className="space-y-1.5">
      {sorted.map((mon, i) => (
        <div key={mon.id} className="flex items-center gap-2 text-xs">
          <span className="w-4 text-muted-foreground">{i + 1}</span>
          <Image src={mon.spriteUrl} alt={mon.name} width={20} height={20} className="size-4 object-contain" />
          <span className="w-20 truncate font-medium">{mon.name}</span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-yellow-400"
              style={{ width: `${Math.round(mon.speed / maxSpe * 100)}%` }} />
          </div>
          <span className="w-8 text-right font-bold">{mon.speed}</span>
        </div>
      ))}
    </div>
  );
}

// ─── URL encoding ─────────────────────────────────────────────────────────────

function encodeTeam(slots: BuilderSlot[]): string {
  const data = slots.map(s => ({
    id: s.pokemon.id,
    note: s.note,
  }));
  return btoa(JSON.stringify(data));
}

function decodeTeam(encoded: string, allPokemon: Pokemon[]): BuilderSlot[] {
  try {
    const data = JSON.parse(atob(encoded)) as { id: string; note: string }[];
    return data.flatMap(({ id, note }) => {
      const mon = allPokemon.find(p => p.id === id);
      return mon ? [{ pokemon: mon, note }] : [];
    });
  } catch {
    return [];
  }
}

// ─── PDF export ───────────────────────────────────────────────────────────────

function exportToPdf(slots: BuilderSlot[], budget: number) {
  const used = slots.reduce((sum, s) => sum + s.pokemon.pointValue, 0);
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Draft Team Sheet</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: sans-serif; background: #fff; color: #111; padding: 24px; }
        h1 { font-size: 24px; font-weight: 900; margin-bottom: 4px; }
        .subtitle { font-size: 13px; color: #666; margin-bottom: 20px; }
        .team-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 10px; text-align: center; }
        .card img { width: 64px; height: 64px; object-fit: contain; }
        .card .name { font-weight: 700; font-size: 13px; margin: 4px 0; }
        .card .pts { font-size: 18px; font-weight: 900; color: #333; }
        .card .types { display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; margin: 4px 0; }
        .type-badge { font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; color: white; }
        .card .note { font-size: 11px; color: #555; margin-top: 6px; font-style: italic; text-align: left; border-top: 1px solid #eee; padding-top: 4px; }
        .stats { font-size: 10px; color: #666; margin-top: 4px; text-align: left; }
        .summary { display: flex; gap: 16px; font-size: 13px; border-top: 2px solid #111; padding-top: 12px; }
        .summary b { font-size: 20px; }
        @media print { body { padding: 12px; } }
      </style>
    </head>
    <body>
      <h1>Pinheads Premier League — Draft Team Sheet</h1>
      <p class="subtitle">Points used: ${used} / ${budget} &nbsp;|&nbsp; ${slots.length} Pokémon &nbsp;|&nbsp; ${new Date().toLocaleDateString()}</p>
      <div class="team-grid">
        ${slots.map(({ pokemon: mon, note }) => {
          const types = [mon.primaryType, mon.secondaryType].filter(Boolean) as PokemonType[];
          const typeHtml = types.map(t => `<span class="type-badge" style="background:${typeColors[t]}">${t}</span>`).join("");
          return `
            <div class="card">
              <img src="${mon.spriteUrl}" alt="${mon.name}" />
              <div class="name">${mon.name}</div>
              <div class="pts">${mon.pointValue}pts</div>
              <div class="types">${typeHtml}</div>
              <div class="stats">HP ${mon.hp} | Atk ${mon.attack} | Def ${mon.defense}<br/>SpA ${mon.specialAttack} | SpD ${mon.specialDefense} | Spe ${mon.speed} | BST ${mon.bst}</div>
              ${note ? `<div class="note">${note}</div>` : ""}
            </div>
          `;
        }).join("")}
      </div>
      <div class="summary">
        <div><b>${used}</b><br/>pts used</div>
        <div><b>${budget - used}</b><br/>pts left</div>
        <div><b>${Math.round(slots.reduce((s, b) => s + b.pokemon.bst, 0) / Math.max(1, slots.length))}</b><br/>avg BST</div>
      </div>
    </body>
    </html>
  `;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

// ─── Team Builder sidebar ─────────────────────────────────────────────────────

function TeamBuilder({
  slots, onRemove, onNoteChange, onClear, budget,
}: {
  slots: BuilderSlot[];
  onRemove: (id: string) => void;
  onNoteChange: (id: string, note: string) => void;
  onClear: () => void;
  budget: number;
}) {
  const [shareMsg, setShareMsg] = useState("");
  const used    = slots.reduce((s, b) => s + b.pokemon.pointValue, 0);
  const avgBst  = slots.length ? Math.round(slots.reduce((s, b) => s + b.pokemon.bst, 0) / slots.length) : 0;
  const pctUsed = Math.min(100, Math.round(used / budget * 100));
  const overBudget = used > budget;

  function handleShare() {
    const encoded = encodeTeam(slots);
    const url = `${window.location.origin}${window.location.pathname}?team=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareMsg("Link copied!");
      setTimeout(() => setShareMsg(""), 2000);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      {/* LEFT — team list, sticky */}
      <div className="sticky top-[100px] space-y-3">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Team Builder</h2>
            <div className="flex gap-1.5">
              <button onClick={handleShare} title="Copy shareable link"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Share2 size={15} />
              </button>
              <button onClick={() => exportToPdf(slots, budget)} title="Export as PDF"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Download size={15} />
              </button>
              {slots.length > 0 && (
                <button onClick={onClear} title="Clear team"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
          {shareMsg && <p className="text-xs text-green-400">{shareMsg}</p>}
          <p className="text-xs text-muted-foreground">Click any Pokémon to add · click again to remove</p>

          {/* Budget bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Budget</span>
              <span className={`font-bold ${overBudget ? "text-red-400" : ""}`}>{used} / {budget} pts</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full transition-all ${overBudget ? "bg-red-500" : pctUsed > 80 ? "bg-yellow-400" : "bg-green-500"}`}
                style={{ width: `${pctUsed}%` }} />
            </div>
          </div>

          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-md bg-muted p-2">
              <p className="text-lg font-black">{slots.length}</p>
              <p className="text-xs text-muted-foreground">Pokémon</p>
            </div>
            <div className="rounded-md bg-muted p-2">
              <p className={`text-lg font-black ${overBudget ? "text-red-400" : ""}`}>{budget - used}</p>
              <p className="text-xs text-muted-foreground">Pts left</p>
            </div>
            <div className="rounded-md bg-muted p-2">
              <p className="text-lg font-black">{avgBst}</p>
              <p className="text-xs text-muted-foreground">Avg BST</p>
            </div>
          </div>

          {/* Pokémon list — 2 per row */}
          <div className="grid grid-cols-2 gap-2">
            {slots.length === 0 && (
              <p className="col-span-2 text-xs text-muted-foreground italic">No Pokémon added yet</p>
            )}
            {slots.map(({ pokemon: mon, note }) => (
              <div key={mon.id} className="rounded-lg border bg-muted/30 p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Image src={mon.spriteUrl} alt={mon.name} width={32} height={32} className="size-7 object-contain shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{mon.name}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {pokemonTypesFor(mon).map(t => <TypeBadge key={t} type={t} />)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-bold text-primary">{mon.pointValue}pts</span>
                    <button onClick={() => onRemove(mon.id)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Notes…"
                  value={note}
                  onChange={e => onNoteChange(mon.id, e.target.value)}
                  className="w-full rounded border bg-background px-2 py-1 text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* RIGHT — analytics, sticky */}
      <div className="sticky top-[100px] space-y-3">
        <Card className="p-4 space-y-2">
          <h3 className="font-bold text-sm">Type Coverage</h3>
          <p className="text-xs text-muted-foreground">↑ = your hits · ↓ = your weaknesses</p>
          <CoverageMap slots={slots} />
        </Card>

        <Card className="p-4 space-y-2">
          <h3 className="font-bold text-sm">Role Balance</h3>
          <RoleBalance slots={slots} />
        </Card>

        <Card className="p-4 space-y-2">
          <h3 className="font-bold text-sm">Top Threats</h3>
          <p className="text-xs text-muted-foreground">Types that hit the most of your team</p>
          <ThreatScore slots={slots} />
        </Card>

        <Card className="p-4 space-y-2">
          <h3 className="font-bold text-sm">Speed Tiers</h3>
          <SpeedTiers slots={slots} />
        </Card>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DraftWorkspace({ pokemon, budget }: { pokemon: Pokemon[]; budget: number }) {
  const legal = useMemo(
    () => pokemon.filter((m) => !m.legendary && !m.mythical && !m.paradox),
    [pokemon]
  );

  // ── Filters ──
  const [query,   setQuery]   = useState("");
  const [types,   setTypes]   = useState<PokemonType[]>([]);
  const [minPts,  setMinPts]  = useState("");
  const [maxPts,  setMaxPts]  = useState("");

  // ── Sort ──
  const [sortKey, setSortKey] = useState<SortKey>("dexNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // ── Pagination ──
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [page,     setPage]     = useState(1);

  // ── View ──
  const [view, setView] = useState<ViewMode>("list");

  // ── Builder state ──
  const [slots, setSlots] = useState<BuilderSlot[]>([]);

  // ── Load team from URL on mount ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("team");
    if (encoded) {
      const loaded = decodeTeam(encoded, pokemon);
      if (loaded.length > 0) setSlots(loaded);
    }
  }, [pokemon]);

  // ── Builder helpers ──
  function toggleBuilder(mon: Pokemon) {
    setSlots(prev => {
      if (prev.some(s => s.pokemon.id === mon.id)) {
        return prev.filter(s => s.pokemon.id !== mon.id);
      }
      if (prev.length >= 10) return prev;
      return [...prev, { pokemon: mon, note: "" }];
    });
  }

  function updateNote(pokemonId: string, note: string) {
    setSlots(prev => prev.map(s => s.pokemon.id === pokemonId ? { ...s, note } : s));
  }

  // ── Type toggle ──
  function toggleType(t: PokemonType) {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
    setPage(1);
  }

  // ── Sort ──
  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir(key === "name" || key === "dexNumber" ? "asc" : "desc"); }
    setPage(1);
  }

  // ── Filtered + sorted ──
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const min = minPts === "" ? 0 : parseInt(minPts);
    const max = maxPts === "" ? Infinity : parseInt(maxPts);
    return legal.filter(m => {
      if (!m.name.toLowerCase().includes(q)) return false;
      if (m.pointValue < min || m.pointValue > max) return false;
      if (types.length > 0 && !types.every(t => pokemonTypesFor(m).includes(t))) return false;
      return true;
    }).sort((a, b) => {
      const diff = sortKey === "name" ? a.name.localeCompare(b.name) : (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? diff : -diff;
    });
  }, [legal, query, types, minPts, maxPts, sortKey, sortDir]);

  const PAGE_SIZES: PageSize[] = [25, 50, 100, "ALL"];
  const totalPages = pageSize === "ALL" ? 1 : Math.ceil(filtered.length / (pageSize as number));
  const paginated  = pageSize === "ALL" ? filtered : filtered.slice((page - 1) * (pageSize as number), page * (pageSize as number));

  // ── Tier groups ──
  const tierGroups = useMemo(() => {
    const byPts = new Map<number, Pokemon[]>();
    [...filtered].sort((a, b) => a.name.localeCompare(b.name)).forEach(m => {
      const arr = byPts.get(m.pointValue) ?? [];
      arr.push(m);
      byPts.set(m.pointValue, arr);
    });
    return [...byPts.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  // ── Filter bar ──
  const filterBar = (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_110px_110px]">
        <label className="relative">
          <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
          <Input className="pl-9" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Search Pokémon" />
        </label>
        <Input type="number" placeholder="Min pts" value={minPts} onChange={e => { setMinPts(e.target.value); setPage(1); }} />
        <Input type="number" placeholder="Max pts" value={maxPts} onChange={e => { setMaxPts(e.target.value); setPage(1); }} />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Type {types.length > 0 && `(${types.length} — must have ALL)`}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {types.length > 0 && (
            <button onClick={() => { setTypes([]); setPage(1); }} className="rounded px-2 py-1 text-xs bg-destructive/20 text-destructive hover:bg-destructive/30">Clear</button>
          )}
          {pokemonTypes.map(t => (
            <button key={t} onClick={() => toggleType(t)}
              className={`rounded-md border px-2 py-1 transition-colors ${types.includes(t) ? "border-primary bg-primary/20 ring-1 ring-primary" : "bg-muted/50 hover:bg-muted"}`}>
              <TypeBadge type={t} />
            </button>
          ))}
        </div>
      </div>
      {view === "list" && (
        <>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sort By</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: "dexNumber", label: "Pokédex #" }, { key: "name", label: "A–Z" },
                { key: "pointValue", label: "Points" }, { key: "bst", label: "BST" },
                { key: "hp", label: "HP" }, { key: "attack", label: "Attack" },
                { key: "defense", label: "Defense" }, { key: "specialAttack", label: "Sp.Atk" },
                { key: "specialDefense", label: "Sp.Def" }, { key: "speed", label: "Speed" },
              ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                <SortBtn key={key} label={label} sortKey={key} current={sortKey} dir={sortDir} onClick={handleSort} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
            <p className="text-muted-foreground">{filtered.length} Pokémon</p>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Show:</span>
              {PAGE_SIZES.map(s => (
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
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="space-y-4">        {/* View toggle */}
        <div className="flex items-center gap-2">
          <button onClick={() => setView("list")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
            <LayoutList size={16} /> List View
          </button>
          <button onClick={() => setView("tier")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${view === "tier" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
            <LayoutGrid size={16} /> Tier View
          </button>
        </div>

        {filterBar}

        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <>
            <div className="space-y-3">
              {paginated.map(mon => {
                const inBuilder = slots.some(s => s.pokemon.id === mon.id);
                const canAdd = !inBuilder && slots.length < 10;
                return (
                  <Card key={mon.id} onClick={() => toggleBuilder(mon)}
                    className={`p-4 cursor-pointer transition-all ${
                      inBuilder ? "border-primary/60 bg-primary/5 ring-1 ring-primary/40" :
                      canAdd    ? "hover:border-primary/40 hover:bg-muted/30" :
                      "opacity-50 cursor-not-allowed"
                    }`}>
                    <div className="flex items-start gap-4">
                      <Image src={mon.spriteUrl} alt={mon.name} width={80} height={80} className="size-20 shrink-0 object-contain" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">#{String(mon.dexNumber).padStart(4, "0")}</span>
                          <h3 className="text-lg font-bold">{mon.name}</h3>
                          <div className="flex flex-wrap gap-1">{pokemonTypesFor(mon).map(t => <TypeBadge key={t} type={t} />)}</div>
                          {inBuilder && <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">✓ Added — click to remove</span>}
                        </div>
                        <div className="space-y-1">
                          {STAT_KEYS.map(({ key, label }) => <StatBar key={key} label={label} value={mon[key]} max={255} />)}
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
            {pageSize !== "ALL" && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</Button>
              </div>
            )}
          </>
        )}

        {/* ── TIER VIEW ── */}
        {view === "tier" && (
          <div className="space-y-0">
            {tierGroups.map(([pts, mons]) => (
              <div key={pts}>
                <div className="sticky top-[90px] z-20 flex items-center gap-3 border-b border-t bg-background/95 backdrop-blur px-2 py-2">
                  <span className="text-2xl font-black">{pts}</span>
                  <span className="text-sm font-semibold text-muted-foreground">pts</span>
                  <span className="ml-auto text-xs text-muted-foreground">{mons.length} Pokémon</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {mons.map(mon => (
                    <TierCell key={mon.id} mon={mon}
                      inBuilder={slots.some(s => s.pokemon.id === mon.id)}
                      onToggle={() => toggleBuilder(mon)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── TEAM BUILDER — full width, internally split ── */}
      <aside className="xl:col-span-2">
        <div>
          <TeamBuilder
            slots={slots}
            onRemove={id => setSlots(prev => prev.filter(s => s.pokemon.id !== id))}
            onNoteChange={updateNote}
            onClear={() => setSlots([])}
            budget={budget}
          />
        </div>
      </aside>
    </div>
  );
}
