"use client";

import { Ban, Minus, Plus, Undo2 } from "lucide-react";
import { PokemonSprite } from "@/components/pokemon-sprite";
import { TypeBadge } from "@/components/type-badge";
import { pokemonTypesFor } from "@/lib/type-chart";
import { STAT_BAR_MAX } from "@/lib/utils";
import type { Pokemon } from "@/lib/types";

const STATS = [
  ["hp", "HP"], ["specialAttack", "Sp.Atk"],
  ["attack", "Atk"], ["specialDefense", "Sp.Def"],
  ["defense", "Def"], ["speed", "Speed"],
] as const;

function statColor(v: number) {
  if (v >= 150) return "bg-blue-500";
  if (v >= 120) return "bg-green-700";
  if (v >= 90) return "bg-green-500";
  if (v >= 60) return "bg-yellow-400";
  if (v >= 30) return "bg-orange-400";
  return "bg-red-500";
}

/** Draft-room style card with a points stepper and a ban button. */
export function PointsCard({
  mon,
  points,
  banned,
  originalPoints,
  originalBanned,
  defaultPoints,
  onPoints,
  onBan,
  onReset,
}: {
  mon: Pokemon;
  points: number;
  banned: boolean;
  originalPoints: number;
  originalBanned: boolean;
  /** Value in the Default list when it differs (null = same / no Default) */
  defaultPoints: number | null;
  onPoints: (v: number) => void;
  onBan: (banned: boolean) => void;
  onReset: () => void;
}) {
  const changed = points !== originalPoints || banned !== originalBanned;
  return (
    <div
      className={`flex gap-3 rounded-xl border bg-card p-3 transition-colors ${
        changed ? "border-amber-400/70 bg-amber-400/5 ring-1 ring-amber-400/40" : ""
      } ${banned ? "opacity-70" : ""}`}
    >
      <PokemonSprite src={mon.spriteUrl} name={mon.name} size={88} stillOnTouch className="size-[88px] shrink-0 self-center max-md:size-16" />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[11px] text-muted-foreground">#{String(mon.dexNumber).padStart(4, "0")}</span>
          <h3 className={`truncate font-bold leading-tight ${banned ? "line-through" : ""}`}>{mon.name}</h3>
        </div>
        <div className="flex flex-wrap gap-1">
          {pokemonTypesFor(mon).map((t) => <TypeBadge key={t} type={t} />)}
          {banned && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-bold text-red-300">BANNED</span>}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 max-md:hidden">
          {STATS.map(([key, label]) => {
            const v = mon[key];
            return (
              <div key={key} className="flex items-center gap-1.5 text-[11px]">
                <span className="w-9 shrink-0 text-right text-muted-foreground">{label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${statColor(v)}`} style={{ width: `${Math.min(100, (v / STAT_BAR_MAX) * 100)}%` }} />
                </div>
                <span className="w-7 shrink-0 font-mono font-semibold">{v}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground md:hidden">BST {mon.bst} · Spe {mon.speed}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="One point less"
            onClick={() => onPoints(Math.max(0, points - 1))}
            className="grid size-7 place-items-center rounded-md border hover:bg-muted"
          >
            <Minus size={13} />
          </button>
          <input
            type="number"
            min={0}
            max={999}
            value={points}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isInteger(v) && v >= 0 && v <= 999) onPoints(v);
            }}
            className="h-9 w-14 rounded-md border bg-background text-center text-xl font-black [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            aria-label={`${mon.name} points`}
          />
          <button
            type="button"
            aria-label="One point more"
            onClick={() => onPoints(Math.min(999, points + 1))}
            className="grid size-7 place-items-center rounded-md border hover:bg-muted"
          >
            <Plus size={13} />
          </button>
        </div>
        <div className="text-right text-[11px] leading-tight text-muted-foreground">
          {points !== originalPoints && <p className="font-semibold text-amber-300">was {originalPoints}</p>}
          {defaultPoints !== null && <p>Default {defaultPoints}</p>}
          <p className="max-md:hidden">BST {mon.bst}</p>
        </div>
        <div className="flex gap-1">
          {changed && (
            <button type="button" onClick={onReset} title="Undo changes" className="grid size-7 place-items-center rounded-md border text-muted-foreground hover:bg-muted">
              <Undo2 size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onBan(!banned)}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${
              banned ? "border-green-500/50 text-green-400 hover:bg-green-500/10" : "text-muted-foreground hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
            }`}
          >
            <Ban size={12} /> {banned ? "Unban" : "Ban"}
          </button>
        </div>
      </div>
    </div>
  );
}
