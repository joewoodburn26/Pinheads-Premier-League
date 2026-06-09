"use client";

import { useState } from "react";
import { TypeBadge } from "@/components/type-badge";
import { Card } from "@/components/ui/card";
import { defenseProfile, offenseProfile, pokemonTypes } from "@/lib/type-chart";
import type { PokemonType } from "@/lib/types";

export function TypeChartTool() {
  const [selected, setSelected] = useState<PokemonType[]>(["Fire"]);

  function toggleType(type: PokemonType) {
    setSelected((prev) => {
      if (prev.includes(type)) {
        // Don't allow deselecting if it's the only one
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== type);
      }
      // Max 2 types
      if (prev.length >= 2) return [prev[1], type];
      return [...prev, type];
    });
  }

  // For offense, use primary type only
  const offense = offenseProfile(selected[0]);
  // For defense, use both selected types
  const defense = defenseProfile(selected);

  const label = selected.length === 2
    ? `${selected[0]} / ${selected[1]}`
    : selected[0];

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <p className="text-sm text-muted-foreground">
        Click one type for a single-type Pokémon. Click two types for a dual-type (e.g. Water + Ground for Swampert).
        Click a selected type again to deselect it.
      </p>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Type selector */}
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap gap-1">
            {selected.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
            {selected.length < 2 && (
              <span className="text-xs text-muted-foreground self-center ml-1">
                + select a second type
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
            {pokemonTypes.map((type) => {
              const isSelected = selected.includes(type);
              const isPrimary = selected[0] === type;
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`rounded-md border p-2 transition-colors ${
                    isPrimary
                      ? "border-primary bg-primary/20 ring-1 ring-primary"
                      : isSelected
                      ? "border-primary bg-primary/10"
                      : "bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <TypeBadge type={type} />
                </button>
              );
            })}
          </div>
        </Card>

        {/* Results */}
        <div className="grid gap-4 md:grid-cols-2">
          <Panel
            title={`${selected[0]} Offense — Super Effective`}
            values={offense.strengths}
            note={selected.length === 2 ? `Based on ${selected[0]} only` : undefined}
          />
          <Panel
            title={`${selected[0]} Offense — Not Very Effective`}
            values={[...offense.weaknesses, ...offense.immunities]}
            note={selected.length === 2 ? `Based on ${selected[0]} only` : undefined}
          />
          <Panel
            title={`${label} Defense — Resists / Immune`}
            values={[...defense.resistances, ...defense.immunities]}
          />
          <Panel
            title={`${label} Defense — Weak To`}
            values={defense.weaknesses}
            highlight
          />
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  values,
  note,
  highlight,
}: {
  title: string;
  values: PokemonType[];
  note?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`p-4 ${highlight && values.length > 0 ? "border-red-500/40" : ""}`}>
      <h2 className="mb-1 font-bold">{title}</h2>
      {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
      <div className="flex flex-wrap gap-2">
        {values.length ? (
          values.map((type) => <TypeBadge key={type} type={type} />)
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        )}
      </div>
    </Card>
  );
}