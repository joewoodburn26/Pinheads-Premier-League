"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, ExternalLink, Loader2, Minus, Plus, Save, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearMatchReport, readMatchReplays, saveMatchReport,
  type MatchKind, type ReportGame, type ReportPreview, type RosterMon, type StatDelta,
} from "@/lib/match-report";
import type { ScheduleMatch } from "@/lib/types";

type Side = "p1" | "p2";
type TeamInfo = { name: string; color: string };

/** Editable copy of one replay's numbers */
type GameDraft = ReportGame & {
  homeSide: Side | null;
  /** Couldn't tell which player is which team; we guessed */
  unsure: boolean;
  /** per mon index: chosen roster Pokémon ("" = don't count) */
  picks: string[];
  kos: number[];
  deaths: number[];
};

function draftOf(g: ReportGame): GameDraft {
  const homeSide: Side | null = g.error ? null : g.homeSide ?? "p1";
  return {
    ...g,
    homeSide,
    unsure: !g.error && !g.homeSide,
    picks: g.mons.map((m) => pickFor(m, homeSide)),
    kos: g.mons.map((m) => m.kos),
    deaths: g.mons.map((m) => m.deaths),
  };
}

function pickFor(m: ReportGame["mons"][number], homeSide: Side | null) {
  if (!homeSide) return "";
  return (m.side === homeSide ? m.homeMatch : m.awayMatch) ?? "";
}

/** Winner, score and battle diff from the replays */
function summarize(drafts: GameDraft[], homeId: string, awayId: string) {
  let homeWins = 0;
  let awayWins = 0;
  let homeDiff = 0;
  for (const g of drafts) {
    if (g.error || !g.homeSide || !g.winnerSide) continue;
    const awaySide: Side = g.homeSide === "p1" ? "p2" : "p1";
    if (g.winnerSide === g.homeSide) homeWins++;
    else awayWins++;
    homeDiff += g.remaining[g.homeSide] - g.remaining[awaySide];
  }
  const winner = homeWins >= 2 || (homeWins > awayWins && homeWins + awayWins >= 1) ? homeId : awayWins > homeWins ? awayId : "";
  const hi = Math.max(homeWins, awayWins);
  const lo = Math.min(homeWins, awayWins);
  const score = hi === 2 && (lo === 0 || lo === 1) ? `2-${lo}` : "";
  return { winner, score, homeDiff };
}

