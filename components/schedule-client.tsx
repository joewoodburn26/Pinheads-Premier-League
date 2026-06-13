"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Save, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateMatch } from "@/lib/actions";
import type { ScheduleMatch, Team } from "@/lib/types";
import { winPct } from "@/lib/utils";

// ─── Standing row type ────────────────────────────────────────────────────────

interface StandingRow {
  teamId: string;
  teamName: string;
  coachName: string;
  wins: number;
  losses: number;
  battleDiff: number;
}

// ─── Standings table ──────────────────────────────────────────────────────────

function StandingsTable({ standings }: { standings: StandingRow[] }) {
  const sorted = [...standings].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.battleDiff !== a.battleDiff) return b.battleDiff - a.battleDiff;
    return parseFloat(winPct(b.wins, b.losses)) - parseFloat(winPct(a.wins, a.losses));
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black">Standings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sorted by: Match Record → Battle Differential → Win %
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Team</th>
              <th className="p-3">Coach</th>
              <th className="p-3 text-center">W</th>
              <th className="p-3 text-center">L</th>
              <th className="p-3 text-center">Win %</th>
              <th className="p-3 text-center">Battle Diff</th>
              <th className="p-3 text-center">Playoff Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const inPlayoffs = idx < 4;
              const diffColor  = row.battleDiff > 0 ? "text-green-400" : row.battleDiff < 0 ? "text-red-400" : "text-muted-foreground";
              return (
                <tr key={row.teamId} className={`border-t transition-colors ${inPlayoffs ? "bg-primary/5" : ""}`}>
                  <td className="p-3 font-black text-muted-foreground">{idx + 1}</td>
                  <td className="p-3 font-bold">{row.teamName}</td>
                  <td className="p-3 text-muted-foreground">{row.coachName}</td>
                  <td className="p-3 text-center font-bold">{row.wins}</td>
                  <td className="p-3 text-center text-muted-foreground">{row.losses}</td>
                  <td className="p-3 text-center">{winPct(row.wins, row.losses)}</td>
                  <td className={`p-3 text-center font-bold ${diffColor}`}>
                    {row.battleDiff > 0 ? `+${row.battleDiff}` : row.battleDiff}
                  </td>
                  <td className="p-3 text-center">
                    {inPlayoffs
                      ? <span className="rounded-full bg-primary/20 border border-primary/40 px-2 py-0.5 text-xs font-bold text-primary">Playoff</span>
                      : <span className="text-xs text-muted-foreground">—</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tie-breaker legend */}
      <Card className="p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground text-sm">Tie-Breaker Order</p>
        <p><span className="font-semibold text-foreground">1st:</span> Match Win/Loss Record</p>
        <p><span className="font-semibold text-foreground">2nd:</span> Cumulative Battle Differential (Pokémon alive delta per game, summed across all series)</p>
        <p><span className="font-semibold text-foreground">3rd:</span> Head-to-Head Record between tied players</p>
        <p><span className="font-semibold text-foreground">4th:</span> Cumulative Game Win % across all individual games</p>
      </Card>
    </div>
  );
}

// ─── Match card (editable) ────────────────────────────────────────────────────

