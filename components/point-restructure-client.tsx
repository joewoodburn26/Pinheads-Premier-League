"use client";

import Image from "next/image";
import { useState, useTransition, useMemo } from "react";
import { Search, Download, Upload } from "lucide-react";
import { TypeBadge } from "@/components/type-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pokemonTypesFor } from "@/lib/type-chart";
import { updatePokemonCost } from "@/lib/actions";
import { updatePointsFromCsv } from "@/lib/settings-actions";
import type { Pokemon, Season } from "@/lib/types";

// ── CSV generation with sprites and stats ─────────────────────────────────────

function generateCsv(pokemon: Pokemon[]): string {
  const header = [
    "Pokedex #", "Name", "Sprite URL",
    "Primary Type", "Secondary Type",
    "HP", "Attack", "Defense", "Sp. Atk", "Sp. Def", "Speed", "BST",
    "Points"
  ].join(",");

  const rows = [...pokemon]
    .sort((a, b) => a.dexNumber - b.dexNumber)
    .map((p) => {
      const types = pokemonTypesFor(p);
      return [
        p.dexNumber,
        `"${p.name}"`,
        p.spriteUrl,
        types[0] ?? "",
        types[1] ?? "",
        p.hp, p.attack, p.defense,
        p.specialAttack, p.specialDefense, p.speed, p.bst,
        p.pointValue,
      ].join(",");
    });

  return [header, ...rows].join("\n");
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PointRestructureClient({
  pokemon, seasonId, seasons,
}: {
  pokemon: Pokemon[];
  seasonId: string;
  seasons: Season[];
}) {
  const [query,     setQuery]     = useState("");
  const [edits,     setEdits]     = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  const [message,   setMessage]   = useState("");
  const [csvMsg,    setCsvMsg]    = useState("");

  const currentSeason = seasons.find(s => s.id === seasonId);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return [...pokemon]
      .filter(p => p.name.toLowerCase().includes(q) || String(p.dexNumber).includes(q))
      .sort((a, b) => a.dexNumber - b.dexNumber);
  }, [pokemon, query]);

  const hasChanges = Object.keys(edits).length > 0;

  function handleEdit(id: string, value: number) {
    setEdits(prev => ({ ...prev, [id]: value }));
  }

  function handleSave() {
    const updates = Object.entries(edits);
    startTransition(async () => {
      for (const [id, pointValue] of updates) {
        await updatePokemonCost(id, pointValue, seasonId);
      }
      setMessage(`✓ Saved ${updates.length} change${updates.length !== 1 ? "s" : ""} to ${currentSeason?.name}`);
      setEdits({});
      setTimeout(() => setMessage(""), 3000);
    });
  }

  function handleDownload() {
    const csv = generateCsv(pokemon);
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `pokemon-points-${currentSeason?.name?.replace(/\s+/g, "-").toLowerCase() ?? "season"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("seasonId", seasonId);
    startTransition(async () => {
      const result = await updatePointsFromCsv(fd);
      if (result.ok) setCsvMsg(`✓ Updated ${result.updated} Pokémon from CSV`);
      else           setCsvMsg(`✗ ${result.error ?? "Upload failed"}`);
      setTimeout(() => setCsvMsg(""), 4000);
    });
  }

  return (
    <div className="space-y-6">
      {/* CSV actions */}
      <Card className="p-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="font-semibold text-sm mb-1">Bulk Edit via CSV</p>
          <p className="text-xs text-muted-foreground">
            Download → edit Points column in Excel → re-upload. CSV includes sprite URL and all stats for reference.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 ml-auto items-center">
          <Button variant="secondary" onClick={handleDownload}>
            <Download size={16} className="mr-2" /> Download CSV
          </Button>
          <label className="cursor-pointer flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80 transition-colors">
            <Upload size={16} /> Upload CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleUpload} disabled={isPending} />
          </label>
          {csvMsg && <p className="text-sm text-muted-foreground">{csvMsg}</p>}
        </div>
      </Card>

      {/* Inline editor */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
            <Input className="pl-9" placeholder="Search by name or Pokédex #"
              value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          {hasChanges && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {Object.keys(edits).length} unsaved change{Object.keys(edits).length !== 1 ? "s" : ""}
              </span>
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="secondary" onClick={() => setEdits({})}>Discard</Button>
              {message && <span className="text-sm text-green-400">{message}</span>}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="p-3 text-left w-16">#</th>
                <th className="p-3 text-left">Pokémon</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-center">HP</th>
                <th className="p-3 text-center">Atk</th>
                <th className="p-3 text-center">Def</th>
                <th className="p-3 text-center">SpA</th>
                <th className="p-3 text-center">SpD</th>
                <th className="p-3 text-center">Spe</th>
                <th className="p-3 text-center">BST</th>
                <th className="p-3 text-center w-24">Points</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => {
                const types       = pokemonTypesFor(p);
                const currentValue = edits[p.id] ?? p.pointValue;
                const isDirty     = edits[p.id] !== undefined && edits[p.id] !== p.pointValue;
                return (
                  <tr key={p.id} className={`border-t transition-colors ${isDirty ? "bg-primary/5" : idx % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="p-3 font-mono text-muted-foreground text-xs">
                      #{String(p.dexNumber).padStart(4, "0")}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Image src={p.spriteUrl} alt={p.name} width={32} height={32} className="size-7 object-contain shrink-0" />
                        <span className="font-semibold">{p.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {types.map(t => <TypeBadge key={t} type={t} />)}
                      </div>
                    </td>
                    <td className="p-3 text-center text-xs font-mono">{p.hp}</td>
                    <td className="p-3 text-center text-xs font-mono">{p.attack}</td>
                    <td className="p-3 text-center text-xs font-mono">{p.defense}</td>
                    <td className="p-3 text-center text-xs font-mono">{p.specialAttack}</td>
                    <td className="p-3 text-center text-xs font-mono">{p.specialDefense}</td>
                    <td className="p-3 text-center text-xs font-mono">{p.speed}</td>
                    <td className="p-3 text-center text-xs font-bold text-primary">{p.bst}</td>
                    <td className="p-3">
                      <Input
                        type="number" min={1} max={30}
                        value={currentValue}
                        onChange={e => handleEdit(p.id, parseInt(e.target.value) || 1)}
                        className={`h-8 w-20 mx-auto text-center text-sm font-bold ${isDirty ? "border-primary ring-1 ring-primary" : ""}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
