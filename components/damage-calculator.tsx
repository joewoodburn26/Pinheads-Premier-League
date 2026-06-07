"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Pokemon } from "@/lib/types";

export function DamageCalculator({ pokemon }: { pokemon: Pokemon[] }) {
  const [attackerId, setAttackerId] = useState(pokemon[0]?.id ?? "");
  const [defenderId, setDefenderId] = useState(pokemon[1]?.id ?? "");
  const [level, setLevel] = useState(50);
  const [power, setPower] = useState(80);
  const attacker = pokemon.find((mon) => mon.id === attackerId) ?? pokemon[0];
  const defender = pokemon.find((mon) => mon.id === defenderId) ?? pokemon[1] ?? pokemon[0];

  const result = useMemo(() => {
    if (!attacker || !defender) return { min: 0, max: 0, ohko: "0%", twohko: "0%" };
    const base = Math.floor((((2 * level / 5 + 2) * power * attacker.attack / Math.max(1, defender.defense)) / 50) + 2);
    const min = Math.floor(base * 0.85);
    const max = base;
    const hp = Math.max(1, defender.hp);
    return {
      min,
      max,
      ohko: max >= hp ? "Possible" : "0%",
      twohko: min * 2 >= hp ? "Guaranteed" : max * 2 >= hp ? "Possible" : "0%"
    };
  }, [attacker, defender, level, power]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="grid gap-4 p-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm">Attacker<Select value={attackerId} onChange={(e) => setAttackerId(e.target.value)}>{pokemon.map((mon) => <option key={mon.id} value={mon.id}>{mon.name}</option>)}</Select></label>
        <label className="grid gap-2 text-sm">Defender<Select value={defenderId} onChange={(e) => setDefenderId(e.target.value)}>{pokemon.map((mon) => <option key={mon.id} value={mon.id}>{mon.name}</option>)}</Select></label>
        <label className="grid gap-2 text-sm">Level<Input type="number" value={level} onChange={(e) => setLevel(Number(e.target.value))} /></label>
        <label className="grid gap-2 text-sm">Base Power<Input type="number" value={power} onChange={(e) => setPower(Number(e.target.value))} /></label>
        {["Nature", "Ability", "Item", "EVs", "IVs"].map((field) => <label key={field} className="grid gap-2 text-sm">{field}<Input placeholder={field} /></label>)}
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="text-xl font-black">Output</h2>
        <div className="rounded-md bg-muted p-4">
          <p className="text-sm text-muted-foreground">Damage Range</p>
          <p className="text-3xl font-black">{result.min}-{result.max}</p>
        </div>
        <p>OHKO chance: <b>{result.ohko}</b></p>
        <p>2HKO chance: <b>{result.twohko}</b></p>
      </Card>
    </div>
  );
}