export function ReportPanel({
  kind = "regular",
  match,
  home,
  away,
  onClose,
}: {
  /** Regular-season or playoff match (for playoffs, home = team 1) */
  kind?: MatchKind;
  match: ScheduleMatch;
  home: TeamInfo;
  away: TeamInfo;
  onClose: () => void;
}) {
  const router = useRouter();
  const [urls, setUrls] = useState<[string, string, string]>([match.replay1 ?? "", match.replay2 ?? "", match.replay3 ?? ""]);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [drafts, setDrafts] = useState<GameDraft[]>([]);
  const [winner, setWinner] = useState(match.winner ?? "");
  const [score, setScore] = useState(match.bo3Score ?? "");
  const [homeDiff, setHomeDiff] = useState(String(match.homeDiff ?? 0));
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [reading, startRead] = useTransition();
  const [saving, startSave] = useTransition();

  function read() {
    setError("");
    startRead(async () => {
      try {
        const res = await readMatchReplays(match.homeTeam, match.awayTeam, urls);
        if (res.error || !res.preview) return setError(res.error ?? "Couldn't read the replays.");
        const next = res.preview.games.map(draftOf);
        setPreview(res.preview);
        setDrafts(next);
        const s = summarize(next, match.homeTeam, match.awayTeam);
        if (s.winner) setWinner(s.winner);
        if (s.score) setScore(s.score);
        setHomeDiff(String(s.homeDiff));
      } catch {
        setError("Couldn't read the replays. Check the links and try again.");
      }
    });
  }

  function updateDraft(i: number, d: GameDraft) {
    const next = drafts.map((g, j) => (j === i ? d : g));
    setDrafts(next);
    const s = summarize(next, match.homeTeam, match.awayTeam);
    if (s.winner) setWinner(s.winner);
    if (s.score) setScore(s.score);
    setHomeDiff(String(s.homeDiff));
  }

  function save() {
    setError("");
    setNotes([]);
    const games = drafts
      .filter((g) => !g.error && !g.legacy && g.homeSide)
      .map((g) => ({
        url: g.url,
        stats: g.mons.flatMap((m, k): StatDelta[] => {
          const pokemonId = g.picks[k];
          if (!pokemonId) return [];
          const teamId = m.side === g.homeSide ? match.homeTeam : match.awayTeam;
          return [{ teamId, pokemonId, games: m.games, kos: g.kos[k], deaths: g.deaths[k] }];
        }),
      }));
    const diff = parseInt(homeDiff) || 0;
    startSave(async () => {
      try {
        const res = await saveMatchReport({
          kind,
          matchId: match.id,
          winner: winner || null,
          bo3Score: score || null,
          homeDiff: diff,
          awayDiff: -diff,
          replays: urls,
          games,
        });
        if (res.error) return setError(res.error);
        if (res.notes?.length) setNotes(res.notes);
        router.refresh();
        if (!res.notes?.length) onClose();
      } catch {
        setError("Couldn't save. Make sure you're signed in and try again.");
      }
    });
  }

  function clear() {
    startSave(async () => {
      try {
        const res = await clearMatchReport(kind, match.id);
        if (res.error) return setError(res.error);
        if (res.notes?.length) setNotes(res.notes);
        router.refresh();
        onClose();
      } catch {
        setError("Couldn't clear the result.");
      }
    });
  }

  const diffNum = parseInt(homeDiff) || 0;
  const unmatched = drafts.reduce((n, g) => n + g.picks.filter((p) => !p).length, 0);

  return (
    <div className="space-y-5 border-t border-white/5 bg-black/20 p-4 sm:p-5">
      {/* ── Replays ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Replays</p>
        <div className="grid gap-2 md:grid-cols-3">
          {urls.map((u, i) => (
            <div key={i} className="flex gap-1">
              <Input
                value={u}
                onChange={(e) => setUrls((prev) => prev.map((v, j) => (j === i ? e.target.value : v)) as [string, string, string])}
                placeholder={`Game ${i + 1}${i === 2 ? " (if played)" : ""} · replay.pokemonshowdown.com/…`}
                className="text-xs"
              />
              {u && (
                <a href={u} target="_blank" rel="noopener noreferrer" title="Open replay" className="grid shrink-0 place-items-center rounded-md border px-2 hover:bg-muted">
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          ))}
        </div>
        <Button variant="secondary" onClick={read} disabled={reading || !urls.some((u) => u.trim())}>
          {reading ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Wand2 size={14} className="mr-2" />}
          {reading ? "Reading replays…" : preview ? "Read replays again" : "Read replays"}
        </Button>
        {!preview && (
          <p className="text-xs text-muted-foreground">
            Reads each game&apos;s winner, the battle differential and every Pokémon&apos;s KOs and deaths. You can check and fix it before saving.
          </p>
        )}
      </div>

      {/* ── Per-game breakdown ──────────────────────────────────────── */}
      {preview && drafts.map((g, i) => (
        <GameBlock
          key={g.url}
          index={i}
          game={g}
          home={home}
          away={away}
          homeRoster={preview.home}
          awayRoster={preview.away}
          onChange={(d) => updateDraft(i, d)}
        />
      ))}
      {preview && unmatched > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-yellow-400">
          <AlertTriangle size={13} /> {unmatched} Pokémon couldn&apos;t be matched to a roster. Pick the right one above, or leave it as &quot;Don&apos;t count&quot;.
        </p>
      )}

      {/* ── Result ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Result</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            Series winner
            <select value={winner} onChange={(e) => setWinner(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground">
              <option value="">— Not played —</option>
              <option value={match.homeTeam}>{home.name}</option>
              <option value={match.awayTeam}>{away.name}</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Score
            <select value={score} onChange={(e) => setScore(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground">
              <option value="">—</option>
              <option value="2-0">2-0</option>
              <option value="2-1">2-1</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Battle diff ({home.name})
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={homeDiff}
                onChange={(e) => setHomeDiff(e.target.value)}
                className={diffNum > 0 ? "font-bold text-green-400" : diffNum < 0 ? "font-bold text-red-400" : ""}
              />
              <span className="whitespace-nowrap text-xs">{away.name}: {diffNum > 0 ? -diffNum : diffNum < 0 ? `+${-diffNum}` : 0}</span>
            </div>
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">Battle diff = Pokémon left standing minus the opponent&apos;s, added up over the games.</p>
      </div>

      {error && <p className="text-sm text-red-400">✗ {error}</p>}
      {notes.map((n) => <p key={n} className="text-xs text-yellow-400">{n}</p>)}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={saving}>
          <Save size={14} className="mr-2" /> {saving ? "Saving…" : preview ? "Save result & stats" : "Save result"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        {match.winner && (
          confirmClear ? (
            <span className="ml-auto flex items-center gap-2 text-xs">
              Remove the result and its stats?
              <button onClick={clear} disabled={saving} className="rounded bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-500">Remove</button>
              <button onClick={() => setConfirmClear(false)} className="text-muted-foreground hover:text-foreground">Keep</button>
            </span>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400">
              <Trash2 size={13} /> Clear result
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── One game ─────────────────────────────────────────────────────────────────

function GameBlock({
  index, game, home, away, homeRoster, awayRoster, onChange,
}: {
  index: number;
  game: GameDraft;
  home: TeamInfo;
  away: TeamInfo;
  homeRoster: RosterMon[];
  awayRoster: RosterMon[];
  onChange: (g: GameDraft) => void;
}) {
  const sprites = useMemo(() => new Map([...homeRoster, ...awayRoster].map((r) => [r.id, r])), [homeRoster, awayRoster]);

  if (game.error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
        <p className="font-bold">Game {index + 1}</p>
        <p className="text-xs text-red-400">{game.error}</p>
      </div>
    );
  }

  const homeSide = game.homeSide;
  const swap = () => {
    const next: Side = homeSide === "p1" ? "p2" : "p1";
    onChange({ ...game, homeSide: next, unsure: false, picks: game.mons.map((m) => pickFor(m, next)) });
  };
  const winnerName = !game.winnerSide || !homeSide ? "—" : game.winnerSide === homeSide ? home.name : away.name;
  const player = (side: Side) => (side === "p1" ? game.p1 : game.p2);

  const column = (forHome: boolean) => {
    const side: Side | null = homeSide ? (forHome ? homeSide : homeSide === "p1" ? "p2" : "p1") : forHome ? "p1" : "p2";
    const team = forHome ? home : away;
    const roster = forHome ? homeRoster : awayRoster;
    const rows = game.mons.map((m, k) => ({ m, k })).filter(({ m }) => m.side === side);
    return (
      <div className="min-w-0 rounded-lg border" style={{ borderColor: `${team.color}55` }}>
        <div className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2" style={{ background: `${team.color}1a` }}>
          <span className="truncate text-sm font-black">{team.name}</span>
          <span className="truncate text-[11px] text-muted-foreground">{side ? player(side) : ""} · {side ? game.remaining[side] : 0} left</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 p-2 text-sm">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pokémon</span>
          <span className="w-[76px] text-center text-[10px] uppercase tracking-wider text-muted-foreground">KOs</span>
          <span className="w-[76px] text-center text-[10px] uppercase tracking-wider text-muted-foreground">Deaths</span>
          {rows.map(({ m, k }) => {
            const picked = game.picks[k];
            const mon = picked ? sprites.get(picked) : undefined;
            const auto = (m.side === homeSide ? m.homeMatch : m.awayMatch) === picked && !!picked;
            return (
              <div key={k} className="contents">
                <div className="flex min-w-0 items-center gap-1.5">
                  {mon ? (
                    <Image src={mon.sprite} alt="" width={28} height={28} className="size-7 shrink-0 object-contain" />
                  ) : (
                    <span className="grid size-7 shrink-0 place-items-center text-yellow-400"><AlertTriangle size={14} /></span>
                  )}
                  {auto ? (
                    <span className="truncate font-semibold">{mon?.name ?? m.species}</span>
                  ) : (
                    <select
                      value={picked}
                      onChange={(e) => onChange({ ...game, picks: game.picks.map((p, j) => (j === k ? e.target.value : p)) })}
                      className={`min-w-0 flex-1 rounded border bg-background px-1 py-0.5 text-xs ${picked ? "" : "border-yellow-500/60"}`}
                      title={`Replay shows: ${m.species}`}
                    >
                      <option value="">{m.species}: don&apos;t count</option>
                      {roster.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}
                </div>
                <Stepper value={game.kos[k]} tone="good" onChange={(v) => onChange({ ...game, kos: game.kos.map((x, j) => (j === k ? v : x)) })} />
                <Stepper value={game.deaths[k]} tone="bad" max={1} onChange={(v) => onChange({ ...game, deaths: game.deaths.map((x, j) => (j === k ? v : x)) })} />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm font-black">Game {index + 1}</p>
        <span className="text-xs text-muted-foreground">Winner: <span className="font-bold text-foreground">{winnerName}</span></span>
        {game.legacy && (
          <span className="rounded border border-yellow-500/40 px-1.5 py-0.5 text-[11px] text-yellow-400">
            Stats already counted by the old parser; they won&apos;t be changed
          </span>
        )}
        <button onClick={swap} className="ml-auto flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" title="Use if the teams are on the wrong sides">
          <ArrowLeftRight size={12} /> Swap sides
        </button>
      </div>
      {game.unsure && (
        <p className="text-xs text-yellow-400">Couldn&apos;t tell which player is which team. Check the sides and use Swap sides if they&apos;re backwards.</p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {column(true)}
        {column(false)}
      </div>
    </div>
  );
}

function Stepper({ value, onChange, tone, max = 9 }: { value: number; onChange: (v: number) => void; tone: "good" | "bad"; max?: number }) {
  const color = value === 0 ? "text-muted-foreground" : tone === "good" ? "text-green-400" : "text-red-400";
  return (
    <div className="flex w-[76px] items-center justify-between rounded-md border">
      <button onClick={() => onChange(Math.max(0, value - 1))} className="px-1.5 py-1 text-muted-foreground hover:text-foreground" aria-label="Less"><Minus size={11} /></button>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="px-1.5 py-1 text-muted-foreground hover:text-foreground" aria-label="More"><Plus size={11} /></button>
    </div>
  );
}
