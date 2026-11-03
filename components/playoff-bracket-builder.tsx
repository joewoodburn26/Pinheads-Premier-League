"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Settings2, Shuffle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MatchCard, type TeamVisual } from "@/components/schedule/match-card";
import type { StandingRow } from "@/components/schedule/standings";
import { bracketSize, roundCount, roundName } from "@/lib/bracket";
import { seedPlayoffs, setFirstRoundTeam, type PlayoffMatch } from "@/lib/playoff-actions";
import type { ScheduleMatch } from "@/lib/types";

/** Playoff match → the shape the match card / report panel use (team 1 = "home") */
function asScheduleMatch(m: PlayoffMatch): ScheduleMatch {
  return {
    id: m.id, seasonId: m.seasonId, week: 0,
    homeTeam: m.team1Id ?? "", awayTeam: m.team2Id ?? "",
    winner: m.winner, bo3Score: m.bo3Score, homeDiff: m.team1Diff, awayDiff: m.team2Diff,
    replay1: m.replay1, replay2: m.replay2, replay3: m.replay3,
  };
}

/** Games each side won, from "2-1" and the winner */
function gamesWon(m: PlayoffMatch): [number | null, number | null] {
  const s = /^(\d)-(\d)$/.exec(m.bo3Score ?? "");
  if (!s || !m.winner) return [null, null];
  const hi = Number(s[1]);
  const lo = Number(s[2]);
  return m.winner === m.team1Id ? [hi, lo] : [lo, hi];
}

// ─── One match in the bracket ─────────────────────────────────────────────────

