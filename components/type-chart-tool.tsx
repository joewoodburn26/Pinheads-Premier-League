"use client";

import { useState } from "react";
import { TypeBadge } from "@/components/type-badge";
import { Card } from "@/components/ui/card";
import { multiplier, offenseProfile, pokemonTypes } from "@/lib/type-chart";
import type { PokemonType } from "@/lib/types";

// ── Border style based on multiplier ────────────────────────────────────────
// For "effective" panels (bigger = better): 4x green thick, 2x green thin, immune gray
// For "resist" panels (smaller = better):   0.25x red thick, 0.5x red thin, immune gray

type BorderMode = "effective" | "resist";

function borderStyle(mult: number, mode: BorderMode): string {
  if (mult === 0) return "ring-2 ring-gray-400";
  if (mode === "effective") {
    if (mult >= 4) return "ring-4 ring-green-400";
    if (mult >= 2) return "ring-2 ring-green-400";
  } else {
    if (mult <= 0.25) return "ring-4 ring-red-500";
    if (mult <= 0.5)  return "ring-2 ring-red-500";
  }
  return "";
}

// ── Offense panel ────────────────────────────────────────────────────────────
// Shows what happens when you attack WITH selectedTypes INTO each defender type.
// For a dual offense we calculate both types and take the best result per defender.

function OffensePanel({
  title,
  attackTypes,
  mode,        // "effective" = super effective panel, "resist" = not very effective panel
}: {
  title: string;
  attackTypes: PokemonType[];
  mode: "effective" | "resist";
}) {
  // For each defender type, find the best multiplier across all attack types
  const rows = pokemonTypes.map((defender) => {
    const mults = attackTypes.map((atk) => multiplier(atk, [defender]));
    const best = mode === "effective" ? Math.max(...mults) : Math.min(...mults);
    return { type: defender, mult: best };
  });

  const shown = mode === "effective"
    ? rows.filter((r) => r.mult > 1)
    : rows.filter((r) => r.mult < 1);

  return (
    <Card className="p-4">
      <h2 className="mb-3 font-bold">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {shown.length ? (
          shown.map(({ type, mult }) => (
            <div key={type} className={`rounded-md ${borderStyle(mult, mode)}`}>
              <TypeBadge type={type} />
            </div>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        )}
      </div>
      {shown.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {mode === "effective"
            ? "🟢 thick = 4×  thin = 2×"
            : "⬜ gray = immune  🔴 thick = ¼×  thin = ½×"}
        </p>
      )}
    </Card>
  );
}

// ── Defense panel ────────────────────────────────────────────────────────────
// Shows what happens when attackers of each type hit YOUR selected type combo.

function DefensePanel({
  title,
  defenseTypes,
  mode,
}: {
  title: string;
  defenseTypes: PokemonType[];
  mode: "effective" | "resist";
}) {
  const rows = pokemonTypes.map((attacker) => {
    const mult = multiplier(attacker, defenseTypes);
    return { type: attacker, mult };
  });

  const shown = mode === "effective"
    ? rows.filter((r) => r.mult > 1)
    : rows.filter((r) => r.mult < 1);

  return (
    <Card className={`p-4 ${mode === "effective" && shown.some((r) => r.mult >= 4) ? "border-green-500/40" : ""}`}>
      <h2 className="mb-3 font-bold">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {shown.length ? (
          shown.map(({ type, mult }) => (
            <div key={type} className={`rounded-md ${borderStyle(mult, mode)}`}>
              <TypeBadge type={type} />
            </div>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        )}
      </div>
      {shown.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {mode === "effective"
            ? "🟢 thick = 4×  thin = 2×"
            : "⬜ gray = immune  🔴 thick = ¼×  thin = ½×"}
        </p>
      )}
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TypeChartTool() {
  const [selected, setSelected] = useState<PokemonType[]>(["Fire"]);

  function toggleType(type: PokemonType) {
    setSelected((prev) => {
      if (prev.includes(type)) {
        // Allow full deselect — if removing leaves 0, clear to empty
        const next = prev.filter((t) => t !== type);
        return next; // can be empty
      }
      if (prev.length >= 2) {
        // Replace oldest selection
        return [prev[1], type];
      }
      return [...prev, type];
    });
  }

  const label = selected.length === 0
    ? "None"
    : selected.length === 2
    ? `${selected[0]} / ${selected[1]}`
    : selected[0];

  // For offense we show both types' coverage combined
  const offenseTypes = selected.length > 0 ? selected : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Click a type to select it. Click a second type for dual-type (e.g. Water + Ground for Swampert).
        Click a selected type again to deselect it. You can deselect all.
      </p>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Type selector */}
        <Card className="p-4">
          {/* Selected display */}
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

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
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
        </Card>

        {/* Results — show placeholder if nothing selected */}
        {selected.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            Select a type to see matchups
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <OffensePanel
              title={`${label} Offense — Super Effective`}
              attackTypes={offenseTypes}
              mode="effective"
            />
            <OffensePanel
              title={`${label} Offense — Not Very Effective`}
              attackTypes={offenseTypes}
              mode="resist"
            />
            <DefensePanel
              title={`${label} Defense — Resists / Immune`}
              defenseTypes={selected}
              mode="resist"
            />
            <DefensePanel
              title={`${label} Defense — Weak To`}
              defenseTypes={selected}
              mode="effective"
            />
          </div>
        )}
      </div>
    </div>
  );
}