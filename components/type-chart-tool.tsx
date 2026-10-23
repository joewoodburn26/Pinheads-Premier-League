"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TypeBadge } from "@/components/type-badge";
import { Card } from "@/components/ui/card";
import { multiplier, pokemonTypes, typeColors } from "@/lib/type-chart";
import type { PokemonType } from "@/lib/types";

// Same colors as the Prep weakness grid: green = super effective, red = resisted, black = immune
const MULT_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  "0":    { label: "0×", bg: "#2e3436", fg: "#d1d5db" },
  "0.25": { label: "¼×", bg: "#6b0000", fg: "#ffffff" },
  "0.5":  { label: "½×", bg: "#a40000", fg: "#ffffff" },
  "2":    { label: "2×", bg: "#4e9a06", fg: "#ffffff" },
  "4":    { label: "4×", bg: "#2b5a02", fg: "#ffffff" },
};

const LEGEND = ["4", "2", "0.5", "0.25", "0"];

function MultCell({ x }: { x: number }) {
  const s = MULT_STYLE[String(x)];
  return (
    <td className="px-0.5 py-0.5">
      {s ? (
        <div className="grid h-8 place-items-center rounded text-xs font-bold" style={{ background: s.bg, color: s.fg }}>
          {s.label}
        </div>
      ) : (
        <div className="h-8 rounded bg-muted/40" />
      )}
    </td>
  );
}

// ── Type picker ───────────────────────────────────────────────────────────────

function TypeSelector({
  selected,
  onChange,
}: {
  selected: PokemonType[];
  onChange: (types: PokemonType[]) => void;
}) {
  function toggleType(type: PokemonType) {
    if (selected.includes(type)) onChange(selected.filter((t) => t !== type));
    else if (selected.length >= 2) onChange([selected[1], type]);
    else onChange([...selected, type]);
  }

  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-9">
      {pokemonTypes.map((type) => {
        const on = selected.includes(type);
        return (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`rounded-md px-2 py-1.5 text-[11px] font-bold uppercase text-white transition ${
              on ? "ring-2 ring-white ring-offset-2 ring-offset-background" : "opacity-45 hover:opacity-80"
            }`}
            style={{ background: typeColors[type] }}
          >
            {type}
          </button>
        );
      })}
    </div>
  );
}

// ── Matchup grid ─────────────────────────────────────────────────────────────

function MatchupGrid({ types }: { types: PokemonType[] }) {
  const rows: { label: string; hint: string; cells: number[] }[] = [
    {
      label: "Takes",
      hint: "damage from each attacking type",
      cells: pokemonTypes.map((attacker) => multiplier(attacker, types)),
    },
    ...types.map((t) => ({
      label: `${t} hits`,
      hint: `${t}-type moves vs. each defending type`,
      cells: pokemonTypes.map((defender) => multiplier(t, [defender])),
    })),
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] table-fixed text-sm">
        <colgroup>
          <col className="w-[120px]" />
          {pokemonTypes.map((t) => <col key={t} />)}
        </colgroup>
        <thead>
          <tr>
            <th />
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
          {rows.map((r, i) => (
            <tr key={r.label} className={i === 1 ? "border-t-8 border-transparent" : ""}>
              <td className="pr-2 text-right" title={r.hint}>
                <span className="text-xs font-bold">{r.label}</span>
              </td>
              {r.cells.map((x, j) => <MultCell key={pokemonTypes[j]} x={x} />)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Summary({ types }: { types: PokemonType[] }) {
  const taken = pokemonTypes.map((a) => ({ t: a, x: multiplier(a, types) }));
  const groups = [
    { name: "Weak to",  list: taken.filter((r) => r.x > 1) },
    { name: "Resists",  list: taken.filter((r) => r.x > 0 && r.x < 1) },
    { name: "Immune to", list: taken.filter((r) => r.x === 0) },
  ];
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
      {groups.map((g) => (
        <span key={g.name}>
          <span className="font-semibold text-foreground">{g.name}:</span>{" "}
          {g.list.length ? g.list.map((r) => `${r.t}${r.x === 4 ? " (4×)" : r.x === 0.25 ? " (¼×)" : ""}`).join(", ") : "none"}
        </span>
      ))}
    </div>
  );
}

// ── Pokémon panel ────────────────────────────────────────────────────────────

function PokemonPanel({
  title,
  selected,
  onChange,
}: {
  title: string;
  selected: PokemonType[];
  onChange: (types: PokemonType[]) => void;
}) {
  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">{title}</h2>
        {selected.map((t) => <TypeBadge key={t} type={t} />)}
        <span className="text-xs text-muted-foreground">
          {selected.length === 0 ? "Pick a type" : selected.length === 1 ? "+ pick a second type for dual-type" : ""}
        </span>
      </div>

      <TypeSelector selected={selected} onChange={onChange} />

      {selected.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Select a type to see matchups
        </div>
      ) : (
        <div className="space-y-3">
          <MatchupGrid types={selected} />
          <Summary types={selected} />
        </div>
      )}
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TypeChartTool() {
  const [types1, setTypes1] = useState<PokemonType[]>(["Fire"]);
  const [types2, setTypes2] = useState<PokemonType[]>([]);
  const [showPokemon2, setShowPokemon2] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Click a type to select it, a second for dual-type, and again to deselect. Blank = normal damage.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {LEGEND.map((k) => (
            <span
              key={k}
              className="rounded px-2 py-0.5 text-xs font-bold"
              style={{ background: MULT_STYLE[k].bg, color: MULT_STYLE[k].fg }}
            >
              {MULT_STYLE[k].label}
            </span>
          ))}
        </div>
      </div>

      <PokemonPanel title="Pokémon 1" selected={types1} onChange={setTypes1} />

      <div className="space-y-3">
        <button
          onClick={() => setShowPokemon2((v) => !v)}
          className="flex items-center gap-2 rounded-lg border bg-muted px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted/80"
        >
          {showPokemon2 ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {showPokemon2 ? "Hide Pokémon 2" : "+ Add Pokémon 2 for comparison"}
        </button>
        {showPokemon2 && <PokemonPanel title="Pokémon 2" selected={types2} onChange={setTypes2} />}
      </div>
    </div>
  );
}
