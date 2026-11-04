"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronsUpDown, Pencil, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updatePokemonStats, resetAllStats } from "@/lib/replay-stats-actions";
import type { PokemonStats } from "@/lib/types";

interface StatsRow extends PokemonStats {
  teamName: string;
  /** Used by this team earlier in the season but no longer on its roster */
  former?: boolean;
}

type TeamOption = { id: string; name: string; color: string };
type SortKey = "name" | "team" | "gamesPlayed" | "kos" | "deaths" | "plusMinus" | "kd" | "kpg";

const kd = (r: StatsRow) => (r.deaths > 0 ? r.kos / r.deaths : r.kos);
const kpg = (r: StatsRow) => (r.gamesPlayed > 0 ? r.kos / r.gamesPlayed : 0);
const plusMinus = (r: StatsRow) => r.kos - r.deaths;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

const METRIC: Record<SortKey, { label: string; value: (r: StatsRow) => number | string; show: (r: StatsRow) => string }> = {
  name:        { label: "Pokémon", value: (r) => r.pokemon?.name ?? "", show: () => "" },
  team:        { label: "Team",    value: (r) => r.teamName, show: () => "" },
  gamesPlayed: { label: "Games",   value: (r) => r.gamesPlayed, show: (r) => String(r.gamesPlayed) },
  kos:         { label: "KOs",     value: (r) => r.kos, show: (r) => String(r.kos) },
  deaths:      { label: "Deaths",  value: (r) => r.deaths, show: (r) => String(r.deaths) },
  plusMinus:   { label: "+/-",     value: plusMinus, show: (r) => signed(plusMinus(r)) },
  kd:          { label: "K/D",     value: kd, show: (r) => (r.deaths === 0 && r.kos > 0 ? "∞" : fmt(kd(r))) },
  kpg:         { label: "KOs/game", value: kpg, show: (r) => fmt(kpg(r)) },
};

const MEDALS = ["#f5c542", "#c0c7d2", "#d08b4c"];

// ─── Editable row ──────────────────────────────────────────────────────────────

function StatRow({
  row, rank, team, canEdit,
}: { row: StatsRow; rank: number; team?: TeamOption; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [games, setGames] = useState(String(row.gamesPlayed));
  const [kos, setKos] = useState(String(row.kos));
  const [deaths, setDeaths] = useState(String(row.deaths));
  const [failed, setFailed] = useState(false);
  const isPlaceholder = row.id.startsWith("placeholder-");
  const mon = row.pokemon;
  if (!mon) return null;

  function handleSave() {
    setFailed(false);
    startTransition(async () => {
      try {
        const result = await updatePokemonStats(
          row.id, parseInt(games) || 0, parseInt(kos) || 0, parseInt(deaths) || 0,
          isPlaceholder ? { seasonId: row.seasonId, teamId: row.teamId ?? "", pokemonId: row.pokemonId } : undefined,
        );
        if (!result.ok) return setFailed(true);
        setEditing(false);
      } catch {
        setFailed(true);
      }
    });
  }

  const pm = plusMinus(row);
  const num = "w-16 h-8 text-center text-xs";

  return (
    <tr className={`border-t border-white/5 transition-colors ${editing ? "bg-primary/5" : "hover:bg-white/[0.02]"}`}>
      <td className="py-2 pl-4 pr-2 text-center text-xs font-black tabular-nums text-muted-foreground">
        {rank <= 3 && row.gamesPlayed > 0 ? <span style={{ color: MEDALS[rank - 1] }}>{rank}</span> : rank}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2.5">
          <Image src={mon.spriteUrl} alt="" width={40} height={40} className="size-9 shrink-0 object-contain" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-semibold">
              {mon.name}
              {row.former && (
                <span className="rounded border border-sky-500/40 px-1 text-[10px] font-normal text-sky-300" title="Was on this team earlier in the season">
                  swapped out
                </span>
              )}
            </p>
            {/* Team under the name on phones */}
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground md:hidden">
              <span className="size-2 shrink-0 rounded-full" style={{ background: team?.color }} />
              {row.teamName}
            </p>
          </div>
        </div>
      </td>
      <td className="px-2 py-2 max-md:hidden">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: team?.color }} />
          <span className="truncate">{row.teamName}</span>
        </span>
      </td>
      {editing ? (
        <>
          <td className="px-2 py-2 text-center"><Input type="number" value={games} onChange={(e) => setGames(e.target.value)} className={num} /></td>
          <td className="px-2 py-2 text-center"><Input type="number" value={kos} onChange={(e) => setKos(e.target.value)} className={`${num} text-green-400`} /></td>
          <td className="px-2 py-2 text-center"><Input type="number" value={deaths} onChange={(e) => setDeaths(e.target.value)} className={`${num} text-red-400`} /></td>
          <td colSpan={3} />
        </>
      ) : (
        <>
          <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">{row.gamesPlayed}</td>
          <td className="px-2 py-2 text-center text-base font-black tabular-nums text-green-400">{row.kos}</td>
          <td className="px-2 py-2 text-center font-bold tabular-nums text-red-400">{row.deaths}</td>
          <td className={`px-2 py-2 text-center font-bold tabular-nums ${pm > 0 ? "text-green-400" : pm < 0 ? "text-red-400" : "text-muted-foreground"}`}>{signed(pm)}</td>
          <td className="px-2 py-2 text-center font-mono text-sm tabular-nums">{METRIC.kd.show(row)}</td>
          <td className="px-2 py-2 text-center font-mono text-sm tabular-nums text-muted-foreground">{METRIC.kpg.show(row)}</td>
        </>
      )}
      <td className="py-2 pl-2 pr-4 text-center">
        {editing ? (
          <div className="flex items-center justify-center gap-1">
            <button onClick={handleSave} disabled={isPending} title="Save" className="rounded-md p-1 text-green-400 hover:bg-green-500/10"><Check size={15} /></button>
            <button onClick={() => setEditing(false)} title="Cancel" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X size={15} /></button>
            {failed && <span className="text-xs text-red-400" title="Couldn't save. Make sure you're signed in.">✗</span>}
          </div>
        ) : canEdit ? (
          <button onClick={() => setEditing(true)} title="Fix this row" className="rounded-md p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground">
            <Pencil size={13} />
          </button>
        ) : null}
      </td>
    </tr>
  );
}

