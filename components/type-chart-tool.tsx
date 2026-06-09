"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TypeBadge } from "@/components/type-badge";
import { Card } from "@/components/ui/card";
import { multiplier, pokemonTypes } from "@/lib/type-chart";
import type { PokemonType } from "@/lib/types";

// ── Border style — only 4x and immune ────────────────────────────────────────

type BorderMode = "effective" | "resist";

function borderStyle(mult: number, mode: BorderMode): string {
  if (mult === 0)                        return "outline outline-[3px] outline-offset-1 outline-gray-400 rounded-md";
  if (mode === "effective" && mult >= 4) return "outline outline-[3px] outline-offset-1 outline-green-400 rounded-md";
  if (mode === "resist" && mult <= 0.25) return "outline outline-[3px] outline-offset-1 outline-red-500 rounded-md";
  return "";
}

// ── Single offense panel for ONE attack type ─────────────────────────────────

function SingleOffensePanel({
  attackType,
  mode,
}: {
  attackType: PokemonType;
  mode: "effective" | "resist";
}) {
  const rows = pokemonTypes.map((defender) => ({
    type: defender,
    mult: multiplier(attackType, [defender]),
  }));

  const shown = mode === "effective"
    ? rows.filter((r) => r.mult > 1)
    : rows.filter((r) => r.mult < 1);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <TypeBadge type={attackType} />
        <span className="text-xs text-muted-foreground">
          {mode === "effective" ? "super effective against:" : "not very effective against:"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 pl-1">
        {shown.length ? (
          shown.map(({ type, mult }) => (
            <div key={type} className={borderStyle(mult, mode)}>
              <TypeBadge type={type} />
            </div>
          ))
        ) : (
          <span className="text-xs text-muted-foreground italic">None</span>
        )}
      </div>
    </div>
  );
}

// ── Offense card — splits by type if dual ────────────────────────────────────

function OffenseCard({
  label,
  attackTypes,
  mode,
}: {
  label: string;
  attackTypes: PokemonType[];
  mode: "effective" | "resist";
}) {
  const title = mode === "effective"
    ? `${label} Offense — Super Effective`
    : `${label} Offense — Not Very Effective`;

  return (
    <Card className="p-4">
      <h2 className="mb-3 font-bold">{title}</h2>
      <div className="space-y-3">
        {attackTypes.map((type) => (
          <SingleOffensePanel key={type} attackType={type} mode={mode} />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {mode === "effective"
          ? "🟢 outlined = 4×"
          : "⬜ outlined = immune  🔴 outlined = ¼×"}
      </p>
    </Card>
  );
}

// ── Defense card ─────────────────────────────────────────────────────────────

function DefenseCard({
  label,
  defenseTypes,
  mode,
}: {
  label: string;
  defenseTypes: PokemonType[];
  mode: "effective" | "resist";
}) {
  const title = mode === "effective"
    ? `${label} Defense — Weak To`
    : `${label} Defense — Resists / Immune`;

  const rows = pokemonTypes.map((attacker) => ({
    type: attacker,
    mult: multiplier(attacker, defenseTypes),
  }));

  const shown = mode === "effective"
    ? rows.filter((r) => r.mult > 1)
    : rows.filter((r) => r.mult < 1);

  return (
    <Card className="p-4">
      <h2 className="mb-3 font-bold">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {shown.length ? (
          shown.map(({ type, mult }) => (
            <div key={type} className={borderStyle(mult, mode)}>
              <TypeBadge type={type} />
            </div>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {mode === "effective"
          ? "🟢 outlined = 4×"
          : "⬜ outlined = immune  🔴 outlined = ¼×"}
      </p>
    </Card>
  );
}

// ── Type selector ─────────────────────────────────────────────────────────────

function TypeSelector({
  selected,
  onChange,
}: {
  selected: PokemonType[];
  onChange: (types: PokemonType[]) => void;
}) {
  function toggleType(type: PokemonType) {
    if (selected.includes(type)) {
      onChange(selected.filter((t) => t !== type));
    } else if (selected.length >= 2) {
      onChange([selected[1], type]);
    } else {
      onChange([...selected, type]);
    }
  }

  return (
    <div>
      <div className="mb-3 min-h-8 flex flex-wrap gap-1 items-center">
        {selected.length === 0 ? (
          <span className="text-sm text-muted-foreground">No type selected</span>
        ) : (
          selected.map((t) => <TypeBadge key={t} type={t} />)
        )}
        {selected.length === 1 && (
          <span className="text-xs text-muted-foreground ml-1">+ select a second type</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {pokemonTypes.map((type) => {
          const isSelected = selected.includes(type);
          const isPrimary  = selected[0] === type;
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`rounded-md border p-2 transition-colors ${
                isPrimary
                  ? "border-primary bg-primary/20 ring-2 ring-primary"
                  : isSelected
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "bg-muted/50 hover:bg-muted"
              }`}
            >
              <TypeBadge type={type} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Pokémon panel (selector + results) ───────────────────────────────────────

function PokemonPanel({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: PokemonType[];
  onChange: (types: PokemonType[]) => void;
}) {
  const typeLabel = selected.length === 0
    ? "No type"
    : selected.join(" / ");

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Selector */}
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <TypeSelector selected={selected} onChange={onChange} />
        </Card>

        {/* Results */}
        {selected.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
            Select a type to see matchups
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <OffenseCard label={typeLabel} attackTypes={selected} mode="effective" />
            <OffenseCard label={typeLabel} attackTypes={selected} mode="resist" />
            <DefenseCard label={typeLabel} defenseTypes={selected} mode="resist" />
            <DefenseCard label={typeLabel} defenseTypes={selected} mode="effective" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TypeChartTool() {
  const [types1, setTypes1] = useState<PokemonType[]>(["Fire"]);
  const [types2, setTypes2] = useState<PokemonType[]>([]);
  const [showPokemon2, setShowPokemon2] = useState(false);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Click a type to select it. Click a second for dual-type. Click again to deselect.
      </p>

      {/* Pokémon 1 — always visible */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Pokémon 1</h2>
        <PokemonPanel label="Select typing" selected={types1} onChange={setTypes1} />
      </div>

      {/* Pokémon 2 — toggle */}
      <div className="space-y-2">
        <button
          onClick={() => setShowPokemon2((v) => !v)}
          className="flex items-center gap-2 rounded-lg border bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/80 transition-colors"
        >
          {showPokemon2 ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {showPokemon2 ? "Hide Pokémon 2" : "+ Add Pokémon 2 for comparison"}
        </button>

        {showPokemon2 && (
          <div className="space-y-2 pt-2">
            <h2 className="text-xl font-bold">Pokémon 2</h2>
            <PokemonPanel label="Select typing" selected={types2} onChange={setTypes2} />
          </div>
        )}
      </div>
    </div>
  );
}