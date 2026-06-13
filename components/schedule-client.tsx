"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Save, Trophy, Shield, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateMatch } from "@/lib/actions";
import { generatePlayoffBracket } from "@/lib/schedule-utils";
import type { ScheduleMatch, Team } from "@/lib/types";
import { winPct } from "@/lib/utils";

const BYE_ID = "BYE";

// ─── Standing row ─────────────────────────────────────────────────────────────

interface StandingRow {
  teamId: string;
  teamName: string;
  coachName: string;
  wins: number;
  losses: number;
  battleDiff: number;
  seed: number;
}

// ─── Standings table ──────────────────────────────────────────────────────────

function StandingsTable({ standings }: { standings: StandingRow[] }) {
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
              <th className="p-3 text-center">Playoffs</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => {
              const diffColor = row.battleDiff > 0 ? "text-green-400" : row.battleDiff < 0 ? "text-red-400" : "text-muted-foreground";
              return (
                <tr key={row.teamId} className="border-t">
                  <td className="p-3 font-black text-muted-foreground">{row.seed}</td>
                  <td className="p-3 font-bold">{row.teamName}</td>
                  <td className="p-3 text-muted-foreground">{row.coachName}</td>
                  <td className="p-3 text-center font-bold">{row.wins}</td>
                  <td className="p-3 text-center text-muted-foreground">{row.losses}</td>
                  <td className="p-3 text-center">{winPct(row.wins, row.losses)}</td>
                  <td className={`p-3 text-center font-bold ${diffColor}`}>
                    {row.battleDiff > 0 ? `+${row.battleDiff}` : row.battleDiff}
                  </td>
                  <td className="p-3 text-center">
                    <span className="rounded-full bg-primary/20 border border-primary/40 px-2 py-0.5 text-xs font-bold text-primary">
                      Seed #{row.seed}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Card className="p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground text-sm">Tie-Breaker Order</p>
        <p><span className="font-semibold text-foreground">1st:</span> Match Win/Loss Record</p>
        <p><span className="font-semibold text-foreground">2nd:</span> Cumulative Battle Differential</p>
        <p><span className="font-semibold text-foreground">3rd:</span> Head-to-Head Record</p>
        <p><span className="font-semibold text-foreground">4th:</span> Cumulative Game Win %</p>
      </Card>
    </div>
  );
}

// ─── Playoff bracket ──────────────────────────────────────────────────────────

function PlayoffBracket({
  standings, matches, teamName,
}: {
  standings: StandingRow[];
  matches: ScheduleMatch[];
  teamName: (id: string) => string;
}) {
  const allWeeksComplete = standings.length > 0 &&
    matches.filter(m => !m.isBye).every(m => m.winner);

  const bracket = generatePlayoffBracket(
    standings.map(s => ({ teamId: s.teamId, teamName: s.teamName, seed: s.seed }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black">Playoffs</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Single elimination · Best vs worst seeding · Bo3 all rounds
        </p>
        {!allWeeksComplete && (
          <div className="mt-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-400">
            ⚠️ Bracket auto-populates once all regular season weeks are complete. You can set results manually now.
          </div>
        )}
      </div>

      {bracket.map((round) => (
        <div key={round.round} className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            {round.round === 0
              ? <><Shield size={18} className="text-orange-400" /> Play-In Round</>
              : <><Trophy size={18} className="text-yellow-400" /> {round.roundName}</>
            }
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {round.matchups.map((m, idx) => (
              <Card key={idx} className={`p-4 ${round.round === 0 ? "border-orange-500/30" : "border-yellow-500/20"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${round.round === 0 ? "bg-orange-500/20 text-orange-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                        #{m.seed1}
                      </span>
                      <span className="font-bold">{m.homeTeam === "TBD" ? "TBD" : teamName(m.homeTeam)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-8">vs</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${round.round === 0 ? "bg-orange-500/20 text-orange-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                        #{m.seed2}
                      </span>
                      <span className="font-bold">{m.awayTeam === "TBD" ? "TBD" : teamName(m.awayTeam)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <p>Bo3</p>
                    <p className="text-muted-foreground/50">Result TBD</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── BYE week display ─────────────────────────────────────────────────────────

function ByeWeekBanner({ byeTeamName }: { byeTeamName: string }) {
  return (
    <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-3 flex items-center gap-3">
      <span className="text-2xl">😴</span>
      <div>
        <p className="text-sm font-bold">{byeTeamName} — BYE Week</p>
        <p className="text-xs text-muted-foreground">No match this week</p>
      </div>
    </div>
  );
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ match, teamName }: { match: ScheduleMatch; teamName: (id: string) => string }) {
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
  const awayName = match.awayTeam === BYE_ID ? "BYE" : teamName(match.awayTeam);

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

  function handleHomeDiffChange(val: string) {
    setHomeDiff(val);
    const num = parseInt(val);
    if (!isNaN(num)) setAwayDiff(String(-num));
  }

  return (
    <Card className={`p-4 space-y-4 ${match.winner ? "border-primary/20" : ""}`}>
      <div className="flex items-center justify-between gap-4">
        <span className="font-bold text-base">
          {homeName}
          <span className="text-muted-foreground font-normal mx-2">vs</span>
          {awayName}
        </span>
        {match.winner && (
          <span className="text-xs font-bold rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-primary shrink-0">
            {match.winner === match.homeTeam ? homeName : awayName} won {bo3Score}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Series Winner</label>
          <select value={winner} onChange={e => setWinner(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">— No result —</option>
            <option value={match.homeTeam}>{homeName}</option>
            {match.awayTeam !== BYE_ID && <option value={match.awayTeam}>{awayName}</option>}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bo3 Score</label>
          <select value={bo3Score} onChange={e => setBo3Score(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">— Select —</option>
            <option value="2-0">2-0</option>
            <option value="2-1">2-1</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{homeName} Diff</label>
          <Input type="number" value={homeDiff} onChange={e => handleHomeDiffChange(e.target.value)}
            className={parseInt(homeDiff) > 0 ? "text-green-400 font-bold" : parseInt(homeDiff) < 0 ? "text-red-400 font-bold" : ""} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{awayName} Diff</label>
          <Input type="number" value={awayDiff}
            onChange={e => { setAwayDiff(e.target.value); const n = parseInt(e.target.value); if (!isNaN(n)) setHomeDiff(String(-n)); }}
            className={parseInt(awayDiff) > 0 ? "text-green-400 font-bold" : parseInt(awayDiff) < 0 ? "text-red-400 font-bold" : ""} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        💡 Battle Diff = Pokémon alive delta per game, summed across the series. Auto-mirrors.
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { label: "Game 1 Replay", value: replay1, set: setReplay1 },
          { label: "Game 2 Replay", value: replay2, set: setReplay2 },
          { label: `Game 3 Replay`, value: replay3, set: setReplay3, optional: bo3Score !== "2-1" },
        ].map(({ label, value, set, optional }) => (
          <div key={label} className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {label} {optional && <span className="opacity-50">(if played)</span>}
            </label>
            <div className="flex gap-1">
              <Input value={value} onChange={e => set(e.target.value)}
                placeholder="replay.pokemonshowdown.com/…" className="text-xs" />
              {value && (
                <a href={value} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 rounded-md border bg-muted px-2 flex items-center hover:bg-muted/80">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

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

// ─── Week tab ─────────────────────────────────────────────────────────────────

function WeekTab({ week, matches, teamName, standings }: {
  week: number;
  matches: ScheduleMatch[];
  teamName: (id: string) => string;
  standings: StandingRow[];
}) {
  const weekMatches  = matches.filter(m => m.week === week);
  const realMatches  = weekMatches.filter(m => !m.isBye);
  const byeMatches   = weekMatches.filter(m => m.isBye);
  const completed    = realMatches.filter(m => m.winner).length;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="rounded-lg border bg-muted/40 px-4 py-2 text-sm">
          <span className="text-muted-foreground">Completed: </span>
          <span className="font-bold">{completed}/{realMatches.length}</span>
        </div>
        {completed === realMatches.length && realMatches.length > 0 && (
          <span className="text-xs font-bold text-green-400 rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1">
            ✓ Week Complete
          </span>
        )}
      </div>

      {/* BYE weeks */}
      {byeMatches.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Bye This Week</h3>
          {byeMatches.map(m => (
            <ByeWeekBanner key={m.id} byeTeamName={teamName(m.homeTeam)} />
          ))}
        </div>
      )}

      {/* Matches */}
      <div className="space-y-4">
        <h2 className="text-xl font-black">Week {week} Matches</h2>
        {realMatches.map(match => (
          <MatchCard key={match.id} match={match} teamName={teamName} />
        ))}
      </div>

      <StandingsTable standings={standings} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ScheduleClient({ matches, teams, initialWeek }: {
  matches: ScheduleMatch[];
  teams: Team[];
  initialWeek: number;
}) {
  const realMatches = matches.filter(m => !m.isBye);
  const weeks = [...new Set(matches.map(m => m.week))].sort((a, b) => a - b);
  const [activeTab, setActiveTab] = useState<number | "standings" | "playoffs">(
    initialWeek > 0 ? initialWeek : "standings"
  );

  const teamName = (id: string) => {
    if (id === BYE_ID) return "BYE";
    return teams.find(t => t.id === id)?.teamName ?? "TBD";
  };

  // Calculate standings from match data
  const standings: StandingRow[] = teams.map(team => {
    const teamMatches = realMatches.filter(m => m.homeTeam === team.id || m.awayTeam === team.id);
    const wins        = teamMatches.filter(m => m.winner === team.id).length;
    const losses      = teamMatches.filter(m => m.winner && m.winner !== team.id).length;
    const diff        = teamMatches.reduce((sum, m) => {
      if (m.homeTeam === team.id) return sum + (m.homeDiff ?? 0);
      if (m.awayTeam === team.id) return sum + (m.awayDiff ?? 0);
      return sum;
    }, 0);
    return { teamId: team.id, teamName: team.teamName, coachName: team.coach?.name ?? "—", wins, losses, battleDiff: diff, seed: 0 };
  }).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.battleDiff !== a.battleDiff) return b.battleDiff - a.battleDiff;
    return parseFloat(winPct(b.wins, b.losses)) - parseFloat(winPct(a.wins, a.losses));
  }).map((row, idx) => ({ ...row, seed: idx + 1 }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Schedule & Standings</h1>
        <p className="text-muted-foreground mt-1">
          National Dex Bo3 · Battle Differential tie-breaker · All teams qualify for playoffs
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        <button onClick={() => setActiveTab("standings")}
          className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 ${activeTab === "standings" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
          <Trophy size={14} /> Standings
        </button>

        {weeks.map(week => {
          const wm = matches.filter(m => m.week === week && !m.isBye);
          const allDone = wm.length > 0 && wm.every(m => m.winner);
          const hasBye  = matches.some(m => m.week === week && m.isBye);
          return (
            <button key={week} onClick={() => setActiveTab(week)}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${activeTab === week ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
              Week {week}
              {hasBye && <span className="ml-1 text-yellow-400" title="Bye week">😴</span>}
              {allDone && <span className="ml-1 text-green-400">✓</span>}
            </button>
          );
        })}

        <button onClick={() => setActiveTab("playoffs")}
          className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 ${activeTab === "playoffs" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
          <Swords size={14} /> Playoffs
        </button>
      </div>

      {/* Content */}
      {activeTab === "standings" && <StandingsTable standings={standings} />}
      {activeTab === "playoffs" && (
        <PlayoffBracket standings={standings} matches={realMatches} teamName={teamName} />
      )}
      {typeof activeTab === "number" && (
        <WeekTab week={activeTab} matches={matches} teamName={teamName} standings={standings} />
      )}
    </div>
  );
}