// ─── Reset all (owner) ─────────────────────────────────────────────────────────

function ResetAllButton({ seasonId }: { seasonId: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");

  function handleReset() {
    setError("");
    startTransition(async () => {
      try {
        const result = await resetAllStats(seasonId);
        if (!result.ok) return setError(result.error ?? "Couldn't reset stats.");
        setConfirm(false);
      } catch {
        setError("Couldn't reset stats. Try again.");
      }
    });
  }

  if (confirm) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2">
        <AlertTriangle size={16} className="shrink-0 text-red-400" />
        <p className="text-sm font-semibold text-red-400">This deletes ALL stats and replay records for this season.</p>
        <Button onClick={handleReset} disabled={isPending} className="ml-auto shrink-0 bg-destructive text-destructive-foreground hover:bg-destructive/90">
          {isPending ? "Resetting…" : "Reset everything"}
        </Button>
        <button onClick={() => setConfirm(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }
  return (
    <button onClick={() => setConfirm(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400">
      <Trash2 size={13} /> Reset all stats
    </button>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export function StatsClient({
  stats,
  teams,
  seasonId,
  canEdit = false,
  canResetAll = false,
  stage = "all",
}: {
  stats: StatsRow[];
  teams: TeamOption[];
  seasonId: string;
  /** Signed-in members can fix individual numbers (All view only) */
  canEdit?: boolean;
  /** Owner only */
  canResetAll?: boolean;
  /** Which games the numbers cover */
  stage?: "all" | "regular" | "playoffs";
}) {
  const [sortKey, setSortKey] = useState<SortKey>("kos");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [teamFilter, setTeamFilter] = useState("");
  const [query, setQuery] = useState("");
  const [showUnused, setShowUnused] = useState(false);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  function sortBy(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" || key === "team" || key === "deaths" ? "asc" : "desc");
    }
  }

  const unusedCount = stats.filter((r) => r.gamesPlayed === 0 && r.kos === 0 && r.deaths === 0).length;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = stats.filter(
      (r) =>
        (showUnused || r.gamesPlayed > 0 || r.kos > 0 || r.deaths > 0) &&
        (!teamFilter || r.teamId === teamFilter) &&
        (!q || (r.pokemon?.name ?? "").toLowerCase().includes(q)),
    );
    const m = METRIC[sortKey];
    return list.sort((a, b) => {
      const va = m.value(a);
      const vb = m.value(b);
      const c = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      const dir = sortDir === "asc" ? c : -c;
      return dir || plusMinus(b) - plusMinus(a) || (a.pokemon?.name ?? "").localeCompare(b.pokemon?.name ?? "");
    });
  }, [stats, showUnused, teamFilter, query, sortKey, sortDir]);

  const numericSort = sortKey !== "name" && sortKey !== "team";
  const podium = numericSort && sortDir === "desc" ? rows.filter((r) => r.gamesPlayed > 0).slice(0, 3) : [];

  const Th = ({ k, className = "" }: { k: SortKey; className?: string }) => {
    const on = sortKey === k;
    return (
      <th className={`px-2 py-2.5 ${className}`}>
        <button
          onClick={() => sortBy(k)}
          className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${on ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {METRIC[k].label}
          {on ? (sortDir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ChevronsUpDown size={11} className="opacity-40" />}
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black sm:text-4xl">Stats</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            From results reported on the Schedule page. Click a column to sort.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border p-1">
          {([["all", "All"], ["regular", "Regular season"], ["playoffs", "Playoffs"]] as const).map(([v, l]) => (
            <Link
              key={v}
              href={v === "all" ? "/stats" : `/stats?stage=${v}`}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${stage === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {l}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Podium: top 3 for the current sort ──────────────────────── */}
      {podium.length > 0 && (
        <div className="grid grid-cols-3 gap-3 max-md:gap-2">
          {podium.map((r, i) => {
            const team = r.teamId ? teamById.get(r.teamId) : undefined;
            return (
              <Card
                key={r.id}
                className="relative flex items-center gap-3 overflow-hidden p-4 max-md:flex-col max-md:gap-1 max-md:p-2.5 max-md:pt-3 max-md:text-center"
                style={{ borderColor: `${MEDALS[i]}66`, background: `linear-gradient(135deg, ${team?.color ?? "#64748b"}22, transparent 60%)` }}
              >
                <span
                  className="absolute left-3 top-3 grid size-6 place-items-center rounded-full text-xs font-black text-black max-md:left-2 max-md:top-2 max-md:size-5 max-md:text-[10px]"
                  style={{ background: MEDALS[i] }}
                >
                  {i + 1}
                </span>
                {r.pokemon && (
                  <Image src={r.pokemon.spriteUrl} alt="" width={88} height={88} className="size-20 shrink-0 object-contain drop-shadow-lg max-md:size-14" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-black leading-tight max-md:text-sm">{r.pokemon?.name}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground max-md:justify-center max-md:text-[10px]">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: team?.color }} />
                    <span className="truncate">{r.teamName}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right max-md:text-center">
                  <p className="text-3xl font-black tabular-nums leading-none max-md:text-xl">{METRIC[sortKey].show(r)}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{METRIC[sortKey].label}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────── */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-3">
          <label className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-2.5 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Pokémon" className="h-9 pl-9" />
          </label>
          {/* Team filter on phones (on bigger screens it's in the Team column header) */}
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm md:hidden"
          >
            <option value="">All teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showUnused} onChange={(e) => setShowUnused(e.target.checked)} className="accent-primary" />
            Show unused Pokémon{unusedCount ? ` (${unusedCount})` : ""}
          </label>
          <span className="ml-auto text-xs text-muted-foreground">{rows.length} Pokémon</span>
        </div>

        {rows.length === 0 ? (
          <div className="space-y-1 p-10 text-center">
            <p className="font-semibold">No stats to show.</p>
            <p className="text-sm text-muted-foreground">
              {stats.length && !showUnused ? "Nobody has played yet. Tick “Show unused Pokémon” to see every roster." : "Report a result from its replays on the Schedule page to fill these in."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm max-md:min-w-[600px]">
              <thead className="bg-white/[0.02] text-left">
                <tr>
                  <th className="py-2.5 pl-4 pr-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">#</th>
                  <Th k="name" />
                  <th className="px-2 py-2.5 max-md:hidden">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => sortBy("team")}
                        className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${sortKey === "team" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Team
                        {sortKey === "team" ? (sortDir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ChevronsUpDown size={11} className="opacity-40" />}
                      </button>
                      <select
                        value={teamFilter}
                        onChange={(e) => setTeamFilter(e.target.value)}
                        className={`ml-1 max-w-[150px] rounded border bg-background px-1 py-0.5 text-xs font-normal normal-case ${teamFilter ? "border-primary text-primary" : "text-muted-foreground"}`}
                        title="Show one team"
                      >
                        <option value="">All teams</option>
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </th>
                  <Th k="gamesPlayed" className="text-center" />
                  <Th k="kos" className="text-center" />
                  <Th k="deaths" className="text-center" />
                  <Th k="plusMinus" className="text-center" />
                  <Th k="kd" className="text-center" />
                  <Th k="kpg" className="text-center" />
                  <th className="pr-4" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <StatRow
                    key={row.id}
                    row={row}
                    rank={i + 1}
                    team={row.teamId ? teamById.get(row.teamId) : undefined}
                    canEdit={canEdit}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>
          +/- = KOs minus deaths · K/D = KOs per death · {canEdit ? "the pencil fixes a row" : stage !== "all" ? "switch to All to edit numbers" : ""}
        </p>
        {canResetAll && <ResetAllButton seasonId={seasonId} />}
      </div>
    </div>
  );
}
