"use client";

// Building blocks shared by the Prep page (two teams) and Draft Plan pages (one team).

import { useMemo, useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { pokemonTypes, typeColors } from "@/lib/type-chart";
import type { PrepMember, PrepTeam } from "@/lib/prep";

export type Side = { color: string; label: string };

export const YOU: Side = { color: "#3b82f6", label: "You" };
export const OPP: Side = { color: "#ef4444", label: "Opponent" };

export function speedAt(base: number, level: 50 | 100, ev: 0 | 252, plusNature = false) {
  // 31 IVs
  const stat = Math.floor(((2 * base + 31 + Math.floor(ev / 4)) * level) / 100) + 5;
  return plusNature ? Math.floor(stat * 1.1) : stat;
}

// Colors match the usual type-defense charts: green = weak (good to hit), red = resists
export const MULT_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  "0":    { label: "0", bg: "#2e3436", fg: "#d1d5db" },
  "0.25": { label: "¼", bg: "#6b0000", fg: "#ffffff" },
  "0.5":  { label: "½", bg: "#a40000", fg: "#ffffff" },
  "2":    { label: "2", bg: "#4e9a06", fg: "#ffffff" },
  "4":    { label: "4", bg: "#2b5a02", fg: "#ffffff" },
};

export const WEAKNESS_HINT =
  "Damage each Pokémon takes from each attacking type. Green = weak, red = resists, gray = immune (abilities like Levitate aren't counted).";

export function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div>
        <h2 className="text-2xl font-black">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function SideTitle({ name, side }: { name: string; side: Side }) {
  return (
    <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3" style={{ borderTop: `3px solid ${side.color}` }}>
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: side.color }}>{side.label}</span>
      <span className="font-black">{name}</span>
    </div>
  );
}

function MultCell({ x }: { x: number }) {
  const hit = MULT_STYLE[String(x)];
  if (!hit) return <td className="px-0.5 py-0.5"><div className="h-7" /></td>;
  return (
    <td className="px-0.5 py-0.5">
      <div className="grid h-7 place-items-center rounded text-xs font-bold" style={{ background: hit.bg, color: hit.fg }}>
        {hit.label}
      </div>
    </td>
  );
}