function TeamLine({
  team, seed, score, state, editing, options, onPick,
}: {
  team?: TeamVisual; seed: number | null; score: number | null; state: "win" | "loss" | "none";
  editing?: boolean; options?: { id: string; label: string }[]; onPick?: (id: string) => void;
}) {
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 ${state === "loss" ? "opacity-50" : ""}`}>
      <span className="w-5 shrink-0 text-center text-[10px] font-black text-muted-foreground">{seed ?? ""}</span>
      {team?.aceSprite ? (
        <Image src={team.aceSprite} alt="" width={24} height={24} className="size-6 shrink-0 object-contain" />
      ) : (
        <span className="size-6 shrink-0" />
      )}
      {editing && options && onPick ? (
        <select
          value={team?.id ?? ""}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onPick(e.target.value)}
          className="min-w-0 flex-1 rounded border bg-background px-1 py-0.5 text-xs"
        >
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      ) : (
        <span className={`min-w-0 flex-1 truncate text-sm ${team ? (state === "win" ? "font-black" : "font-semibold") : "italic text-muted-foreground"}`}>
          {team?.name ?? "TBD"}
        </span>
      )}
      {score !== null && <span className={`text-sm font-black tabular-nums ${state === "win" ? "" : "text-muted-foreground"}`}>{score}</span>}
      {state === "win" && score === null && <span className="text-[10px] font-bold text-green-400">W</span>}
    </div>
  );
}

function BracketMatch({
  m, visual, seedOf, selected, onSelect, editing, options, onPick,
}: {
  m: PlayoffMatch;
  visual: (id: string | null) => TeamVisual | undefined;
  seedOf: (m: PlayoffMatch, side: 1 | 2) => number | null;
  selected: boolean;
  onSelect: () => void;
  editing: boolean;
  options: { id: string; label: string }[];
  onPick: (side: 1 | 2, id: string) => void;
}) {
  const t1 = visual(m.team1Id);
  const t2 = visual(m.team2Id);
  if (m.isBye) {
    return (
      <div className="w-[230px] rounded-lg border border-dashed bg-card/40 text-muted-foreground">
        <TeamLine
          team={t1} seed={seedOf(m, 1)} score={null} state="none"
          editing={editing && m.round === 1} options={options} onPick={(id) => onPick(1, id)}
        />
        <p className="border-t border-dashed px-2.5 py-0.5 text-[10px] uppercase tracking-wider">Bye · advances</p>
      </div>
    );
  }
  const [g1, g2] = gamesWon(m);
  const state = (id: string | null): "win" | "loss" | "none" => (!m.winner ? "none" : m.winner === id ? "win" : "loss");
  const accent = m.winner ? visual(m.winner)?.color : undefined;
  return (
    <button
      onClick={onSelect}
      className={`w-[230px] divide-y divide-white/5 rounded-lg border bg-card text-left transition ${selected ? "ring-2 ring-primary" : "hover:border-white/30"}`}
      style={accent ? { borderColor: `${accent}88` } : undefined}
    >
      <TeamLine team={t1} seed={seedOf(m, 1)} score={g1} state={state(m.team1Id)}
        editing={editing && m.round === 1} options={options} onPick={(id) => onPick(1, id)} />
      <TeamLine team={t2} seed={seedOf(m, 2)} score={g2} state={state(m.team2Id)}
        editing={editing && m.round === 1} options={options} onPick={(id) => onPick(2, id)} />
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PlayoffBracketBuilder({
  standings, playoffMatches, seasonId, visuals, playoffTeams, canSetup = false, canReport = false,
}: {
  standings: StandingRow[];
  playoffMatches: PlayoffMatch[];
  seasonId: string;
  visuals: Record<string, TeamVisual>;
  /** Season setting: teams that qualify (undefined = everyone) */
  playoffTeams?: number;
  /** Admins and the owner seed the bracket */
  canSetup?: boolean;
  /** Signed-in members report results */
  canReport?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [confirmReseed, setConfirmReseed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileRound, setMobileRound] = useState<number | null>(null);

  const qualifiers = Math.min(standings.length, playoffTeams ?? standings.length);
  const rounds = useMemo(() => {
    const byRound = new Map<number, PlayoffMatch[]>();
    for (const m of playoffMatches) byRound.set(m.round, [...(byRound.get(m.round) ?? []), m]);
    return [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([round, ms]) => ({
      round,
      name: ms[0]?.roundName || roundName(round, qualifiers),
      matches: ms.sort((a, b) => a.slotIndex - b.slotIndex),
    }));
  }, [playoffMatches, qualifiers]);
  const hasBracket = rounds.length > 0;
  const reported = playoffMatches.some((m) => m.winner && !m.isBye);
  const final = rounds[rounds.length - 1]?.matches[0];
  const champion = final?.winner ? visuals[final.winner] : undefined;

  const visual = (id: string | null) => (id ? visuals[id] : undefined);
  const standingSeed = (id: string | null) => (id ? standings.find((r) => r.teamId === id)?.seed ?? null : null);
  const seedOf = (m: PlayoffMatch, side: 1 | 2) =>
    (side === 1 ? m.team1Seed : m.team2Seed) ?? standingSeed(side === 1 ? m.team1Id : m.team2Id);
  const teamOptions = standings.map((r) => ({ id: r.teamId, label: `#${r.seed} ${r.teamName}` }));

  function seed(reset = false) {
    setError("");
    start(async () => {
      try {
        const res = await seedPlayoffs(seasonId, reset);
        if (res.needsConfirm) return setConfirmReseed(true);
        if (res.error) return setError(res.error);
        setConfirmReseed(false);
        setEditing(false);
        router.refresh();
      } catch {
        setError("Couldn't seed the bracket. Try again.");
      }
    });
  }

  function pick(matchId: string, side: 1 | 2, teamId: string) {
    setError("");
    start(async () => {
      try {
        const res = await setFirstRoundTeam(matchId, side, teamId);
        if (res.error) return setError(res.error);
        router.refresh();
      } catch {
        setError("Couldn't change that spot.");
      }
    });
  }

  const selected = playoffMatches.find((m) => m.id === selectedId && !m.isBye);
  const activeMobile = mobileRound ?? rounds.find((r) => r.matches.some((m) => !m.isBye && !m.winner))?.round ?? rounds[0]?.round;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Playoffs</h2>
          <p className="text-sm text-muted-foreground">
            {qualifiers === standings.length ? "All" : `Top ${qualifiers} of`} {standings.length} teams · single elimination · Bo3
            {bracketSize(qualifiers) !== qualifiers ? ` · top ${bracketSize(qualifiers) - qualifiers} seed${bracketSize(qualifiers) - qualifiers === 1 ? "" : "s"} get a bye` : ""}
          </p>
        </div>
        {canSetup && (
          <div className="flex flex-wrap items-center gap-2">
            {hasBracket && !reported && (
              <Button variant="secondary" onClick={() => setEditing((v) => !v)} disabled={pending}>
                <Settings2 size={14} className="mr-2" /> {editing ? "Done adjusting" : "Adjust seeds"}
              </Button>
            )}
            <Button onClick={() => seed(false)} disabled={pending}>
              {pending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Shuffle size={14} className="mr-2" />}
              {hasBracket ? "Re-seed from standings" : "Seed from standings"}
            </Button>
          </div>
        )}
      </div>

      {confirmReseed && (
        <Card className="flex flex-wrap items-center gap-3 border-red-500/40 bg-red-500/5 p-4 text-sm">
          <span>Playoff results have been reported. Re-seeding removes them and their stats.</span>
          <Button onClick={() => seed(true)} disabled={pending} className="bg-red-600 text-white hover:bg-red-500">Re-seed anyway</Button>
          <button onClick={() => setConfirmReseed(false)} className="text-muted-foreground hover:text-foreground">Cancel</button>
        </Card>
      )}
      {error && <p className="text-sm text-red-400">✗ {error}</p>}
      {editing && (
        <p className="text-xs text-muted-foreground">
          Pick a team for any first-round spot. If it&apos;s already in the bracket the two teams swap places. Seeds move with their team.
        </p>
      )}

      {/* ── Champion ────────────────────────────────────────────────── */}
      {champion && (
        <div
          className="relative flex items-center gap-4 overflow-hidden rounded-xl border px-5 py-4"
          style={{ borderColor: `${champion.color}88`, background: `linear-gradient(90deg, ${champion.color}33, transparent)` }}
        >
          <Crown className="text-yellow-400" size={28} />
          {champion.aceSprite && <Image src={champion.aceSprite} alt="" width={64} height={64} className="size-16 object-contain" />}
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-yellow-400">Champion</p>
            <p className="text-2xl font-black">{champion.name}</p>
            <p className="text-xs text-muted-foreground">{champion.coach}</p>
          </div>
        </div>
      )}

      {/* ── No bracket yet ──────────────────────────────────────────── */}
      {!hasBracket && (
        <Card className="space-y-3 p-5">
          <p className="font-bold">The bracket hasn&apos;t been set yet.</p>
          <p className="text-sm text-muted-foreground">
            {canSetup ? "Seed it from the standings when the regular season ends." : "It appears here once an admin seeds it."} If the season ended today:
          </p>
          <div className="flex flex-wrap gap-2">
            {standings.slice(0, qualifiers).map((r) => (
              <span key={r.teamId} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold">
                <span className="text-muted-foreground">#{r.seed}</span>
                {visuals[r.teamId]?.aceSprite && <Image src={visuals[r.teamId].aceSprite!} alt="" width={20} height={20} className="size-5 object-contain" />}
                {r.teamName}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* ── Bracket: desktop ────────────────────────────────────────── */}
      {hasBracket && (
        <div className="hidden overflow-x-auto pb-2 lg:block">
          <div className="flex min-w-fit gap-8">
            {rounds.map((r, ri) => {
              const last = ri === rounds.length - 1;
              const pairs = last ? [r.matches] : Array.from({ length: Math.ceil(r.matches.length / 2) }, (_, i) => r.matches.slice(i * 2, i * 2 + 2));
              return (
                <div key={r.round} className="flex flex-col">
                  <p className={`mb-3 text-center text-xs font-bold uppercase tracking-wider ${last ? "text-yellow-400" : "text-muted-foreground"}`}>
                    {last && <Trophy size={12} className="mr-1 inline" />}{r.name}
                  </p>
                  <div className="flex flex-1 flex-col">
                    {pairs.map((pair, pi) => (
                      <div key={pi} className="relative flex flex-1 flex-col">
                        {pair.map((m) => (
                          <div key={m.id} className={`relative flex flex-1 items-center py-2 ${ri > 0 ? "before:absolute before:-left-4 before:top-1/2 before:w-4 before:border-t-2 before:border-white/15" : ""}`}>
                            <BracketMatch
                              m={m} visual={visual} seedOf={seedOf}
                              selected={selectedId === m.id}
                              onSelect={() => setSelectedId(m.id === selectedId ? null : m.id)}
                              editing={editing} options={teamOptions}
                              onPick={(side, id) => pick(m.id, side, id)}
                            />
                          </div>
                        ))}
                        {!last && pair.length === 2 && (
                          <div className="pointer-events-none absolute -right-4 bottom-1/4 top-1/4 w-4 rounded-r border-y-2 border-r-2 border-white/15" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected match (desktop) ────────────────────────────────── */}
      {selected && (
        <div className="hidden lg:block">
          {selected.team1Id && selected.team2Id ? (
            <MatchCard
              key={selected.id}
              kind="playoff"
              label={`${rounds.find((r) => r.round === selected.round)?.name ?? "Playoffs"} · match ${selected.slotIndex + 1}`}
              match={asScheduleMatch(selected)}
              home={visuals[selected.team1Id]}
              away={visuals[selected.team2Id]}
              canReport={canReport}
            />
          ) : (
            <Card className="p-4 text-sm text-muted-foreground">Waiting for the previous round to finish.</Card>
          )}
        </div>
      )}
      {hasBracket && !selected && (
        <p className="hidden text-xs text-muted-foreground lg:block">Click a match to see it{canReport ? " or report its result" : ""}.</p>
      )}

      {/* ── Bracket: phones (one round at a time) ───────────────────── */}
      {hasBracket && (
        <div className="space-y-3 lg:hidden">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {rounds.map((r) => (
              <button
                key={r.round}
                onClick={() => setMobileRound(r.round)}
                className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold ${activeMobile === r.round ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground"}`}
              >
                {r.name}
              </button>
            ))}
          </div>
          {rounds.filter((r) => r.round === activeMobile).map((r) => {
            const byes = r.matches.filter((m) => m.isBye);
            return (
              <div key={r.round} className="space-y-3">
                {r.matches.filter((m) => !m.isBye).map((m, i) =>
                  m.team1Id && m.team2Id ? (
                    <MatchCard
                      key={m.id}
                      kind="playoff"
                      label={`${r.name} · match ${i + 1}`}
                      match={asScheduleMatch(m)}
                      home={visuals[m.team1Id]}
                      away={visuals[m.team2Id]}
                      canReport={canReport}
                    />
                  ) : (
                    <Card key={m.id} className="p-3 text-sm text-muted-foreground">
                      {visual(m.team1Id)?.name ?? "TBD"} vs {visual(m.team2Id)?.name ?? "TBD"}
                    </Card>
                  ),
                )}
                {byes.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Byes: {byes.map((m) => `#${seedOf(m, 1)} ${visual(m.team1Id)?.name ?? ""}`).join(", ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasBracket && rounds.length !== roundCount(qualifiers) && canSetup && (
        <p className="text-xs text-yellow-400">
          The number of playoff teams changed since the bracket was made. Re-seed to rebuild it.
        </p>
      )}
    </div>
  );
}
