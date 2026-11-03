"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Moon, Swords, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PlayoffBracketBuilder } from "@/components/playoff-bracket-builder";
import { MatchCard, type TeamVisual } from "@/components/schedule/match-card";
import { computeStandings, type StandingRow } from "@/components/schedule/standings";
import type { PlayoffMatch } from "@/lib/playoff-actions";
import type { ScheduleMatch, Team } from "@/lib/types";

const BYE_ID = "BYE";

// ─── Standings ────────────────────────────────────────────────────────────────

function StandingsTable({ standings, visuals }: { standings: StandingRow[]; visuals: Record<string, TeamVisual> }) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Team</th>
                <th className="p-3 text-center">Record</th>
                <th className="p-3 text-center">Diff</th>
                <th className="p-3 text-center">Games</th>
                <th className="p-3 text-center">Form</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => {
                const v = visuals[row.teamId];
                const diffColor = row.battleDiff > 0 ? "text-green-400" : row.battleDiff < 0 ? "text-red-400" : "text-muted-foreground";
                return (
                  <tr key={row.teamId} className="border-t border-white/5">
                    <td className="p-3 font-black text-muted-foreground">{row.seed}</td>
                    <td className="p-3">
                      <Link href={`/teams/${row.teamId}`} className="flex items-center gap-2.5 hover:underline">
                        <span className="h-8 w-1 rounded-full" style={{ background: v?.color }} />
                        {v?.aceSprite ? (
                          <Image src={v.aceSprite} alt="" width={32} height={32} className="size-8 object-contain" />
                        ) : null}
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{row.teamName}</span>
                          <span className="block truncate text-xs text-muted-foreground">{row.coachName}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="p-3 text-center font-bold tabular-nums">{row.wins}–{row.losses}</td>
                    <td className={`p-3 text-center font-bold tabular-nums ${diffColor}`}>{row.battleDiff > 0 ? `+${row.battleDiff}` : row.battleDiff}</td>
                    <td className="p-3 text-center tabular-nums text-muted-foreground">{row.gameWins}–{row.gameLosses}</td>
                    <td className="p-3">
                      <div className="flex justify-center gap-1">
                        {row.form.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        {row.form.map((r, i) => (
                          <span
                            key={i}
                            className={`grid size-5 place-items-center rounded text-[10px] font-black ${r === "W" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">
        Tie-breakers, in order: match record → battle differential → head-to-head between the tied teams → game win %.
        Form shows the last 5 results, newest first.
      </p>
    </div>
  );
}

// ─── Week strip ───────────────────────────────────────────────────────────────

function WeekStrip({ weeks, active, onPick, matches }: {
  weeks: number[]; active: number; onPick: (w: number) => void; matches: ScheduleMatch[];
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {weeks.map((w) => {
        const wm = matches.filter((m) => m.week === w && !m.isBye);
        const on = w === active;
        return (
          <button
            key={w}
            onClick={() => onPick(w)}
            className={`flex min-w-[64px] shrink-0 flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-colors ${on ? "border-primary bg-primary/15" : "hover:bg-muted"}`}
          >
            <span className={`text-xs font-bold ${on ? "text-primary" : "text-muted-foreground"}`}>Week</span>
            <span className="text-lg font-black leading-none">{w}</span>
            <span className="flex gap-0.5">
              {wm.map((m) => (
                <span key={m.id} className={`size-1.5 rounded-full ${m.winner ? "bg-green-400" : "bg-white/20"}`} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ScheduleClient({
  matches, teams, initialWeek, playoffMatches, seasonId, visuals, myTeamId, subtitle, playoffTeams,
  canReport = false, canSetupBracket = false,
}: {
  matches: ScheduleMatch[];
  teams: Team[];
  /** Week from the URL, if any */
  initialWeek?: number;
  playoffMatches: PlayoffMatch[];
  seasonId: string;
  visuals: Record<string, TeamVisual>;
  myTeamId?: string;
  subtitle: string;
  /** Teams that make the playoffs (undefined = everyone) */
  playoffTeams?: number;
  /** Signed-in members can report results */
  canReport?: boolean;
  /** Admins and the owner can arrange the playoff bracket */
  canSetupBracket?: boolean;
}) {
  const weeks = useMemo(() => [...new Set(matches.map((m) => m.week))].sort((a, b) => a - b), [matches]);
  // Open on the first week that still has matches to play
  const currentWeek =
    weeks.find((w) => matches.some((m) => m.week === w && !m.isBye && !m.winner)) ?? weeks[weeks.length - 1] ?? 1;
  const [tab, setTab] = useState<"matches" | "standings" | "playoffs">("matches");
  const [week, setWeek] = useState(initialWeek && weeks.includes(initialWeek) ? initialWeek : currentWeek);

  const standings = useMemo(() => computeStandings(teams, matches), [teams, matches]);
  const visual = (id: string): TeamVisual =>
    visuals[id] ?? { id, name: id === BYE_ID ? "BYE" : "TBD", coach: "", logoUrl: null, aceSprite: null, color: "#64748b", color2: "#64748b" };

  const weekMatches = matches.filter((m) => m.week === week);
  const games = weekMatches
    .filter((m) => !m.isBye && m.awayTeam !== BYE_ID)
    .sort((a, b) => Number(b.homeTeam === myTeamId || b.awayTeam === myTeamId) - Number(a.homeTeam === myTeamId || a.awayTeam === myTeamId));
  // Off this week: saved bye rows, plus any team with no match that week (odd team counts)
  const playing = new Set(games.flatMap((m) => [m.homeTeam, m.awayTeam]));
  const byeIds = [
    ...weekMatches.filter((m) => m.isBye || m.awayTeam === BYE_ID).map((m) => m.homeTeam),
    ...teams.map((t) => t.id).filter((id) => !playing.has(id)),
  ];
  const byes = [...new Set(byeIds)].filter((id) => !playing.has(id));
  const done = games.filter((m) => m.winner).length;

  const tabBtn = (id: typeof tab, label: string, Icon: typeof Trophy) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black sm:text-4xl">Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex gap-1 rounded-lg border p-1">
          {tabBtn("matches", "Matches", CalendarDays)}
          {tabBtn("standings", "Standings", Trophy)}
          {tabBtn("playoffs", "Playoffs", Swords)}
        </div>
      </div>

      {tab === "matches" && (
        <div className="space-y-5">
          <WeekStrip weeks={weeks} active={week} onPick={setWeek} matches={matches} />

          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black">Week {week}</h2>
            <span className="rounded-full border px-3 py-0.5 text-xs text-muted-foreground">
              {done}/{games.length} played
            </span>
            {games.length > 0 && done === games.length && (
              <span className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-0.5 text-xs font-bold text-green-400">Week complete</span>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {games.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                home={visual(m.homeTeam)}
                away={visual(m.awayTeam)}
                canReport={canReport}
                highlight={!!myTeamId && (m.homeTeam === myTeamId || m.awayTeam === myTeamId)}
              />
            ))}
          </div>
          {games.length === 0 && <p className="text-sm text-muted-foreground">No matches this week.</p>}

          {byes.length > 0 && games.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              <Moon size={14} /> Off this week:
              {byes.map((id) => {
                const v = visual(id);
                return (
                  <Link key={id} href={`/teams/${id}`} className="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground hover:bg-muted">
                    {v.aceSprite && <Image src={v.aceSprite} alt="" width={20} height={20} className="size-5 object-contain" />}
                    {v.name}
                  </Link>
                );
              })}
            </div>
          )}

          {!canReport && (
            <p className="text-xs text-muted-foreground">
              <Link href="/login?next=/schedule" className="underline hover:text-foreground">Sign in</Link> to report results.
            </p>
          )}
        </div>
      )}

      {tab === "standings" && <StandingsTable standings={standings} visuals={visuals} />}

      {tab === "playoffs" && (
        <PlayoffBracketBuilder
          standings={standings}
          playoffMatches={playoffMatches}
          seasonId={seasonId}
          visuals={visuals}
          playoffTeams={playoffTeams}
          canSetup={canSetupBracket}
          canReport={canReport}
        />
      )}
    </div>
  );
}
