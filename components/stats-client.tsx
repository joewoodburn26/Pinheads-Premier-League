"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Pencil, Save, X, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updatePokemonStats, resetAllStats } from "@/lib/replay-stats-actions";
import type { PokemonStats } from "@/lib/types";

interface StatsRow extends PokemonStats {
  teamName: string;
}

function EditableStatRow({ row }: { row: StatsRow }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [games,  setGames]  = useState(String(row.gamesPlayed));
  const [kos,    setKos]    = useState(String(row.kos));
  const [deaths, setDeaths] = useState(String(row.deaths));
  const [saved,  setSaved]  = useState(false);

  const isPlaceholder = row.id.startsWith("placeholder-");

  function handleSave() {
    startTransition(async () => {
      await updatePokemonStats(
        row.id,
        parseInt(games) || 0,
        parseInt(kos) || 0,
        parseInt(deaths) || 0,
        isPlaceholder ? { seasonId: row.seasonId, teamId: row.teamId ?? "", pokemonId: row.pokemonId } : undefined,
      );
      setSaved(true);
      setTimeout(() => { setSaved(false); setEditing(false); }, 1000);
    });
  }

  const mon = row.pokemon;
  if (!mon) return null;

  const kdRatio = row.deaths > 0 ? (row.kos / row.deaths).toFixed(2) : row.kos > 0 ? "∞" : "0.00";

  return (
    <tr className={`border-t transition-colors ${editing ? "bg-primary/5" : "hover:bg-muted/20"}`}>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <Image src={mon.spriteUrl} alt={mon.name} width={32} height={32} className="size-7 object-contain" />
          <span className="font-semibold text-sm">{mon.name}</span>
        </div>
      </td>
      <td className="p-3 text-sm text-muted-foreground">{row.teamName}</td>
      <td className="p-3 text-center">
        {editing
          ? <Input type="number" value={games} onChange={e => setGames(e.target.value)} className="w-16 h-7 text-center text-xs" />
          : <span className="font-semibold">{row.gamesPlayed}</span>
        }
      </td>
      <td className="p-3 text-center">
        {editing
          ? <Input type="number" value={kos} onChange={e => setKos(e.target.value)} className="w-16 h-7 text-center text-xs text-green-400" />
          : <span className="font-bold text-green-400">{row.kos}</span>
        }
      </td>
      <td className="p-3 text-center">
        {editing
          ? <Input type="number" value={deaths} onChange={e => setDeaths(e.target.value)} className="w-16 h-7 text-center text-xs text-red-400" />
          : <span className="font-bold text-red-400">{row.deaths}</span>
        }
      </td>
      <td className="p-3 text-center text-sm font-mono">{kdRatio}</td>
      <td className="p-3 text-center">
        {editing ? (
          <div className="flex items-center justify-center gap-1">
            <button onClick={handleSave} disabled={isPending}
              className="rounded-md p-1 text-green-400 hover:bg-green-500/10 transition-colors">
              <Save size={14} />
            </button>
            <button onClick={() => setEditing(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors">
              <X size={14} />
            </button>
            {saved && <span className="text-xs text-green-400">✓</span>}
          </div>
        ) : (
          <button onClick={() => setEditing(true)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Pencil size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

function ResetAllButton({ seasonId }: { seasonId: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function handleReset() {
    startTransition(async () => {
      await resetAllStats(seasonId);
      setConfirm(false);
    });
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2">
        <AlertTriangle size={16} className="text-red-400 shrink-0" />
        <p className="text-sm text-red-400 font-semibold">This will delete ALL stats and replay records for this season!</p>
        <Button onClick={handleReset} disabled={isPending}
          className="ml-auto bg-destructive text-destructive-foreground hover:bg-destructive/90 shrink-0">
          {isPending ? "Resetting…" : "Confirm Reset All"}
        </Button>
        <button onClick={() => setConfirm(false)} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirm(true)}
      className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors">
      <Trash2 size={14} /> Reset All Stats
    </button>
  );
}

export function StatsClient({ stats, seasonId }: { stats: StatsRow[]; seasonId: string }) {
  const [sortKey, setSortKey] = useState<"kos" | "deaths" | "gamesPlayed" | "kd">("kos");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sorted = [...stats].sort((a, b) => {
    let va = 0, vb = 0;
    if (sortKey === "kos")        { va = a.kos;         vb = b.kos; }
    if (sortKey === "deaths")     { va = a.deaths;       vb = b.deaths; }
    if (sortKey === "gamesPlayed"){ va = a.gamesPlayed;  vb = b.gamesPlayed; }
    if (sortKey === "kd") {
      va = a.deaths > 0 ? a.kos / a.deaths : a.kos;
      vb = b.deaths > 0 ? b.kos / b.deaths : b.kos;
    }
    return sortDir === "desc" ? vb - va : va - vb;
  });

  function SortBtn({ label, k }: { label: string; k: typeof sortKey }) {
    const active = sortKey === k;
    return (
      <button onClick={() => handleSort(k)}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
        {label} {active ? (sortDir === "desc" ? "↓" : "↑") : ""}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Stats</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Click <Pencil size={12} className="inline" /> to edit any row · Use ⚡ buttons on Schedule to auto-parse replays
          </p>
        </div>
        <ResetAllButton seasonId={seasonId} />
      </div>

      {stats.length === 0 ? (
        <Card className="p-8 text-center space-y-2">
          <p className="text-muted-foreground">No stats yet.</p>
          <p className="text-sm text-muted-foreground">Go to Schedule and click the ⚡ buttons next to replay links to auto-parse stats.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center">Sort by:</span>
            <SortBtn label="KOs" k="kos" />
            <SortBtn label="Deaths" k="deaths" />
            <SortBtn label="Games" k="gamesPlayed" />
            <SortBtn label="K/D" k="kd" />
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Pokémon</th>
                  <th className="p-3 text-left">Team</th>
                  <th className="p-3 text-center">Games</th>
                  <th className="p-3 text-center">KOs</th>
                  <th className="p-3 text-center">Deaths</th>
                  <th className="p-3 text-center">K/D</th>
                  <th className="p-3 text-center">Edit</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(row => <EditableStatRow key={row.id} row={row} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
