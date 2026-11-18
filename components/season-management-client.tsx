"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive, ArchiveRestore, CalendarDays, ChevronDown, ChevronRight, ExternalLink, Minus, Plus,
  RefreshCw, Settings2, Star, Trash2, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  applyTeamChanges, archiveSeason, createNewSeason, deleteSeason, regenerateSchedule, setActiveSeason,
  updatePlayoffTeams, updateRosterSize, updateSeasonBasics, updateSeasonFormat,
} from "@/lib/settings-actions";
import { setSeasonPointList, splitSeasonPointList } from "@/lib/point-list-actions";
import { FORMAT_OPTIONS, formatName } from "@/lib/formats";
import type { PointList, Season, Team } from "@/lib/types";

type Tab = "settings" | "teams" | "schedule" | "danger";
const TABS: { key: Tab; label: string; icon: typeof Settings2 }[] = [
  { key: "settings", label: "Settings", icon: Settings2 },
  { key: "teams", label: "Teams", icon: Users },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "danger", label: "Danger zone", icon: Trash2 },
];

type Flash = { text: string; tone: "ok" | "error" } | null;

const label = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const select = "w-full rounded-md border bg-background px-3 py-2 text-sm";

// ─── Small pieces ─────────────────────────────────────────────────────────────

function Toggle({ label: text, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
      {text}
    </label>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="rounded-md border bg-muted px-2 py-2 hover:bg-muted/80" aria-label="Less">
        <Minus size={14} />
      </button>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
        className="w-16 text-center text-lg font-bold"
      />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="rounded-md border bg-muted px-2 py-2 hover:bg-muted/80" aria-label="More">
        <Plus size={14} />
      </button>
    </div>
  );
}

