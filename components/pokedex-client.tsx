"use client";

import Image from "next/image";
import { useState, useTransition, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TypeBadge } from "@/components/type-badge";
import { pokemonTypesFor } from "@/lib/type-chart";
import { toggleBan, updatePointValue } from "@/lib/pokedex-actions";
import type { Pokemon, PokemonType } from "@/lib/types";

type FilterTab = "all" | "active" | "banned" | "legendary" | "mythical" | "paradox";

function BanToggle({ mon }: { mon: Pokemon & { banned?: boolean } }) {
  const [isPending, startTransition] = useTransition();
  const [banned, setBanned] = useState(mon.banned ?? false);

  function handleToggle() {
    const next = !banned;
    setBanned(next);
    startTransition(async () => {
      await toggleBan(mon.id, next);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
        banned ? "bg-destructive/60" : "bg-green-500"
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
        banned ? "translate-x-0.5" : "translate-x-5"
      }`} />
    </button>
  );
}

function PointEditor({ mon }: { mon: Pokemon }) {
  const [isPending, startTransition] = useTransition();
  const [pts, setPts] = useState(String(mon.pointValue));
  const [saved, setSaved] = useState(false);

  function handleBlur() {
    const val = parseInt(pts);
    if (isNaN(val) || val === mon.pointValue) return;
    startTransition(async () => {
      await updatePointValue(mon.id, val);
      setSaved(true);
      setTimeout(() => setSaved(false), 1000);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        value={pts}
        onChange={e => setPts(e.target.value)}
        onBlur={handleBlur}
        disabled={isPending}
        className="w-16 h-7 text-center text-xs"
      />
      {saved && <span className="text-xs text-green-400">✓</span>}
    </div>
  );
}

export function PokedexClient({ pokemon }: { pokemon: (Pokemon & { banned?: boolean })[] }) {
  const [query,     setQuery]     = useState("");
  const [tab,       setTab]       = useState<FilterTab>("all");
  const [typeFilter, setTypeFilter] = useState<PokemonType | "">("");

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all",       label: `All (${pokemon.length})`                         },
    { key: "active",    label: `Active (${pokemon.filter(p => !p.banned).length})` },
    { key: "banned",    label: `Banned (${pokemon.filter(p => p.banned).length})`  },
    { key: "legendary", label: `Legendary`                                        },
    { key: "mythical",  label: `Mythical`                                         },
    { key: "paradox",   label: `Paradox`                                          },
  ];

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return pokemon.filter(mon => {
      if (q && !mon.name.toLowerCase().includes(q)) return false;
      if (typeFilter && !pokemonTypesFor(mon).includes(typeFilter)) return false;
      if (tab === "active"    && mon.banned)     return false;
      if (tab === "banned"    && !mon.banned)    return false;
      if (tab === "legendary" && !mon.legendary) return false;
      if (tab === "mythical"  && !mon.mythical)  return false;
      if (tab === "paradox"   && !mon.paradox)   return false;
      return true;
    });
  }, [pokemon, query, tab, typeFilter]);

  const types: PokemonType[] = [
    "Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison",
    "Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black">Pokédex</h1>
        <p className="text-muted-foreground mt-1">
          Ban or unban Pokémon · Banned Pokémon are hidden from Draft and Rosters · Edit point values inline
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + type filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
          <Input className="pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Pokémon…" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as PokemonType | "")}
          className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} Pokémon shown</p>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3 text-left">#</th>
              <th className="p-3 text-left">Pokémon</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-center">BST</th>
              <th className="p-3 text-center">Points</th>
              <th className="p-3 text-center">Category</th>
              <th className="p-3 text-center">Active</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(mon => (
              <tr key={mon.id} className={`border-t transition-colors ${mon.banned ? "opacity-50 bg-destructive/5" : "hover:bg-muted/20"}`}>
                <td className="p-3 text-xs text-muted-foreground font-mono">
                  #{String(mon.dexNumber).padStart(4, "0")}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Image src={mon.spriteUrl} alt={mon.name} width={32} height={32} className="size-7 object-contain" />
                    <span className={`font-semibold ${mon.banned ? "line-through text-muted-foreground" : ""}`}>
                      {mon.name}
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex gap-1 flex-wrap">
                    {pokemonTypesFor(mon).map(t => <TypeBadge key={t} type={t} />)}
                  </div>
                </td>
                <td className="p-3 text-center font-mono text-xs">{mon.bst}</td>
                <td className="p-3 text-center">
                  <PointEditor mon={mon} />
                </td>
                <td className="p-3 text-center text-xs text-muted-foreground">
                  {mon.legendary ? "Legendary" : mon.mythical ? "Mythical" : mon.paradox ? "Paradox" : "—"}
                </td>
                <td className="p-3 text-center">
                  <BanToggle mon={mon} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
