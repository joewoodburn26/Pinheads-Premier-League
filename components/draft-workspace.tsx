"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { PointEditor } from "@/components/point-editor";
import { TypeBadge } from "@/components/type-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { defenseProfile, pokemonTypes, pokemonTypesFor } from "@/lib/type-chart";
import type { Pokemon, PokemonType } from "@/lib/types";

export function DraftWorkspace({ pokemon, budget }: { pokemon: Pokemon[]; budget: number }) {
  const legal = pokemon.filter((mon) => !mon.legendary && !mon.mythical && !mon.paradox);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const [builder, setBuilder] = useState<Pokemon[]>([]);

  const filtered = useMemo(() => legal.filter((mon) => {
    const matchesQuery = mon.name.toLowerCase().includes(query.toLowerCase());
    const types = pokemonTypesFor(mon);
    return matchesQuery && (type === "all" || types.includes(type as PokemonType));
  }), [legal, query, type]);

  const used = builder.reduce((sum, mon) => sum + mon.pointValue, 0);
  const typeDistribution = pokemonTypes.map((item) => ({
    type: item,
    count: builder.filter((mon) => pokemonTypesFor(mon).includes(item)).length
  })).filter((row) => row.count > 0);
  const weaknesses = pokemonTypes.map((item) => ({
    type: item,
    count: builder.filter((mon) => defenseProfile(pokemonTypesFor(mon)).weaknesses.includes(item)).length
  })).filter((row) => row.count > 0).sort((a, b) => b.count - a.count);
  const speeds = [...builder].sort((a, b) => b.speed - a.speed);
  const avgBst = builder.length ? Math.round(builder.reduce((sum, mon) => sum + mon.bst, 0) / builder.length) : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section className="space-y-4">
        <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_180px_140px_140px]">
          <label className="relative">
            <Search className="absolute left-3 top-3 text-muted-foreground" size={16} />
            <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Pokemon" />
          </label>
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">All types</option>
            {pokemonTypes.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Input placeholder="Point value" />
          <Input placeholder="BST / Speed / Stat" />
        </div>
        <div className="grid gap-3">
          {filtered.map((mon) => (
            <Card key={mon.id} className="grid gap-4 p-4 md:grid-cols-[72px_1fr_auto]">
              <Image src={mon.spriteUrl} alt={mon.name} width={72} height={72} className="size-18 object-contain" />
              <div>
                <h3 className="font-bold">{mon.name}</h3>
                <p className="text-sm text-muted-foreground">
                  BST {mon.bst} · Spe {mon.speed} · Atk {mon.attack} · Def {mon.defense} · SpA {mon.specialAttack} · SpD {mon.specialDefense}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">{pokemonTypesFor(mon).map((item) => <TypeBadge key={item} type={item} />)}</div>
              </div>
              <div className="flex flex-col items-start justify-center gap-2">
                <PointEditor pokemonId={mon.id} value={mon.pointValue} />
                <Button variant="secondary" disabled={builder.length >= 10 || builder.some((item) => item.id === mon.id)} onClick={() => setBuilder([...builder, mon])}>
                  Add
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
      <aside className="space-y-4">
        <Card className="p-4">
          <h2 className="text-xl font-black">Team Builder</h2>
          <p className="text-sm text-muted-foreground">Client-side only. Nothing here is saved.</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-md bg-muted p-3"><b>{used}</b><br />Used</div>
            <div className="rounded-md bg-muted p-3"><b>{budget - used}</b><br />Left</div>
            <div className="rounded-md bg-muted p-3"><b>{avgBst}</b><br />Avg BST</div>
          </div>
          <div className="mt-4 space-y-2">
            {builder.map((mon) => (
              <div key={mon.id} className="flex items-center justify-between rounded-md bg-muted p-2 text-sm">
                <span>{mon.name} · {mon.pointValue}</span>
                <button onClick={() => setBuilder(builder.filter((item) => item.id !== mon.id))}><X size={16} /></button>
              </div>
            ))}
          </div>
        </Card>
        <Card className="space-y-3 p-4">
          <h3 className="font-bold">Type Distribution</h3>
          <p className="text-sm text-muted-foreground">{typeDistribution.map((row) => `${row.type} ${row.count}`).join(" · ") || "No Pokemon selected"}</p>
          <h3 className="font-bold">Weakness Summary</h3>
          <p className="text-sm text-muted-foreground">{weaknesses.slice(0, 8).map((row) => `${row.type} ${row.count}`).join(" · ") || "No weaknesses yet"}</p>
          <h3 className="font-bold">Speed Tiers</h3>
          <p className="text-sm text-muted-foreground">{speeds.map((mon) => `${mon.name} ${mon.speed}`).join(" · ") || "No Pokemon selected"}</p>
        </Card>
        <Card className="p-4">
          <h3 className="font-bold">AI Analysis</h3>
          <p className="text-sm text-muted-foreground">Future assistant review will evaluate matchup spread, role compression, speed control, and draft value.</p>
        </Card>
      </aside>
    </div>
  );
}
