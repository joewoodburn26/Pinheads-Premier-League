"use client";

import { useState, useTransition, useMemo } from "react";
import { Search, Download } from "lucide-react";
import { TypeBadge } from "@/components/type-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pokemonTypesFor } from "@/lib/type-chart";
import { updatePokemonPoints, updatePointsFromCsv } from "@/lib/settings-actions";
import type { Pokemon } from "@/lib/types";

function generateCsv(pokemon: Pokemon[]): string {
  const header = "Pokedex Number,Name,Typing,Tier";
  const rows = [...pokemon]
    .sort((a, b) => a.dexNumber - b.dexNumber)
    .map((p) => {
      const types = pokemonTypesFor(p);
      const typing = types.length === 2 ? `${types[0]} - ${types[1]}` : types[0];
      return `${p.dexNumber},${p.name},${typing},${p.pointValue}`;
    });
  return [header, ...rows].join("\n");
}

export function PointRestructurePage({ pokemon }: { pokemon: Pokemon[] }) {
  const [query, setQuery]       = useState("");
  const [edits, setEdits]       = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  const [message, setMessage]   = useState("");
  const [csvMessage, setCsvMessage] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return [...pokemon]
      .filter((p) => p.name.toLowerCase().includes(q) || String(p.dexNumber).includes(q))
      .sort((a, b) => a.dexNumber - b.dexNumber);
  }, [pokemon, query]);

  const hasChanges = Object.keys(edits).length > 0;

  function handleEdit(id: string, value: number) {
    setEdits((prev) => ({ ...prev, [id]: value }));
  }

  function handleSave() {
    const updates = Object.entries(edits).map(([id, pointValue]) => ({ id, pointValue }));
    startTransition(async () => {
      const result = await updatePokemonPoints(updates);
      if (result.ok) {
        setMessage(`✓ Saved ${updates.length} change${updates.length !== 1 ? "s" : ""}`);
        setEdits({});
      } else {
        setMessage("✗ Save failed");
      }
      setTimeout(() => setMessage(""), 3000);
    });
  }

  function handleDownload() {
    const csv = generateCsv(pokemon);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pokemon-points.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await updatePointsFromCsv(formData);
      if (result.ok) {
        setCsvMessage(`✓ Updated ${result.updated} Pokémon from CSV`);
        setEdits({});
      } else {
        setCsvMessage(`✗ ${result.error ?? "Upload failed"}`);
      }
      setTimeout(() => setCsvMessage(""), 4000);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black">Point Restructure</h1>
        <p className="mt-1 text-muted-foreground">
          Edit point values inline or download the CSV, edit in Excel, and re-upload.
        </p>
      </div>

      {/* CSV actions */}
      <Card className="p-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="font-semibold text-sm mb-1">Bulk Edit via CSV</p>
          <p className="text-xs text-muted-foreground">
            Download → edit the Tier column in Excel → upload to apply all changes at once.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 ml-auto items-center">
          <Button variant="secondary" onClick={handleDownload}>
            <Download size={16} className="mr-2" /> Download CSV
          </Button>
          <label className="cursor-pointer rounded-md border bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80 transition-colors">
            Upload CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleUpload} disabled={isPending} />
          </label>
          {csvMessage && <p className="text-sm text-muted-foreground">{csvMessage}</p>}
        </div>
      </Card>

      {/* Inline editor */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
            <Input
              className="pl-9"
              placeholder="Search by name or Pokédex #"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {hasChanges && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{Object.keys(edits).length} unsaved change{Object.keys(edits).length !== 1 ? "s" : ""}</span>
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="secondary" onClick={() => setEdits({})}>Discard</Button>
              {message && <span className="text-sm text-muted-foreground">{message}</span>}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="p-3 text-left w-16">#</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Typing</th>
                <th className="p-3 text-center w-28">Points</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => {
                const types = pokemonTypesFor(p);
                const currentValue = edits[p.id] ?? p.pointValue;
                const isDirty = edits[p.id] !== undefined && edits[p.id] !== p.pointValue;
                return (
                  <tr key={p.id} className={`border-t transition-colors ${isDirty ? "bg-primary/5" : idx % 2 === 0 ? "" : "bg-muted/30"}`}>
                    <td className="p-3 font-mono text-muted-foreground text-xs">
                      {String(p.dexNumber).padStart(4, "0")}
                    </td>
                    <td className="p-3 font-semibold">{p.name}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {types.map((t) => <TypeBadge key={t} type={t} />)}
                      </div>
                    </td>
                    <td className="p-3">
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={currentValue}
                        onChange={(e) => handleEdit(p.id, parseInt(e.target.value) || 1)}
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

// ─── Server wrapper ───────────────────────────────────────────────────────────

import { getPokemon } from "@/lib/data";

export default async function PointRestructureServerPage() {
  const pokemon = await getPokemon();
  return <PointRestructurePage pokemon={pokemon} />;
}
