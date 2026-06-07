"use client";

import { useState } from "react";
import { TypeBadge } from "@/components/type-badge";
import { Card } from "@/components/ui/card";
import { defenseProfile, offenseProfile, pokemonTypes } from "@/lib/type-chart";
import type { PokemonType } from "@/lib/types";

export function TypeChartTool() {
  const [selected, setSelected] = useState<PokemonType>("Fire");
  const offense = offenseProfile(selected);
  const defense = defenseProfile([selected]);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-2">
        {pokemonTypes.map((type) => (
          <button key={type} onClick={() => setSelected(type)} className={`rounded-md border p-2 ${selected === type ? "border-primary bg-primary/10" : "bg-muted/50"}`}>
            <TypeBadge type={type} />
          </button>
        ))}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={`${selected} Offense Strengths`} values={offense.strengths} />
        <Panel title={`${selected} Offense Weaknesses`} values={[...offense.weaknesses, ...offense.immunities]} />
        <Panel title={`${selected} Defensive Strengths`} values={[...defense.resistances, ...defense.immunities]} />
        <Panel title={`${selected} Defensive Weaknesses`} values={defense.weaknesses} />
      </div>
    </div>
  );
}

function Panel({ title, values }: { title: string; values: PokemonType[] }) {
  return (
    <Card className="p-4">
      <h2 className="mb-3 font-bold">{title}</h2>
      <div className="flex flex-wrap gap-2">{values.length ? values.map((type) => <TypeBadge key={type} type={type} />) : <span className="text-sm text-muted-foreground">None</span>}</div>
    </Card>
  );
}
