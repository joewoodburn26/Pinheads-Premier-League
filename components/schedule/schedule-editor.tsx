"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, Lock, Moon, Plus, Trash2, Unlock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  editClearsResult, planScheduleSave, scheduleErrors, scheduleWarnings, type SavedGame,
} from "@/lib/schedule-edit";
import { saveScheduleEdits } from "@/lib/schedule-edit-actions";
import type { ScheduleMatch, Team } from "@/lib/types";

type Draft = {
  key: string;
  id?: string;
  week: number;
  home: string;
  away: string;
  /** Saved result (score text), if the game has been played */
  result: string | null;
  /** Admin confirmed they may change the teams of a played game */
  unlocked: boolean;
};

const BYE_ID = "BYE";
let nextKey = 0;
const newKey = () => `new-${++nextKey}`;

const select = "min-w-0 rounded-md border bg-background px-2 py-2 text-sm disabled:opacity-60";

export function ScheduleEditor({
  matches,
  teams,
  seasonId,
  startWeek,
  onClose,
}: {
  matches: ScheduleMatch[];
  teams: Team[];
  seasonId: string;
  startWeek: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  // ── Saved state, for comparing ──
  const saved: SavedGame[] = useMemo(
    () =>
      matches
        .filter((m) => !m.isBye && m.awayTeam !== BYE_ID)
        .map((m) => ({
          id: m.id, week: m.week, home: m.homeTeam, away: m.awayTeam, played: Boolean(m.winner),
          replays: [m.replay1, m.replay2, m.replay3].filter(Boolean) as string[],
          homeDiff: m.homeDiff ?? 0, awayDiff: m.awayDiff ?? 0,
        })),
    [matches],
  );
  const initial = (): Draft[] =>
    matches
      .filter((m) => !m.isBye && m.awayTeam !== BYE_ID)
      .map((m) => ({
        key: m.id, id: m.id, week: m.week, home: m.homeTeam, away: m.awayTeam,
        result: m.winner ? m.bo3Score ?? "played" : null, unlocked: false,
      }));

  const [games, setGames] = useState<Draft[]>(initial);
  const [extraWeeks, setExtraWeeks] = useState<number[]>([]);
  const [week, setWeek] = useState(startWeek);
  const [swapA, setSwapA] = useState("");
  const [swapB, setSwapB] = useState("");
  const [swapWith, setSwapWith] = useState("");

  const teamIds = useMemo(() => new Set(teams.map((t) => t.id)), [teams]);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.teamName ?? "Pick a team";
  const nameList = useMemo(() => teams.map((t) => ({ id: t.id, name: t.teamName })), [teams]);

  const weeks = useMemo(
    // The open week stays listed even if its last game was moved away
    () => [...new Set([...games.map((g) => g.week), ...extraWeeks, week])].sort((a, b) => a - b),
    [games, extraWeeks, week],
  );
  const weekGames = games.filter((g) => g.week === week);
  const busy = new Set(weekGames.flatMap((g) => [g.home, g.away]).filter(Boolean));
  const off = teams.filter((t) => !busy.has(t.id));

  // ── What saving would do ──
  const edited = games.map((g) => ({ id: g.id, week: g.week, home: g.home, away: g.away }));
  const errors = scheduleErrors(edited, teamIds);
  // Warnings the schedule already had before editing are folded away; new ones are shown
  const savedWarnings = useMemo(
    () => new Set(scheduleWarnings(saved.map((g) => ({ week: g.week, home: g.home, away: g.away })), nameList).map((w) => w.text)),
    [saved, nameList],
  );
  const warnings = scheduleWarnings(edited, nameList);
  const newWarnings = warnings.filter((w) => !savedWarnings.has(w.text));
  const oldWarnings = warnings.filter((w) => savedWarnings.has(w.text));
  const [showOld, setShowOld] = useState(false);
  const plan = errors.length ? null : planScheduleSave(saved, edited, teamIds);
  const changeCount = plan ? plan.insert.length + plan.update.length + plan.remove.length : countRough(saved, games);
  const lostResults = plan
    ? [...plan.remove.filter((g) => g.played), ...plan.update.filter((u) => u.clearResult).map((u) => u.before)]
    : [];

  useEffect(() => {
    if (!changeCount) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changeCount]);

  // ── Edits ──
  const patch = (key: string, p: Partial<Draft>) => {
    setMessage(null);
    setGames((prev) => prev.map((g) => (g.key === key ? { ...g, ...p } : g)));
  };
  const locked = (g: Draft) => Boolean(g.result) && !g.unlocked;
  const unlock = (g: Draft) => {
    if (window.confirm(`${teamName(g.home)} vs ${teamName(g.away)} has a result (${g.result}).\n\nChanging its teams or deleting it removes that result and the stats from its replays when you save. Unlock it?`)) {
      patch(g.key, { unlocked: true });
      return true;
    }
    return false;
  };
  const removeGame = (g: Draft) => {
    if (locked(g) && !unlock(g)) return;
    setGames((prev) => prev.filter((x) => x.key !== g.key));
  };
  const addGame = () => {
    const [a, b] = off;
    setGames((prev) => [...prev, { key: newKey(), week, home: a?.id ?? "", away: b?.id ?? "", result: null, unlocked: false }]);
  };
  const addWeek = () => {
    const w = (weeks[weeks.length - 1] ?? 0) + 1;
    setExtraWeeks((prev) => [...prev, w]);
    setWeek(w);
  };
  const deleteWeek = () => {
    const played = weekGames.filter((g) => g.result);
    const msg = played.length
      ? `Delete week ${week}? ${played.length} played game${played.length === 1 ? "" : "s"} and ${played.length === 1 ? "its result" : "their results"} will be removed when you save. Later weeks move up by one.`
      : `Delete week ${week}? Later weeks move up by one.`;
    if (!window.confirm(msg)) return;
    setGames((prev) => prev.filter((g) => g.week !== week).map((g) => (g.week > week ? { ...g, week: g.week - 1 } : g)));
    setExtraWeeks((prev) => prev.filter((w) => w !== week).map((w) => (w > week ? w - 1 : w)));
    setWeek(Math.max(1, week - 1));
  };
  const swapWeeks = () => {
    const other = Number(swapWith);
    if (!other || other === week) return;
    setGames((prev) => prev.map((g) => (g.week === week ? { ...g, week: other } : g.week === other ? { ...g, week } : g)));
    setSwapWith("");
    setWeek(other);
  };
  const swapTeams = () => {
    if (!swapA || !swapB || swapA === swapB) return;
    const touched = weekGames.filter((g) => [g.home, g.away].some((t) => t === swapA || t === swapB));
    const lockedOnes = touched.filter(locked);
    if (lockedOnes.length) {
      const ok = window.confirm(
        `${lockedOnes.map((g) => `${teamName(g.home)} vs ${teamName(g.away)}`).join(" and ")} already ${lockedOnes.length === 1 ? "has a result" : "have results"}. Swapping removes ${lockedOnes.length === 1 ? "it" : "them"} and the replay stats when you save. Continue?`,
      );
      if (!ok) return;
    }
    const flip = (t: string) => (t === swapA ? swapB : t === swapB ? swapA : t);
    setGames((prev) =>
      prev.map((g) =>
        g.week === week && touched.some((x) => x.key === g.key)
          ? { ...g, home: flip(g.home), away: flip(g.away), unlocked: true }
          : g,
      ),
    );
    setSwapA("");
    setSwapB("");
  };

  const discard = () => {
    if (changeCount && !window.confirm("Discard your schedule changes?")) return;
    onClose();
  };

  const save = () => {
    if (!plan) return;
    if (lostResults.length) {
      const list = lostResults.map((g) => `Week ${g.week}: ${teamName(g.home)} vs ${teamName(g.away)}`).join("\n");
      if (!window.confirm(`These results and their replay stats will be removed:\n\n${list}\n\nSave anyway?`)) return;
    }
    startTransition(async () => {
      const res = await saveScheduleEdits(seasonId, edited);
      if (res.error) return setMessage({ text: res.error, tone: "error" });
      if (res.notes?.length) window.alert(res.notes.join("\n"));
      onClose();
      router.refresh();
    });
  };

  const ordered = (list: typeof warnings) => [...list.filter((w) => w.week === week), ...list.filter((w) => w.week !== week)];
  const warningLine = (w: (typeof warnings)[number], i: number) => (
    <p key={i} className="flex items-start gap-2 text-amber-300">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span>
        {w.text}
        {w.week !== undefined && w.week !== week && (
          <button onClick={() => setWeek(w.week!)} className="ml-2 text-xs text-muted-foreground underline hover:text-foreground">Go to week {w.week}</button>
        )}
      </span>
    </p>
  );

  return (
    <div className="space-y-5 pb-24">
      <Card className="border-primary/40 bg-primary/5 p-4 text-sm">
        <p className="font-semibold">Editing the schedule</p>
        <p className="mt-0.5 text-muted-foreground">
          Nothing changes until you save. Played games are locked: moving them to another week keeps the result, but changing their teams or deleting them removes it.
        </p>
      </Card>

      {/* ── Weeks ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {weeks.map((w) => {
          const on = w === week;
          const n = games.filter((g) => g.week === w).length;
          const flagged = newWarnings.some((x) => x.week === w);
          return (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`relative flex min-w-[64px] shrink-0 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-colors ${on ? "border-primary bg-primary/15" : "hover:bg-muted"}`}
            >
              <span className={`text-xs font-bold ${on ? "text-primary" : "text-muted-foreground"}`}>Week</span>
              <span className="text-lg font-black leading-none">{w}</span>
              <span className="text-[10px] text-muted-foreground">{n} game{n === 1 ? "" : "s"}</span>
              {flagged && <span className="absolute right-1 top-1 size-2 rounded-full bg-amber-400" />}
            </button>
          );
        })}
        <button onClick={addWeek} className="flex min-w-[64px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Plus size={16} />
          <span className="text-[11px] font-semibold">Add week</span>
        </button>
      </div>

      {/* ── Week tools ── */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-2xl font-black">Week {week}</h2>
        <Button variant="secondary" onClick={addGame}><Plus size={14} className="mr-1" /> Add game</Button>
        <div className="flex items-center gap-1.5">
          <select value={swapWith} onChange={(e) => setSwapWith(e.target.value)} className={select} aria-label="Swap this week with">
            <option value="">Swap week with…</option>
            {weeks.filter((w) => w !== week).map((w) => <option key={w} value={w}>Week {w}</option>)}
          </select>
          {swapWith && <Button variant="secondary" onClick={swapWeeks}>Swap</Button>}
        </div>
        <Button variant="secondary" onClick={deleteWeek} className="text-red-400 hover:text-red-300"><Trash2 size={14} className="mr-1" /> Delete week</Button>
      </div>

      {/* ── Swap two teams ── */}
      <Card className="flex flex-wrap items-center gap-2 p-3 text-sm">
        <span className="font-semibold"><ArrowLeftRight size={14} className="mr-1 inline" /> Swap two teams this week:</span>
        <select value={swapA} onChange={(e) => setSwapA(e.target.value)} className={select}>
          <option value="">Team…</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.teamName}</option>)}
        </select>
        <span className="text-muted-foreground">and</span>
        <select value={swapB} onChange={(e) => setSwapB(e.target.value)} className={select}>
          <option value="">Team…</option>
          {teams.filter((t) => t.id !== swapA).map((t) => <option key={t.id} value={t.id}>{t.teamName}</option>)}
        </select>
        <Button variant="secondary" disabled={!swapA || !swapB} onClick={swapTeams}>Swap</Button>
        <span className="text-xs text-muted-foreground">Each takes the other&apos;s game (or bye), so everyone still plays once.</span>
      </Card>

      {/* ── Games ── */}
      <div className="space-y-2">
        {weekGames.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No games in week {week} yet. Add one above{games.every((g) => g.week !== week) && extraWeeks.includes(week) ? ". Weeks with no games aren't saved" : ""}.
          </Card>
        )}
        {weekGames.map((g) => {
          const lock = locked(g);
          const before = saved.find((s) => s.id === g.id);
          const willClear = before ? editClearsResult(before, g) : false;
          const changed = !before || before.week !== g.week || before.home !== g.home || before.away !== g.away;
          return (
            <div
              key={g.key}
              className={`grid items-center gap-2 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] ${
                willClear ? "border-red-500/50 bg-red-500/5" : changed ? "border-amber-400/60 bg-amber-400/5" : ""
              }`}
            >
              <TeamPick value={g.home} disabled={lock} teams={teams} busy={busy} self={g.away} onChange={(v) => patch(g.key, { home: v })} />
              <button
                onClick={() => patch(g.key, { home: g.away, away: g.home })}
                className="justify-self-center rounded-md border px-2 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"
                title="Swap home and away"
              >
                vs <ArrowLeftRight size={12} className="ml-0.5 inline" />
              </button>
              <TeamPick value={g.away} disabled={lock} teams={teams} busy={busy} self={g.home} onChange={(v) => patch(g.key, { away: v })} />
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <select value={g.week} onChange={(e) => patch(g.key, { week: Number(e.target.value) })} className={select} title="Move to another week">
                  {weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
                </select>
                {g.result && (
                  lock ? (
                    <button onClick={() => unlock(g)} className="flex items-center gap-1 rounded-md border border-green-500/40 px-2 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/10" title="Played: unlock to change the teams">
                      <Lock size={12} /> {g.result}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 rounded-md border border-amber-400/50 px-2 py-1.5 text-xs font-semibold text-amber-300" title="Unlocked">
                      <Unlock size={12} /> {g.result}
                    </span>
                  )
                )}
                <button onClick={() => removeGame(g)} className="rounded-md border p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-400" aria-label="Delete game" title="Delete game">
                  <Trash2 size={14} />
                </button>
              </div>
              {willClear && <p className="text-xs text-red-300 md:col-span-4">Saving removes this game&apos;s result ({g.result}) and its replay stats.</p>}
            </div>
          );
        })}
      </div>

      {off.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <Moon size={14} /> Off this week:
          {off.map((t) => <span key={t.id} className="rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground">{t.teamName}</span>)}
        </div>
      )}

      {/* ── Problems ── */}
      {(errors.length > 0 || warnings.length > 0) && (
        <Card className="space-y-2 p-4 text-sm">
          {errors.map((e) => (
            <p key={e} className="flex items-start gap-2 text-red-400"><X size={14} className="mt-0.5 shrink-0" /> {e}</p>
          ))}
          {ordered(newWarnings).map(warningLine)}
          {oldWarnings.length > 0 && (
            <div>
              <button onClick={() => setShowOld((v) => !v)} className="text-xs text-muted-foreground underline hover:text-foreground">
                {showOld ? "Hide" : "Show"} {oldWarnings.length} note{oldWarnings.length === 1 ? "" : "s"} the schedule already had (like repeat matchups)
              </button>
              {showOld && <div className="mt-2 space-y-2 opacity-80">{ordered(oldWarnings).map(warningLine)}</div>}
            </div>
          )}
          {errors.length === 0 && newWarnings.length > 0 && <p className="text-xs text-muted-foreground">Warnings don&apos;t stop you saving.</p>}
        </Card>
      )}

      {/* ── Save bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <p className="text-sm font-semibold">
            {changeCount ? `${changeCount} change${changeCount === 1 ? "" : "s"}` : "No changes yet"}
            {lostResults.length > 0 && <span className="font-normal text-red-300"> · removes {lostResults.length} result{lostResults.length === 1 ? "" : "s"}</span>}
            {errors.length > 0 && <span className="font-normal text-red-400"> · fix the errors to save</span>}
          </p>
          {message && <p className={`text-sm ${message.tone === "error" ? "text-red-400" : "text-green-400"}`}>{message.text}</p>}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={discard} disabled={isPending}>{changeCount ? "Discard" : "Done"}</Button>
            <Button onClick={save} disabled={isPending || !plan || changeCount === 0}>{isPending ? "Saving…" : "Save schedule"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Rough change count while there are errors (the exact plan needs a valid schedule). */
function countRough(saved: SavedGame[], games: Draft[]) {
  const byId = new Map(saved.map((g) => [g.id, g]));
  let n = 0;
  for (const g of games) {
    const b = g.id ? byId.get(g.id) : undefined;
    if (!b || b.week !== g.week || b.home !== g.home || b.away !== g.away) n++;
  }
  return n + saved.filter((s) => !games.some((g) => g.id === s.id)).length;
}

function TeamPick({
  value, disabled, teams, busy, self, onChange,
}: {
  value: string;
  disabled: boolean;
  teams: Team[];
  /** Teams already playing this week */
  busy: Set<string>;
  /** The other side of this game */
  self: string;
  onChange: (id: string) => void;
}) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${select} w-full font-semibold`}>
      {!value && <option value="">Pick a team…</option>}
      {teams.map((t) => (
        <option key={t.id} value={t.id} disabled={t.id === self}>
          {t.teamName}{t.id !== value && busy.has(t.id) ? " (playing this week)" : ""}
        </option>
      ))}
    </select>
  );
}
