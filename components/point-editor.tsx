"use client";

import { useState, useTransition } from "react";
import { Minus, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updatePokemonCost } from "@/lib/actions";

export function PointEditor({ pokemonId, value }: { pokemonId: string; value: number }) {
  const [cost, setCost] = useState(value);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Current Cost: {cost}</span>
      <Button type="button" variant="secondary" className="size-8 px-0" onClick={() => setCost(Math.max(0, cost - 1))}>
        <Minus size={14} />
      </Button>
      <Button type="button" variant="secondary" className="size-8 px-0" onClick={() => setCost(cost + 1)}>
        <Plus size={14} />
      </Button>
      <Button
        type="button"
        className="size-8 px-0"
        disabled={pending}
        onClick={() => startTransition(() => updatePokemonCost(pokemonId, cost))}
      >
        <Save size={14} />
      </Button>
    </div>
  );
}
