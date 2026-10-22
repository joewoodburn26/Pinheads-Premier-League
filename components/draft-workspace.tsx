"use client";

import Image from "next/image";
import { useMemo, useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, LayoutList, LayoutGrid, ChevronUp, ChevronDown, Share2, Download, Trash2, Bookmark, Swords, Sparkles } from "lucide-react";
import { savePlan } from "@/lib/plan-actions";
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

export interface BuilderSlot {
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
      <span className="w-11 shrink-0 text-right text-muted-foreground">{label}</span>
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

export function CoverageMap({ slots }: { slots: BuilderSlot[] }) {
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

export function RoleBalance({ slots }: { slots: BuilderSlot[] }) {
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

export function ThreatScore({ slots }: { slots: BuilderSlot[] }) {
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

export function SpeedTiers({ slots }: { slots: BuilderSlot[] }) {
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

export function exportToPdf(slots: BuilderSlot[], budget: number, seasonName?: string) {
  const used    = slots.reduce((sum, s) => sum + s.pokemon.pointValue, 0);
  const avgBst  = Math.round(slots.reduce((s, b) => s + b.pokemon.bst, 0) / Math.max(1, slots.length));
  const date    = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Type coverage: count how many mons cover each type offensively
  const allTypes = ["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"];
  const typeColorMap: Record<string, string> = {
    Normal:"#9099A1",Fire:"#FF9C54",Water:"#4D90D5",Electric:"#F3D23B",Grass:"#63BB5B",
    Ice:"#74CEC0",Fighting:"#CE4069",Poison:"#AB6AC8",Ground:"#D97746",Flying:"#89AAE3",
    Psychic:"#F97176",Bug:"#90C12C",Rock:"#C9B78B",Ghost:"#5269AC",Dragon:"#0A6DC4",
    Dark:"#5A5366",Steel:"#5A8EA1",Fairy:"#EC8FE6",
  };

  // Speed tiers sorted
  const bySpeed = [...slots].sort((a, b) => b.pokemon.speed - a.pokemon.speed);
  const maxSpeed = bySpeed[0]?.pokemon.speed ?? 1;

  // Role breakdown
  const roles = slots.map(({ pokemon: mon }) => {
    const max = Math.max(mon.attack, mon.specialAttack, mon.defense, mon.specialDefense);
    if (max === mon.attack)        return "Physical";
    if (max === mon.specialAttack) return "Special";
    return "Defensive";
  });
  const roleCount = { Physical: roles.filter(r => r === "Physical").length, Special: roles.filter(r => r === "Special").length, Defensive: roles.filter(r => r === "Defensive").length };

  // Stat bar helper
  function bar(val: number, max: number, color: string): string {
    const pct = Math.min(100, Math.round((val / max) * 100));
    return `<div style="display:flex;align-items:center;gap:6px;margin:2px 0;">
      <div style="width:100%;height:5px;background:#333;border-radius:3px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;"></div>
      </div>
      <span style="font-size:10px;width:24px;text-align:right;color:#ccc;">${val}</span>
    </div>`;
  }

  function statColor(v: number): string {
    if (v >= 150) return "#60a5fa";
    if (v >= 120) return "#4ade80";
    if (v >= 90)  return "#86efac";
    if (v >= 60)  return "#facc15";
    if (v >= 30)  return "#fb923c";
    return "#f87171";
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>PPL Draft Team Sheet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f1117; color: #e2e8f0; padding: 32px; }

    /* Header */
    .header { margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #1e293b; }
    .league-label { font-size: 11px; font-weight: 700; letter-spacing: .25em; color: #f97316; text-transform: uppercase; margin-bottom: 6px; }
    .title { font-size: 36px; font-weight: 900; line-height: 1; margin-bottom: 6px; }
    .title span { color: #dc2626; }
    .title span.league { color: #f97316; }
    .subtitle { font-size: 13px; color: #64748b; }

    /* Summary bar */
    .summary-bar { display: flex; gap: 24px; background: #1e293b; border-radius: 12px; padding: 16px 24px; margin-bottom: 28px; }
    .summary-item { text-align: center; }
    .summary-item .val { font-size: 28px; font-weight: 900; color: #f97316; line-height: 1; }
    .summary-item .lbl { font-size: 11px; color: #64748b; margin-top: 2px; }

    /* Pokemon grid */
    .pokemon-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 28px; }
    .poke-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 12px; text-align: center; }
    .poke-card img { width: 72px; height: 72px; object-fit: contain; image-rendering: pixelated; }
    .poke-name { font-weight: 800; font-size: 13px; margin: 6px 0 2px; }
    .poke-pts { font-size: 22px; font-weight: 900; color: #f97316; line-height: 1; margin-bottom: 4px; }
    .poke-pts span { font-size: 11px; font-weight: 500; color: #64748b; }
    .types { display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; margin: 6px 0; }
    .type-badge { font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; color: white; text-transform: uppercase; }
    .bst-row { font-size: 10px; color: #f97316; font-weight: 700; margin: 6px 0 4px; }
    .note { font-size: 10px; color: #94a3b8; margin-top: 8px; font-style: italic; text-align: left; border-top: 1px solid #334155; padding-top: 6px; }

    /* Bottom sections */
    .bottom-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .section { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 14px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #f97316; margin-bottom: 10px; }

    /* Speed tiers */
    .speed-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 11px; }
    .speed-rank { color: #64748b; width: 14px; }
    .speed-name { width: 80px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .speed-bar-wrap { flex: 1; height: 5px; background: #334155; border-radius: 3px; overflow: hidden; }
    .speed-bar { height: 100%; background: #facc15; border-radius: 3px; }
    .speed-val { color: #ccc; width: 28px; text-align: right; }

    /* Role balance */
    .role-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 11px; }
    .role-name { width: 70px; color: #94a3b8; }
    .role-bar-wrap { flex: 1; height: 8px; background: #334155; border-radius: 4px; overflow: hidden; }
    .role-count { color: #e2e8f0; font-weight: 700; width: 16px; text-align: right; }

    /* Type coverage */
    .type-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
    .type-cell { border-radius: 4px; padding: 3px 2px; text-align: center; }
    .type-cell .tn { font-size: 8px; font-weight: 700; }
    .type-cell .tc { font-size: 9px; font-weight: 900; }

    @media print {
      body { padding: 16px; background: #0f1117 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="league-label">Pokémon Draft League</div>
    <div class="title"><span>Pinheads</span> Premier <span class="league">League</span></div>
    <div class="subtitle">Draft Team Sheet &nbsp;·&nbsp; ${seasonName ?? "Draft Room"} &nbsp;·&nbsp; ${slots.length} Pokémon &nbsp;·&nbsp; ${date}</div>
  </div>

  <!-- Summary bar -->
  <div class="summary-bar">
    <div class="summary-item"><div class="val">${used}</div><div class="lbl">Points Used</div></div>
    <div class="summary-item"><div class="val" style="color:${used > budget ? "#f87171" : "#4ade80"}">${budget - used}</div><div class="lbl">Points Left</div></div>
    <div class="summary-item"><div class="val">${slots.length}</div><div class="lbl">Pokémon</div></div>
    <div class="summary-item"><div class="val">${avgBst}</div><div class="lbl">Avg BST</div></div>
    <div class="summary-item"><div class="val">${bySpeed[0]?.pokemon.speed ?? "—"}</div><div class="lbl">Fastest Speed</div></div>
  </div>

  <!-- Pokémon grid -->
  <div class="pokemon-grid">
    ${slots.map(({ pokemon: mon, note }) => {
      const types = [mon.primaryType, mon.secondaryType].filter(Boolean) as PokemonType[];
      const typeHtml = types.map(t => `<span class="type-badge" style="background:${typeColorMap[t]}">${t}</span>`).join("");
      return `
        <div class="poke-card">
          <img src="${mon.spriteUrl}" alt="${mon.name}" />
          <div class="poke-name">${mon.name}</div>
          <div class="poke-pts">${mon.pointValue}<span>pts</span></div>
          <div class="types">${typeHtml}</div>
          ${bar(mon.hp,             255, statColor(mon.hp))}
          ${bar(mon.attack,         255, statColor(mon.attack))}
          ${bar(mon.defense,        255, statColor(mon.defense))}
          ${bar(mon.specialAttack,  255, statColor(mon.specialAttack))}
          ${bar(mon.specialDefense, 255, statColor(mon.specialDefense))}
          ${bar(mon.speed,          255, statColor(mon.speed))}
          <div class="bst-row">BST ${mon.bst}</div>
          ${note ? `<div class="note">${note}</div>` : ""}
        </div>
      `;
    }).join("")}
  </div>

  <!-- Bottom: Speed tiers, Role balance, Type coverage -->
  <div class="bottom-grid">

    <!-- Speed tiers -->
    <div class="section">
      <div class="section-title">⚡ Speed Tiers</div>
      ${bySpeed.map((s, i) => `
        <div class="speed-row">
          <span class="speed-rank">${i + 1}</span>
          <img src="${s.pokemon.spriteUrl}" width="16" height="16" style="object-fit:contain;" />
          <span class="speed-name">${s.pokemon.name}</span>
          <div class="speed-bar-wrap"><div class="speed-bar" style="width:${Math.round(s.pokemon.speed / maxSpeed * 100)}%"></div></div>
          <span class="speed-val">${s.pokemon.speed}</span>
        </div>
      `).join("")}
    </div>

    <!-- Role balance -->
    <div class="section">
      <div class="section-title">⚔️ Role Balance</div>
      ${[
        { role: "Physical",  color: "#f87171", count: roleCount.Physical  },
        { role: "Special",   color: "#60a5fa", count: roleCount.Special   },
        { role: "Defensive", color: "#4ade80", count: roleCount.Defensive },
      ].map(({ role, color, count }) => `
        <div class="role-row">
          <span class="role-name">${role}</span>
          <div class="role-bar-wrap">
            <div style="width:${Math.round(count / slots.length * 100)}%;height:100%;background:${color};border-radius:4px;"></div>
          </div>
          <span class="role-count">${count}</span>
        </div>
      `).join("")}

      <div style="margin-top:16px;">
        <div class="section-title" style="margin-bottom:6px;">📝 Notes</div>
        ${slots.filter(s => s.note).map(({ pokemon: mon, note }) =>
          `<div style="font-size:10px;margin-bottom:4px;color:#94a3b8;"><span style="color:#e2e8f0;font-weight:700;">${mon.name}:</span> ${note}</div>`
        ).join("") || `<div style="font-size:10px;color:#475569;font-style:italic;">No notes added.</div>`}
      </div>
    </div>

    <!-- Type coverage -->
    <div class="section">
      <div class="section-title">🗺️ Type Coverage</div>
      <div class="type-grid">
        ${allTypes.map(type => {
          const color = typeColorMap[type];
          return `
            <div class="type-cell" style="background:${color}22;border:1px solid ${color}44;">
              <div class="tn" style="color:${color}">${type.slice(0,3).toUpperCase()}</div>
            </div>
          `;
        }).join("")}
      </div>
      <div style="font-size:10px;color:#475569;margin-top:8px;">Your team's type spread</div>
    </div>

  </div>

</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
}

// ─── Team Builder sidebar ─────────────────────────────────────────────────────

function TeamBuilder({
  slots, onRemove, onNoteChange, onClear, budget, seasonName, planPanel,
}: {
  /** Save-plan controls (shown when the member can save plans) */
  planPanel?: React.ReactNode;
  slots: BuilderSlot[];
  onRemove: (id: string) => void;
  onNoteChange: (id: string, note: string) => void;
  onClear: () => void;
  budget: number;
  seasonName?: string;
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
              <button onClick={() => exportToPdf(slots, budget, seasonName)} title="Export as PDF"
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
          {planPanel}
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

// ─── Save plan panel ──────────────────────────────────────────────────────────

export type PlanContext = {
  /** Signed in and linked to a team this season */
  canSave: boolean;
  teamId?: string;
  teamName?: string;
  /** Why saving isn't available (shown as a hint) */
  reason?: string;
};

export type LoadedPlan = { id: string; name: string; teamId: string; picks: { id: string; note: string }[] };

function PlanPanel({
  slots, context, loaded, onLoadedChange,
}: {
  slots: BuilderSlot[];
  context: PlanContext;
  loaded: LoadedPlan | null;
  onLoadedChange: (plan: LoadedPlan | null) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string; href?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!context.canSave && !loaded) {
    return context.reason ? <p className="text-xs text-muted-foreground">{context.reason}</p> : null;
  }

  const picks = slots.map((s) => ({ id: s.pokemon.id, note: s.note }));

  function save(planId: string | null, planName: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await savePlan({ planId, name: planName, picks });
        if (result.error || !result.id) return setMessage({ ok: false, text: result.error ?? "Couldn't save the plan." });
        const teamId = result.teamId ?? loaded?.teamId ?? context.teamId ?? "";
        onLoadedChange({ id: result.id, name: planName, teamId, picks });
        setOpen(false);
        setName("");
        setMessage({ ok: true, text: planId ? `✓ Saved changes to “${planName}”` : `✓ Saved “${planName}”`, href: `/teams/${teamId}/plans/${result.id}` });
        router.refresh();
      } catch {
        setMessage({ ok: false, text: "Couldn't save the plan. Try again." });
      }
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-2.5">
      {loaded ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Editing plan</span>
          <span className="font-bold">“{loaded.name}”</span>
          <button onClick={() => { onLoadedChange(null); setMessage(null); }} className="ml-auto text-muted-foreground underline hover:text-foreground">
            Stop editing
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Plans save privately to <span className="font-semibold text-foreground">{context.teamName}</span>.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {loaded && (
          <Button onClick={() => save(loaded.id, loaded.name)} disabled={pending || slots.length === 0} className="h-8 px-3 text-xs">
            <Bookmark size={13} className="mr-1.5" /> {pending ? "Saving…" : "Save changes"}
          </Button>
        )}
        {context.canSave && (
          <Button variant="secondary" onClick={() => setOpen((o) => !o)} disabled={pending || slots.length === 0} className="h-8 px-3 text-xs">
            <Bookmark size={13} className="mr-1.5" /> {loaded ? "Save as new plan" : "Save plan"}
          </Button>
        )}
      </div>

      {open && (
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); save(null, name); }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name, e.g. Plan A: Rain team" className="h-8 text-xs" autoFocus maxLength={80} />
          <Button disabled={pending || !name.trim()} className="h-8 shrink-0 px-3 text-xs">{pending ? "Saving…" : "Save"}</Button>
        </form>
      )}

      {message && (
        <p className={`text-xs ${message.ok ? "text-green-400" : "text-red-400"}`}>
          {message.text}
          {message.href && <> · <Link href={message.href} className="underline">View plan</Link></>}
        </p>
      )}
    </div>
  );
}

export type MoveOption = { id: string; name: string; type: PokemonType };

const EMPTY_ABILITIES: Record<string, string[]> = {};
const EMPTY_MOVES: MoveOption[] = [];

export function DraftWorkspace({
  pokemon, budget, seasonName, planContext, initialPlan, abilitiesById = EMPTY_ABILITIES, moveOptions = EMPTY_MOVES, formatLabel,
}: {
  pokemon: Pokemon[];
  budget: number;
  seasonName?: string;
  planContext?: PlanContext;
  /** Plan opened with "Open in Draft Room" */
  initialPlan?: LoadedPlan | null;
  /** Pokémon id → abilities (shown on list cards, searchable) */
  abilitiesById?: Record<string, string[]>;
  /** Moves learnable in the season's format (move search suggestions) */
  moveOptions?: MoveOption[];
  formatLabel?: string;
}) {
  // ── Move + ability search ──
  const [abilityQuery, setAbilityQuery] = useState("");
  const [moveInput, setMoveInput] = useState("");
  const [selectedMoves, setSelectedMoves] = useState<MoveOption[]>([]);
  const [moveMatches, setMoveMatches] = useState<Set<string> | null>(null);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState("");
  const allAbilities = useMemo(
    () => [...new Set(Object.values(abilitiesById).flat())].sort((a, b) => a.localeCompare(b)),
    [abilitiesById],
  );

  useEffect(() => {
    if (selectedMoves.length === 0) { setMoveMatches(null); return; }
    let cancelled = false;
    setMoveLoading(true);
    setMoveError("");
    fetch(`/api/move-search?moves=${selectedMoves.map(m => m.id).join(",")}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { ids: string[] }) => { if (!cancelled) setMoveMatches(new Set(data.ids)); })
      .catch(() => { if (!cancelled) setMoveError("Move search failed. Try again."); })
      .finally(() => { if (!cancelled) setMoveLoading(false); });
    return () => { cancelled = true; };
  }, [selectedMoves]);

  function addMove(raw: string) {
    const q = raw.trim().toLowerCase();
    if (!q) return;
    const match =
      moveOptions.find(m => m.name.toLowerCase() === q) ??
      moveOptions.find(m => m.name.toLowerCase().startsWith(q));
    if (!match) { setMoveError(`No move called “${raw.trim()}” in this format.`); return; }
    setMoveError("");
    setMoveInput("");
    setPage(1);
    setSelectedMoves(prev => (prev.some(m => m.id === match.id) || prev.length >= 4 ? prev : [...prev, match]));
  }

  const [loadedPlan, setLoadedPlan] = useState<LoadedPlan | null>(initialPlan ?? null);
  const legal = useMemo(
    () => pokemon.filter((m) => !m.banned && !m.legendary && !m.mythical && !m.paradox),
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

  // ── Load a saved plan ("Open in Draft Room") ──
  useEffect(() => {
    if (!initialPlan) return;
    const byId = new Map(pokemon.map(p => [p.id, p]));
    const loaded = initialPlan.picks.flatMap(({ id, note }) => {
      const mon = byId.get(id);
      return mon ? [{ pokemon: mon, note: note ?? "" }] : [];
    });
    setSlots(loaded);
  }, [initialPlan, pokemon]);

  // ── Load team from URL on mount ──
  useEffect(() => {
    if (initialPlan) return;
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("team");
    if (encoded) {
      const loaded = decodeTeam(encoded, pokemon);
      if (loaded.length > 0) setSlots(loaded);
    }
  }, [pokemon, initialPlan]);

  // ── Load picks from Randomizer (sessionStorage) ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("randomizer_picks");
      if (!raw) return;
      const ids: string[] = JSON.parse(raw);
      sessionStorage.removeItem("randomizer_picks");
      const loaded = ids.flatMap(id => {
        const mon = pokemon.find(p => p.id === id);
        return mon ? [{ pokemon: mon, note: "" }] : [];
      });
      if (loaded.length > 0) {
        setSlots(prev => {
          const existingIds = new Set(prev.map(s => s.pokemon.id));
          const newSlots = loaded.filter(s => !existingIds.has(s.pokemon.id));
          return [...prev, ...newSlots].slice(0, 10);
        });
      }
    } catch {
      // sessionStorage unavailable (private browsing, etc.)
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
    const aq = abilityQuery.trim().toLowerCase();
    return legal.filter(m => {
      if (!m.name.toLowerCase().includes(q)) return false;
      if (aq && !(abilitiesById[m.id] ?? []).some(a => a.toLowerCase().includes(aq))) return false;
      if (selectedMoves.length > 0 && moveMatches && !moveMatches.has(m.id)) return false;
      if (m.pointValue < min || m.pointValue > max) return false;
      if (types.length > 0 && !types.every(t => pokemonTypesFor(m).includes(t))) return false;
      return true;
    }).sort((a, b) => {
      const diff = sortKey === "name" ? a.name.localeCompare(b.name) : (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? diff : -diff;
    });
  }, [legal, query, types, minPts, maxPts, sortKey, sortDir, abilityQuery, abilitiesById, selectedMoves, moveMatches]);

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
          <Input className="pl-9" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Search by name" />
        </label>
        <Input type="number" placeholder="Min pts" value={minPts} onChange={e => { setMinPts(e.target.value); setPage(1); }} />
        <Input type="number" placeholder="Max pts" value={maxPts} onChange={e => { setMaxPts(e.target.value); setPage(1); }} />
      </div>

      {/* Moves + abilities */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <form
            className="relative"
            onSubmit={e => { e.preventDefault(); addMove(moveInput); }}
          >
            <Swords className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
            <Input
              className="pl-9"
              list="draft-move-options"
              value={moveInput}
              onChange={e => {
                const v = e.target.value;
                setMoveInput(v);
                if (moveOptions.some(m => m.name.toLowerCase() === v.trim().toLowerCase())) addMove(v);
              }}
              placeholder={selectedMoves.length >= 4 ? "Up to 4 moves" : "Search by move (learns all)"}
              disabled={selectedMoves.length >= 4}
            />
            <datalist id="draft-move-options">
              {moveOptions.map(m => <option key={m.id} value={m.name} />)}
            </datalist>
          </form>
          {(selectedMoves.length > 0 || moveError) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedMoves.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedMoves(prev => prev.filter(x => x.id !== m.id)); setPage(1); }}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold text-white"
                  style={{ background: typeColors[m.type], textShadow: "0 1px 1px rgba(0,0,0,0.45)" }}
                  title="Remove"
                >
                  {m.name} <X size={11} />
                </button>
              ))}
              {moveLoading && <span className="text-xs text-muted-foreground">Searching…</span>}
              {moveError && <span className="text-xs text-red-400">{moveError}</span>}
            </div>
          )}
        </div>
        <label className="relative block">
          <Sparkles className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
          <Input
            className="pl-9 pr-8"
            list="draft-ability-options"
            value={abilityQuery}
            onChange={e => { setAbilityQuery(e.target.value); setPage(1); }}
            placeholder="Search by ability"
          />
          {abilityQuery && (
            <button type="button" onClick={() => setAbilityQuery("")} className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground" aria-label="Clear ability">
              <X size={14} />
            </button>
          )}
          <datalist id="draft-ability-options">
            {allAbilities.map(a => <option key={a} value={a} />)}
          </datalist>
        </label>
      </div>
      {formatLabel && <p className="text-[11px] text-muted-foreground">Moves follow this season&apos;s format: {formatLabel}</p>}
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
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr_1fr]">
      <section className="space-y-4 xl:col-span-1">        {/* View toggle */}
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
                    <div className="flex items-center gap-4">
                      <Image src={mon.spriteUrl} alt={mon.name} width={128} height={128} className="size-28 shrink-0 object-contain" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">#{String(mon.dexNumber).padStart(4, "0")}</span>
                          <h3 className="text-lg font-bold leading-tight">{mon.name}</h3>
                          <div className="flex flex-wrap gap-1">{pokemonTypesFor(mon).map(t => <TypeBadge key={t} type={t} />)}</div>
                          {inBuilder && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">✓ Added</span>}
                        </div>
                        {(abilitiesById[mon.id]?.length ?? 0) > 0 && (
                          <p className="text-xs text-muted-foreground">{abilitiesById[mon.id].join(" · ")}</p>
                        )}
                        <div className="grid max-w-md grid-cols-2 gap-x-6 gap-y-1">
                          {[0, 3, 1, 4, 2, 5].map(i => {
                            const { key, label } = STAT_KEYS[i];
                            return <StatBar key={key} label={label} value={mon[key]} max={255} />;
                          })}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2 self-stretch">
                        <div className="text-right">
                          <p className="text-3xl font-black leading-none">{mon.pointValue}</p>
                          <p className="text-xs text-muted-foreground">pts</p>
                        </div>
                        <div className="mt-auto rounded-md bg-muted px-2 py-1 text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">BST</p>
                          <p className="font-mono text-sm font-black leading-none">{mon.bst}</p>
                        </div>
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

      {/* ── TEAM BUILDER — right side, spans 2 cols, sticky ── */}
      <aside className="xl:col-span-2">
        <div className="sticky top-[100px]">
          <TeamBuilder
            slots={slots}
            onRemove={id => setSlots(prev => prev.filter(s => s.pokemon.id !== id))}
            onNoteChange={updateNote}
            onClear={() => setSlots([])}
            budget={budget}
            seasonName={seasonName}
            planPanel={
              planContext ? (
                <PlanPanel slots={slots} context={planContext} loaded={loadedPlan} onLoadedChange={setLoadedPlan} />
              ) : undefined
            }
          />
        </div>
      </aside>
    </div>
  );
}