function MatchCard({
  match,
  teamName,
}: {
  match: ScheduleMatch;
  teamName: (id: string | null) => string;
}) {
  const [isPending, startTransition] = useTransition();
  const [winner,   setWinner]   = useState(match.winner ?? "");
  const [bo3Score, setBo3Score] = useState(match.bo3Score ?? "");
  const [homeDiff, setHomeDiff] = useState(String(match.homeDiff ?? 0));
  const [awayDiff, setAwayDiff] = useState(String(match.awayDiff ?? 0));
  const [replay1,  setReplay1]  = useState(match.replay1 ?? "");
  const [replay2,  setReplay2]  = useState(match.replay2 ?? "");
  const [replay3,  setReplay3]  = useState(match.replay3 ?? "");
  const [saved,    setSaved]    = useState(false);

  const homeName = teamName(match.homeTeam);
  const awayName = teamName(match.awayTeam);
  const isComplete = !!match.winner;

  function handleSave() {
    const fd = new FormData();
    fd.set("id",       match.id);
    fd.set("winner",   winner);
    fd.set("bo3Score", bo3Score);
    fd.set("homeDiff", homeDiff);
    fd.set("awayDiff", awayDiff);
    fd.set("replay1",  replay1);
    fd.set("replay2",  replay2);
    fd.set("replay3",  replay3);
    startTransition(async () => {
      await updateMatch(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  // Auto-mirror battle diff (winner positive, loser negative)
  function handleHomeDiffChange(val: string) {
    setHomeDiff(val);
    const num = parseInt(val);
    if (!isNaN(num)) setAwayDiff(String(-num));
  }

  return (
    <Card className={`p-4 space-y-4 ${isComplete ? "border-primary/20" : ""}`}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {isComplete && <Trophy size={16} className="text-yellow-400 shrink-0" />}
          <span className="font-bold text-base truncate">
            {homeName}
            <span className="text-muted-foreground font-normal mx-2">vs</span>
            {awayName}
          </span>
        </div>
        {isComplete && (
          <span className="text-xs font-bold rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 shrink-0 text-primary">
            {winner === match.homeTeam ? homeName : awayName} won {bo3Score}
          </span>
        )}
      </div>

      {/* Result inputs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Series winner */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Series Winner</label>
          <select value={winner} onChange={e => setWinner(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">— No result —</option>
            <option value={match.homeTeam}>{homeName}</option>
            <option value={match.awayTeam}>{awayName}</option>
          </select>
        </div>

        {/* Bo3 score */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bo3 Score</label>
          <select value={bo3Score} onChange={e => setBo3Score(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">— Select —</option>
            <option value="2-0">2-0 (clean sweep)</option>
            <option value="2-1">2-1 (went to game 3)</option>
          </select>
        </div>

        {/* Home battle diff */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {homeName} Battle Diff
          </label>
          <Input
            type="number"
            value={homeDiff}
            onChange={e => handleHomeDiffChange(e.target.value)}
            placeholder="e.g. +5"
            className={parseInt(homeDiff) > 0 ? "text-green-400 font-bold" : parseInt(homeDiff) < 0 ? "text-red-400 font-bold" : ""}
          />
        </div>

        {/* Away battle diff (auto-mirrored) */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {awayName} Battle Diff
          </label>
          <Input
            type="number"
            value={awayDiff}
            onChange={e => { setAwayDiff(e.target.value); const num = parseInt(e.target.value); if (!isNaN(num)) setHomeDiff(String(-num)); }}
            placeholder="e.g. -5"
            className={parseInt(awayDiff) > 0 ? "text-green-400 font-bold" : parseInt(awayDiff) < 0 ? "text-red-400 font-bold" : ""}
          />
        </div>
      </div>

      {/* Diff helper */}
      <p className="text-xs text-muted-foreground">
        💡 Battle Diff = Pokémon alive delta per game, summed across the series. Auto-mirrors (e.g. +5 / -5). Winner should be positive.
      </p>

      {/* Replay links */}
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { label: "Game 1 Replay", value: replay1, set: setReplay1 },
          { label: "Game 2 Replay", value: replay2, set: setReplay2 },
          { label: "Game 3 Replay", value: replay3, set: setReplay3, optional: bo3Score !== "2-1" },
        ].map(({ label, value, set, optional }) => (
          <div key={label} className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {label} {optional && <span className="text-muted-foreground/50">(if played)</span>}
            </label>
            <div className="flex gap-1">
              <Input
                value={value}
                onChange={e => set(e.target.value)}
                placeholder="replay.pokemonshowdown.com/…"
                className="text-xs"
              />
              {value && (
                <a href={value} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 rounded-md border bg-muted px-2 flex items-center hover:bg-muted/80 transition-colors">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending}>
          <Save size={14} className="mr-2" />
          {isPending ? "Saving…" : "Save Result"}
        </Button>
        {saved && <span className="text-xs text-green-400 font-semibold">✓ Saved</span>}
      </div>
    </Card>
  );
}

// ─── Weekly tab content ───────────────────────────────────────────────────────

function WeekTab({
  week, matches, teamName, standings,
}: {
  week: number;
  matches: ScheduleMatch[];
  teamName: (id: string | null) => string;
  standings: StandingRow[];
}) {
  const weekMatches = matches.filter(m => m.week === week);
  const completed   = weekMatches.filter(m => m.winner).length;
  const total       = weekMatches.length;

  return (
    <div className="space-y-8">
      {/* Week summary */}
      <div className="flex items-center gap-4">
        <div className="rounded-lg border bg-muted/40 px-4 py-2 text-sm">
          <span className="text-muted-foreground">Completed: </span>
          <span className="font-bold">{completed}/{total}</span>
        </div>
        {completed === total && total > 0 && (
          <span className="text-xs font-bold text-green-400 rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1">
            ✓ Week Complete
          </span>
        )}
      </div>

      {/* Match cards */}
      <div className="space-y-4">
        <h2 className="text-xl font-black">Week {week} Matches</h2>
        {weekMatches.map(match => (
          <MatchCard key={match.id} match={match} teamName={teamName} />
        ))}
      </div>

      {/* Standings snapshot for this week */}
      <StandingsTable standings={standings} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ScheduleClient({
  matches,
  teams,
  initialWeek,
}: {
  matches: ScheduleMatch[];
  teams: Team[];
  initialWeek: number;
}) {
  const weeks = [...new Set(matches.map(m => m.week))].sort((a, b) => a - b);
  const [activeWeek, setActiveWeek] = useState(initialWeek);

  const teamName = (id: string | null) =>
    teams.find(t => t.id === id)?.teamName ?? "TBD";

  // Calculate standings from match data
  const standings: StandingRow[] = teams.map(team => {
    const teamMatches = matches.filter(m =>
      m.homeTeam === team.id || m.awayTeam === team.id
    );
    const wins   = teamMatches.filter(m => m.winner === team.id).length;
    const losses = teamMatches.filter(m => m.winner && m.winner !== team.id).length;
    const diff   = teamMatches.reduce((sum, m) => {
      if (m.homeTeam === team.id) return sum + (m.homeDiff ?? 0);
      if (m.awayTeam === team.id) return sum + (m.awayDiff ?? 0);
      return sum;
    }, 0);
    return {
      teamId:     team.id,
      teamName:   team.teamName,
      coachName:  team.coach?.name ?? "—",
      wins, losses,
      battleDiff: diff,
    };
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-black">Schedule & Standings</h1>
        <p className="text-muted-foreground mt-1">
          National Dex Bo3 · Battle Differential tie-breaker · Top 4 advance to playoffs
        </p>
      </div>

      {/* Week tabs + Standings tab */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {/* Standings tab */}
        <button
          onClick={() => setActiveWeek(0)}
          className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            activeWeek === 0 ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
          }`}
        >
          <Trophy size={14} /> Standings
        </button>

        {/* Week tabs */}
        {weeks.map(week => {
          const weekMatches = matches.filter(m => m.week === week);
          const allDone = weekMatches.length > 0 && weekMatches.every(m => m.winner);
          return (
            <button
              key={week}
              onClick={() => setActiveWeek(week)}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                activeWeek === week ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              }`}
            >
              Week {week}
              {allDone && <span className="ml-1.5 text-green-400">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeWeek === 0 ? (
        <StandingsTable standings={standings} />
      ) : (
        <WeekTab
          week={activeWeek}
          matches={matches}
          teamName={teamName}
          standings={standings}
        />
      )}
    </div>
  );
}