/** One team's weakness grid. Leave out name/side for a plain card (Draft Plans). */
export function WeaknessGrid({ name, side, members }: { name?: string; side?: Side; members: PrepMember[] }) {
  return (
    <Card className="overflow-hidden">
      {name && side && <SideTitle name={name} side={side} />}
      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[1280px] table-fixed text-sm">
          <colgroup>
            <col className="w-[170px]" />
            {pokemonTypes.map((t) => <col key={t} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-[11px] uppercase tracking-wider text-muted-foreground">Pokémon</th>
              {pokemonTypes.map((t) => (
                <th key={t} className="px-0.5 py-1">
                  <span className="block rounded px-1 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: typeColors[t] }}>
                    {t}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.pokemon.id}>
                <td className="px-2 py-0.5">
                  <div className="flex items-center gap-1.5">
                    <Image src={m.pokemon.spriteUrl} alt="" width={28} height={28} className="size-6 object-contain" />
                    <span className="truncate text-xs font-semibold">{m.pokemon.name}</span>
                  </div>
                </td>
                {pokemonTypes.map((t) => <MultCell key={t} x={m.weakness[t]} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Speed tiers for one or more teams, with the Level 100 / 50 toggle. */
export function SpeedSection({ sides }: { sides: { side: Side; members: PrepMember[] }[] }) {
  const [level, setLevel] = useState<50 | 100>(100);
  const showSide = sides.length > 1;
  const rows = useMemo(
    () =>
      sides
        .flatMap(({ side, members }) => members.map((m) => ({ m, side })))
        .map((r) => ({
          ...r,
          s0: speedAt(r.m.pokemon.speed, level, 0),
          s252: speedAt(r.m.pokemon.speed, level, 252),
          sPlus: speedAt(r.m.pokemon.speed, level, 252, true),
        }))
        .sort((a, b) => b.sPlus - a.sPlus || b.m.pokemon.speed - a.m.pokemon.speed),
    [sides, level],
  );

  return (
    <section id="speed" className="scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Speed Tiers</h2>
          <p className="text-sm text-muted-foreground">Level {level}, 31 IVs. Sorted by max speed (252 EVs, + nature).</p>
        </div>
        <div className="flex rounded-md border p-0.5 text-sm">
          {([100, 50] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`rounded px-3 py-1 font-semibold transition-colors ${level === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Level {l}
            </button>
          ))}
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-white/5">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Pokémon</th>
                <th className="px-3 py-2">Base</th>
                <th className="px-3 py-2">0 EVs</th>
                <th className="px-3 py-2">252 EVs</th>
                <th className="px-3 py-2">252+</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, side, s0, s252, sPlus }, i) => (
                <tr
                  key={`${side.label}-${m.pokemon.id}`}
                  className="border-b border-white/5 last:border-0"
                  style={showSide ? { background: `${side.color}0d` } : undefined}
                >
                  <td className="px-3 py-1.5 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      {showSide && <span className="h-6 w-1 rounded-full" style={{ background: side.color }} />}
                      <Image src={m.pokemon.spriteUrl} alt="" width={32} height={32} className="size-7 object-contain" />
                      <span className="font-semibold">{m.pokemon.name}</span>
                      {showSide && <span className="text-[10px] font-bold uppercase" style={{ color: side.color }}>{side.label}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-center tabular-nums">{m.pokemon.speed}</td>
                  <td className="px-3 py-1.5 text-center tabular-nums text-muted-foreground">{s0}</td>
                  <td className="px-3 py-1.5 text-center tabular-nums">{s252}</td>
                  <td className="px-3 py-1.5 text-center font-bold tabular-nums">{sPlus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

/** One move category (e.g. Hazards): which moves each team can learn, and who learns them. */
export function MoveCategoryCard({
  label,
  catKey,
  sides,
}: {
  label: string;
  catKey: string;
  sides: { side: Side; team: PrepTeam }[];
}) {
  const learnerCount = (t: PrepTeam) => new Set(t.categories[catKey].flatMap((r) => r.learners)).size;
  const single = sides.length === 1;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
        <h3 className="font-bold">{label}</h3>
        {single ? (
          <span className="ml-auto text-xs text-muted-foreground">
            <span className="font-bold tabular-nums text-foreground">{learnerCount(sides[0].team)}</span> can learn
          </span>
        ) : (
          sides.map(({ side, team }, i) => (
            <span key={side.label} className={`flex items-center gap-2 text-xs ${i === 0 ? "ml-auto" : ""}`}>
              {i > 0 && <span className="text-muted-foreground">vs</span>}
              <span className="font-bold tabular-nums" style={{ color: side.color }}>{learnerCount(team)}</span>
            </span>
          ))
        )}
      </div>
      <div className={`grid divide-x divide-white/5 ${single ? "grid-cols-1" : "grid-cols-2"}`}>
        {sides.map(({ side, team }) => {
          const byId = new Map(team.members.map((m) => [m.pokemon.id, m.pokemon]));
          const rows = team.categories[catKey];
          return (
            <div
              key={side.label}
              className={`p-3 ${single ? "grid gap-2 sm:grid-cols-2" : "space-y-2"}`}
              style={single ? undefined : { boxShadow: `inset 0 2px 0 ${side.color}55` }}
            >
              {rows.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">None</p>
              ) : (
                rows.map((r) => (
                  <div key={r.move}>
                    <span
                      className="inline-block rounded px-2 py-0.5 text-xs font-bold"
                      style={{ background: typeColors[r.type], color: "#ffffff", textShadow: "0 1px 1px rgba(0,0,0,0.45)" }}
                      title={`${r.type}-type`}
                    >
                      {r.move}
                    </span>
                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                      {r.learners.map((id) => {
                        const p = byId.get(id);
                        return p ? (
                          <Image key={id} src={p.spriteUrl} alt={p.name} title={p.name} width={28} height={28} className="size-7 rounded bg-white/[0.04] object-contain" />
                        ) : null;
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