/** One setting: title + help on the left, control on the right (stacks on phones). */
function Row({ title, help, children }: { title: string; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 border-b py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-6">
      <div>
        <p className="font-semibold">{title}</p>
        {help && <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Message({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return <p className={`text-sm ${flash.tone === "error" ? "text-red-400" : "text-green-400"}`}>{flash.text}</p>;
}

/** Runs a { error } action, shows the result, refreshes the page. */
function useAction() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [flash, setFlash] = useState<Flash>(null);
  const run = (fn: () => Promise<{ error?: string }>, okText: string, after?: () => void) =>
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.error) return setFlash({ text: r.error, tone: "error" });
        setFlash({ text: okText, tone: "ok" });
        after?.();
        router.refresh();
      } catch {
        setFlash({ text: "Something went wrong. Try again.", tone: "error" });
      }
    });
  return { isPending, flash, setFlash, run };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SeasonManagementClient({
  seasons,
  selected,
  teams,
  pointLists,
  initialTab,
}: {
  seasons: Season[];
  selected?: Season;
  teams: Team[];
  pointLists: PointList[];
  initialTab?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.key === initialTab) ? (initialTab as Tab) : "settings");
  const [creating, setCreating] = useState(seasons.length === 0);
  const [showArchived, setShowArchived] = useState(Boolean(selected?.archived));

  const live = [...seasons.filter((s) => !s.archived)].sort((a, b) => Number(b.activeSeason) - Number(a.activeSeason));
  const archived = seasons.filter((s) => s.archived);
  const listName = (id?: string) => pointLists.find((l) => l.id === id)?.name;

  const go = (seasonId: string, t: Tab = tab) => router.replace(`/settings/seasons?season=${seasonId}&tab=${t}`, { scroll: false });
  const pickTab = (t: Tab) => {
    setTab(t);
    if (selected) go(selected.id, t);
  };

  const seasonPill = (s: Season) => {
    const on = s.id === selected?.id;
    return (
      <button
        key={s.id}
        onClick={() => go(s.id)}
        className={`min-w-[170px] rounded-xl border px-4 py-3 text-left transition-colors ${
          on ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/50"
        } ${s.archived ? "opacity-70" : ""}`}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold">{s.name}</span>
          {s.activeSeason && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">ACTIVE</span>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatName(s.format)} · {s.draftBudget} pts
          {listName(s.pointListId) ? ` · ${listName(s.pointListId)}` : ""}
        </p>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-black max-md:text-3xl">Season Management</h1>
          <p className="mt-1 text-muted-foreground">Pick a season to change its settings, teams and schedule.</p>
        </div>
        <Button onClick={() => setCreating((c) => !c)} variant={creating ? "secondary" : "primary"}>
          {creating ? <><X size={14} className="mr-1" /> Close</> : <><Plus size={14} className="mr-1" /> New season</>}
        </Button>
      </div>

      {creating && <NewSeasonPanel seasons={seasons} pointLists={pointLists} onDone={() => setCreating(false)} />}

      {/* ── Season picker ── */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">{live.map(seasonPill)}</div>
        {archived.length > 0 && (
          <div>
            <button onClick={() => setShowArchived((v) => !v)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Archived ({archived.length})
            </button>
            {showArchived && <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{archived.map(seasonPill)}</div>}
          </div>
        )}
      </div>

      {/* ── Selected season ── */}
      {selected ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black">{selected.name}</h2>
                {selected.activeSeason && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">ACTIVE</span>}
                {selected.archived && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">ARCHIVED</span>}
              </div>
              <p className="text-sm text-muted-foreground">
                {teams.length} teams · {formatName(selected.format)} · {selected.draftBudget} pt budget · {selected.rosterSize ?? 10} Pokémon each
              </p>
            </div>
            {!selected.activeSeason && !selected.archived && <SetActiveButton season={selected} />}
          </div>

          <div className="flex gap-1 overflow-x-auto border-b px-3">
            {TABS.map(({ key, label: text, icon: Icon }) => (
              <button
                key={key}
                onClick={() => pickTab(key)}
                className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  tab === key
                    ? key === "danger" ? "border-red-500 text-red-400" : "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={14} /> {text}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === "settings" && <SettingsTab season={selected} teamCount={teams.length} pointLists={pointLists} />}
            {tab === "teams" && <TeamsTab season={selected} teams={teams} />}
            {tab === "schedule" && <ScheduleTab season={selected} />}
            {tab === "danger" && <DangerTab season={selected} />}
          </div>
        </Card>
      ) : (
        <Card className="p-10 text-center text-muted-foreground">No seasons yet. Create one to get started.</Card>
      )}
    </div>
  );
}

function SetActiveButton({ season }: { season: Season }) {
  const { isPending, flash, run } = useAction();
  return (
    <div className="flex items-center gap-2">
      <Message flash={flash?.tone === "error" ? flash : null} />
      <Button variant="secondary" disabled={isPending} onClick={() => run(() => setActiveSeason(season.id), "Active season updated.")}>
        <Star size={14} className="mr-1" /> Make active
      </Button>
    </div>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({ season, teamCount, pointLists }: { season: Season; teamCount: number; pointLists: PointList[] }) {
  const basics = useAction();
  const roster = useAction();
  const fmt = useAction();
  const points = useAction();
  const playoffs = useAction();

  const [name, setName] = useState(season.name);
  const [budget, setBudget] = useState(season.draftBudget);
  const [size, setSize] = useState(season.rosterSize ?? 10);
  const [format, setFormat] = useState(season.format ?? "all");
  const [listId, setListId] = useState(season.pointListId ?? "");
  const [playoffTeams, setPlayoffTeams] = useState(season.playoffTeams ? String(season.playoffTeams) : "all");

  const oldSize = season.rosterSize ?? 10;
  const shrinking = size < oldSize;
  const list = pointLists.find((l) => l.id === season.pointListId);
  const sharedWith = list?.seasons.filter((s) => s.id !== season.id) ?? [];

  return (
    <div>
      <Row title="Name and budget" help="The draft budget is the most points a team can spend.">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1 space-y-1">
            <span className={label}>Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="w-28 space-y-1">
            <span className={label}>Budget</span>
            <Input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          </div>
          {(name !== season.name || budget !== season.draftBudget) && (
            <Button disabled={basics.isPending} onClick={() => basics.run(() => updateSeasonBasics(season.id, name, budget), "Saved.")}>Save</Button>
          )}
        </div>
        <div className="mt-2"><Message flash={basics.flash} /></div>
      </Row>

      <Row
        title="Point list"
        help={
          <>
            Points and bans for this season. Editing a list changes every season using it.{" "}
            {list && <Link href={`/settings/point-restructure?list=${list.id}`} className="underline hover:text-foreground">Edit {list.name} <ExternalLink size={10} className="inline" /></Link>}
          </>
        }
      >
        {pointLists.length === 0 ? (
          <p className="text-sm text-yellow-400">Run supabase/point-lists.sql in Supabase to set up point lists.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <select value={listId} onChange={(e) => setListId(e.target.value)} className={`${select} min-w-0 flex-1`}>
                {!season.pointListId && <option value="">— Pick a list —</option>}
                {pointLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.seasons.filter((s) => s.id !== season.id).length ? ` (also ${l.seasons.filter((s) => s.id !== season.id).map((s) => s.name).join(", ")})` : ""}
                  </option>
                ))}
              </select>
              {listId && listId !== (season.pointListId ?? "") && (
                <Button disabled={points.isPending} onClick={() => points.run(() => setSeasonPointList(season.id, listId), "Point list switched. Team totals now use it.")}>
                  Switch
                </Button>
              )}
            </div>
            {sharedWith.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Shared with {sharedWith.map((s) => s.name).join(", ")}.</span>
                <button
                  disabled={points.isPending}
                  onClick={() => points.run(() => splitSeasonPointList(season.id), `This season now has its own list: “${season.name} points”.`)}
                  className="underline hover:text-foreground"
                >
                  Give this season its own copy
                </button>
              </div>
            )}
            <Message flash={points.flash} />
          </div>
        )}
      </Row>

      <Row title="Format" help="Which Pokémon and moves are available. Pokémon Champions also limits the draft to Pokémon in Champions.">
        <div className="flex flex-wrap gap-2">
          <select value={format} onChange={(e) => setFormat(e.target.value)} className={`${select} min-w-0 flex-1`}>
            {FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          {format !== (season.format ?? "all") && (
            <Button disabled={fmt.isPending} onClick={() => fmt.run(() => updateSeasonFormat(season.id, format), "Format saved.")}>Save</Button>
          )}
        </div>
        <div className="mt-2"><Message flash={fmt.flash} /></div>
      </Row>

      <Row title="Roster size" help="Most Pokémon per team. Lowering it removes Pokémon over the limit.">
        <div className="flex flex-wrap items-center gap-3">
          <Stepper value={size} min={1} max={20} onChange={setSize} />
          {size !== oldSize && (
            <>
              <Button
                disabled={roster.isPending}
                className={shrinking ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                onClick={() => {
                  if (shrinking && !window.confirm(`Every team loses the Pokémon in slots ${size + 1}–${oldSize}. Continue?`)) return;
                  roster.run(() => updateRosterSize(season.id, size), "Roster size saved.");
                }}
              >
                Save ({size})
              </Button>
              <Button variant="secondary" onClick={() => setSize(oldSize)}>Reset</Button>
            </>
          )}
        </div>
        {shrinking && <p className="mt-2 text-xs text-yellow-400">Pokémon in slots {size + 1}–{oldSize} will be removed from every team.</p>}
        <div className="mt-2"><Message flash={roster.flash} /></div>
      </Row>

      <Row title="Playoff teams" help="If it isn't 2, 4, 8 or 16, the top seeds get a first-round bye. Re-seed the bracket on the Schedule page after changing this.">
        <div className="flex flex-wrap gap-2">
          <select value={playoffTeams} onChange={(e) => setPlayoffTeams(e.target.value)} className={`${select} min-w-0 flex-1`}>
            <option value="all">All teams ({teamCount})</option>
            {Array.from({ length: Math.max(0, teamCount - 2) }, (_, i) => i + 2).map((n) => {
              let bracket = 1;
              while (bracket < n) bracket *= 2;
              return (
                <option key={n} value={String(n)}>
                  Top {n}{bracket !== n ? ` (${bracket - n} bye${bracket - n === 1 ? "" : "s"})` : ""}
                </option>
              );
            })}
          </select>
          {playoffTeams !== (season.playoffTeams ? String(season.playoffTeams) : "all") && (
            <Button
              disabled={playoffs.isPending}
              onClick={() => playoffs.run(() => updatePlayoffTeams(season.id, playoffTeams === "all" ? null : Number(playoffTeams)), "Playoff size saved.")}
            >
              Save
            </Button>
          )}
        </div>
        <div className="mt-2"><Message flash={playoffs.flash} /></div>
      </Row>
    </div>
  );
}

// ─── Teams tab ────────────────────────────────────────────────────────────────

function TeamsTab({ season, teams }: { season: Season; teams: Team[] }) {
  const { isPending, flash, run } = useAction();
  const [toAdd, setToAdd] = useState<string[]>([]);
  const [toRemove, setToRemove] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const pending = toAdd.length + toRemove.length;

  const queueAdd = () => {
    if (!newName.trim()) return;
    setToAdd((p) => [...p, newName.trim()]);
    setNewName("");
  };

  const apply = () => {
    const fd = new FormData();
    fd.set("seasonId", season.id);
    fd.set("toAdd", JSON.stringify(toAdd));
    fd.set("toRemove", JSON.stringify(toRemove));
    run(() => applyTeamChanges(fd), "Teams updated and schedule rebuilt.", () => {
      setToAdd([]);
      setToRemove([]);
      setConfirming(false);
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Adding or removing teams rebuilds this season&apos;s whole schedule when you confirm. Rename teams and coaches on each team&apos;s page.
      </p>

      <div className="flex gap-2">
        <Input placeholder="New team name…" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && queueAdd()} />
        <Button onClick={queueAdd} disabled={!newName.trim()}><Plus size={14} className="mr-1" /> Add</Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {toAdd.map((n, i) => (
          <div key={`add-${i}`} className="flex items-center justify-between rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3">
            <span className="font-semibold text-green-300">+ {n}</span>
            <button onClick={() => setToAdd((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground" aria-label="Undo"><X size={16} /></button>
          </div>
        ))}
        {teams.map((t) => {
          const removing = toRemove.includes(t.id);
          return (
            <div key={t.id} className={`flex items-center justify-between gap-2 rounded-lg border px-4 py-3 ${removing ? "border-red-500/40 bg-red-500/10" : ""}`}>
              <div className="min-w-0">
                <Link href={`/teams/${t.id}`} className={`block truncate font-semibold hover:underline ${removing ? "text-muted-foreground line-through" : ""}`}>{t.teamName}</Link>
                <p className="text-xs text-muted-foreground">{t.coach?.name ?? "No coach"} · {t.wins}W–{t.losses}L</p>
              </div>
              <button
                onClick={() => setToRemove((p) => (p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id]))}
                className={`rounded-md p-2 ${removing ? "bg-red-500/20 text-red-400" : "text-muted-foreground hover:bg-red-500/10 hover:text-red-400"}`}
                aria-label={removing ? "Keep team" : "Remove team"}
                title={removing ? "Keep team" : "Remove team"}
              >
                {removing ? <X size={16} /> : <Trash2 size={16} />}
              </button>
            </div>
          );
        })}
      </div>

      {pending > 0 && (
        <div className="space-y-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
          {!confirming ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-yellow-300">
                {toAdd.length > 0 && `${toAdd.length} to add`}{toAdd.length > 0 && toRemove.length > 0 && " · "}{toRemove.length > 0 && `${toRemove.length} to remove`}
              </p>
              <div className="ml-auto flex gap-2">
                <Button variant="secondary" onClick={() => { setToAdd([]); setToRemove([]); }}>Discard</Button>
                <Button onClick={() => setConfirming(true)}>Review</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold">This rebuilds {season.name}&apos;s schedule. Every match result in it is lost.</p>
              {toRemove.length > 0 && (
                <p className="text-sm text-red-300">Removing {toRemove.map((id) => teams.find((t) => t.id === id)?.teamName).join(", ")} deletes their roster and stats too.</p>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setConfirming(false)} disabled={isPending}>Back</Button>
                <Button onClick={apply} disabled={isPending}>{isPending ? "Applying…" : "Confirm and rebuild schedule"}</Button>
              </div>
            </>
          )}
        </div>
      )}
      <Message flash={flash} />
    </div>
  );
}

// ─── Schedule tab ─────────────────────────────────────────────────────────────

function ScheduleTab({ season }: { season: Season }) {
  const { isPending, flash, run } = useAction();
  const [sure, setSure] = useState(false);
  return (
    <div className="space-y-4">
      <Row title="See the schedule" help="Results, replays and the playoff bracket are managed on the Schedule page.">
        <Link href="/schedule" className="inline-flex items-center gap-1.5 rounded-md border bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80">
          Open Schedule <ExternalLink size={13} />
        </Link>
      </Row>
      <Row title="Re-randomize the schedule" help="New random matchups for every week. All match results in this season are lost.">
        {!sure ? (
          <Button variant="secondary" onClick={() => setSure(true)}><RefreshCw size={14} className="mr-1" /> Re-randomize…</Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-yellow-300">Wipe {season.name}&apos;s results and redraw?</span>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
              onClick={() => run(() => regenerateSchedule(season.id), "Schedule re-randomized.", () => setSure(false))}
            >
              {isPending ? "Working…" : "Yes, re-randomize"}
            </Button>
            <Button variant="secondary" onClick={() => setSure(false)}>Cancel</Button>
          </div>
        )}
        <div className="mt-2"><Message flash={flash} /></div>
      </Row>
    </div>
  );
}

// ─── Danger zone ──────────────────────────────────────────────────────────────

function DangerTab({ season }: { season: Season }) {
  const router = useRouter();
  const { isPending, flash, run } = useAction();
  const [typed, setTyped] = useState("");
  return (
    <div className="space-y-4">
      <Row
        title={season.archived ? "Archived" : "Archive"}
        help={season.archived ? "This season is hidden from the main list." : "Hides the season from the main list. Its teams, results and stats are kept."}
      >
        {season.archived ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><ArchiveRestore size={14} /> Archived seasons can still be viewed and deleted here.</p>
        ) : (
          <Button
            variant="secondary"
            disabled={isPending || season.activeSeason}
            title={season.activeSeason ? "Make another season active first" : undefined}
            onClick={() => run(() => archiveSeason(season.id), "Archived.")}
          >
            <Archive size={14} className="mr-1" /> Archive {season.name}
          </Button>
        )}
        {season.activeSeason && <p className="mt-2 text-xs text-muted-foreground">The active season can&apos;t be archived. Make another season active first.</p>}
      </Row>
      <Row title="Delete" help="Permanently deletes the season with all its teams, rosters, matches and stats. Its point list is kept.">
        <div className="space-y-2">
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Type “${season.name}” to confirm`} />
          <Button
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending || typed.trim() !== season.name}
            onClick={() => run(() => deleteSeason(season.id), "Season deleted.", () => router.replace("/settings/seasons"))}
          >
            <Trash2 size={14} className="mr-1" /> Delete forever
          </Button>
        </div>
      </Row>
      <Message flash={flash} />
    </div>
  );
}

// ─── New season ───────────────────────────────────────────────────────────────

function NewSeasonPanel({ seasons, pointLists, onDone }: { seasons: Season[]; pointLists: PointList[]; onDone: () => void }) {
  const router = useRouter();
  const { isPending, flash, setFlash, run } = useAction();
  const active = seasons.find((s) => s.activeSeason);

  const [name, setName] = useState("");
  const [budget, setBudget] = useState(active?.draftBudget ?? 105);
  const [teamCount, setTeamCount] = useState(8);
  const [rosterSize, setRosterSize] = useState(active?.rosterSize ?? 10);
  const [format, setFormat] = useState(active?.format ?? "all");
  const [sourceId, setSourceId] = useState("");
  const [copyNames, setCopyNames] = useState(true);
  const [copyCoaches, setCopyCoaches] = useState(true);
  const [copyRosters, setCopyRosters] = useState(false);
  const [copyLogos, setCopyLogos] = useState(true);
  const [listId, setListId] = useState(
    pointLists.find((l) => l.name.toLowerCase() === "default")?.id ?? active?.pointListId ?? pointLists[0]?.id ?? "",
  );
  const [ownList, setOwnList] = useState(false);

  const create = () => {
    if (!name.trim()) return setFlash({ text: "Give the season a name.", tone: "error" });
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("budget", String(budget));
    fd.set("teamCount", String(teamCount));
    fd.set("rosterSize", String(rosterSize));
    fd.set("format", format);
    fd.set("sourceSeasonId", sourceId);
    fd.set("copyNames", String(copyNames));
    fd.set("copyCoaches", String(copyCoaches));
    fd.set("copyRosters", String(copyRosters));
    fd.set("copyLogos", String(copyLogos));
    fd.set("pointListId", listId);
    fd.set("ownPointList", String(ownList));
    run(() => createNewSeason(fd), `Created ${name.trim()}.`, () => {
      onDone();
      router.replace("/settings/seasons");
    });
  };

  return (
    <Card className="space-y-5 border-primary/40 p-5">
      <h2 className="text-lg font-bold">New season</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <span className={label}>Name</span>
          <Input autoFocus placeholder="e.g. Season 27/28" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <span className={label}>Format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className={select}>
            {FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <span className={label}>Draft budget</span>
          <Input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <span className={label}>Teams (4–12)</span>
          <Stepper value={teamCount} min={4} max={12} onChange={setTeamCount} />
          <p className="text-xs text-muted-foreground">
            {Math.min(teamCount - 1, 8)}-week schedule{teamCount % 2 ? ", one bye each week" : ""}
          </p>
        </div>
        <div className="space-y-1">
          <span className={label}>Roster size</span>
          <Stepper value={rosterSize} min={1} max={20} onChange={setRosterSize} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="space-y-1">
            <span className={label}>Points</span>
            {pointLists.length === 0 ? (
              <p className="text-sm text-yellow-400">Run supabase/point-lists.sql in Supabase to set up point lists.</p>
            ) : (
              <select value={listId} onChange={(e) => setListId(e.target.value)} className={select}>
                {pointLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
          </div>
          <Toggle label="Give this season its own copy of the list" checked={ownList} onChange={setOwnList} />
          <p className="text-xs text-muted-foreground">
            {ownList
              ? `Creates “${name.trim() || "Season"} points”, a copy you can change without affecting other seasons.`
              : "The season shares the list: edits to it change every season using it."}
          </p>
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="space-y-1">
            <span className={label}>Copy teams from</span>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={select}>
              <option value="">— Start with blank “Team 1, Team 2…” —</option>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {sourceId && (
            <div className="grid grid-cols-2 gap-2">
              <Toggle label="Team names" checked={copyNames} onChange={setCopyNames} />
              <Toggle label="Coaches" checked={copyCoaches} onChange={setCopyCoaches} />
              <Toggle label="Logos" checked={copyLogos} onChange={setCopyLogos} />
              <Toggle label="Rosters" checked={copyRosters} onChange={setCopyRosters} />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={create} disabled={isPending || !name.trim()}>{isPending ? "Creating…" : "Create season and schedule"}</Button>
        <Message flash={flash} />
      </div>
    </Card>
  );
}
