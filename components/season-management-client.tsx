"use client";

import { useState, useTransition } from "react";
import { Trash2, Star, Archive, Plus, Minus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createNewSeason, setActiveSeason, archiveSeason,
  deleteSeason, applyTeamChanges, regenerateSchedule,
  updateRosterSize,
} from "@/lib/settings-actions";
import type { Season, Team } from "@/lib/types";

// ─── Delete warning modal ─────────────────────────────────────────────────────

function DeleteWarning({ label, items, onConfirm, onCancel, isPending }: {
  label: string; items: string[];
  onConfirm: () => void; onCancel: () => void; isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="w-full max-w-md p-6 space-y-4 border-destructive">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚠️</span>
          <h2 className="text-2xl font-black text-destructive">WARNING</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          You are about to permanently delete <span className="font-bold text-foreground">{label}</span> including:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          {items.map(item => <li key={item}>{item}</li>)}
        </ul>
        <p className="text-sm font-semibold text-destructive">This cannot be undone.</p>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm} disabled={isPending}>
            {isPending ? "Deleting…" : "Yes, Delete Everything"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <div onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}>
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      {label}
    </label>
  );
}

// ─── Roster size editor ────────────────────────────────────────────────────────

function RosterSizeEditor({ season }: { season: Season }) {
  const [isPending, startTransition] = useTransition();
  const [size,    setSize]    = useState(season.rosterSize ?? 10);
  const [confirm, setConfirm] = useState(false);
  const [saved,   setSaved]   = useState(false);

  function handleSave() {
    startTransition(async () => {
      await updateRosterSize(season.id, size);
      setSaved(true);
      setConfirm(false);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Roster Size</p>
          <p className="text-xs text-muted-foreground">Max Pokémon per team. Reducing will remove Pokémon over the limit.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setSize(s => Math.max(1, s - 1)); setConfirm(false); }}
            className="rounded-md border bg-muted px-2 py-1.5 hover:bg-muted/80"><Minus size={14} /></button>
          <span className="text-xl font-black w-8 text-center">{size}</span>
          <button onClick={() => { setSize(s => Math.min(20, s + 1)); setConfirm(false); }}
            className="rounded-md border bg-muted px-2 py-1.5 hover:bg-muted/80"><Plus size={14} /></button>
        </div>
      </div>
      {size !== (season.rosterSize ?? 10) && (
        <div className="space-y-2">
          {size < (season.rosterSize ?? 10) && !confirm && (
            <p className="text-xs text-yellow-400">
              ⚠️ Reducing from {season.rosterSize} to {size} will permanently remove Pokémon in slots {size + 1} to {season.rosterSize} for every team.
            </p>
          )}
          <div className="flex gap-2">
            {size < (season.rosterSize ?? 10) && !confirm ? (
              <Button onClick={() => setConfirm(true)} variant="secondary">I understand — show confirm</Button>
            ) : (
              <Button onClick={handleSave} disabled={isPending}
                className={size < (season.rosterSize ?? 10) ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}>
                {isPending ? "Saving…" : `Save Roster Size (${size})`}
              </Button>
            )}
            <Button variant="secondary" onClick={() => { setSize(season.rosterSize ?? 10); setConfirm(false); }}>Reset</Button>
          </div>
          {saved && <p className="text-xs text-green-400">✓ Roster size updated</p>}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function SeasonManagementClient({ seasons, teams }: { seasons: Season[]; teams: Team[] }) {
  const [isPending, startTransition] = useTransition();
  const [message,   setMessage]      = useState("");
  const [confirmDeleteSeason, setConfirmDeleteSeason] = useState<Season | null>(null);

  // New season form
  const [name,        setName]       = useState("");
  const [budget,      setBudget]     = useState(105);
  const [teamCount,   setTeamCount]  = useState(8);
  const [rosterSize,  setRosterSize] = useState(10);
  const [sourceId,    setSourceId]   = useState("");
  const [copyNames,   setCopyNames]  = useState(true);
  const [copyCoaches, setCopyCoaches]= useState(false);
  const [copyRosters, setCopyRosters]= useState(false);
  const [copyLogos,   setCopyLogos]  = useState(false);

  // Team management pending changes
  const [teamsToAdd,    setTeamsToAdd]    = useState<string[]>([]);
  const [teamsToRemove, setTeamsToRemove] = useState<string[]>([]);
  const [newTeamName,   setNewTeamName]   = useState("");
  const [showConfirm,   setShowConfirm]   = useState(false);

  const activeSeason  = seasons.find(s => s.activeSeason);
  const nonArchived   = seasons.filter(s => !s.archived);
  const archived      = seasons.filter(s => s.archived);
  const hasChanges    = teamsToAdd.length > 0 || teamsToRemove.length > 0;

  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  function handleCreate() {
    if (!name.trim()) return;
    if (teamCount < 4 || teamCount > 12) { flash("Team count must be between 4 and 12"); return; }
    const fd = new FormData();
    fd.set("name",           name.trim());
    fd.set("budget",         String(budget));
    fd.set("teamCount",      String(teamCount));
    fd.set("rosterSize",     String(rosterSize));
    fd.set("sourceSeasonId", sourceId);
    fd.set("copyNames",      String(copyNames));
    fd.set("copyCoaches",    String(copyCoaches));
    fd.set("copyRosters",    String(copyRosters));
    fd.set("copyLogos",      String(copyLogos));
    startTransition(async () => {
      const result = await createNewSeason(fd);
      if (result.ok) { setName(""); flash(`✓ Season created with ${teamCount} teams and auto-generated schedule`); }
      else flash(`✗ ${result.error ?? "Failed"}`);
    });
  }

  function handleSetActive(seasonId: string) {
    const fd = new FormData();
    fd.set("seasonId", seasonId);
    startTransition(async () => { await setActiveSeason(fd); flash("✓ Active season updated"); });
  }

  function handleArchive(seasonId: string) {
    const fd = new FormData();
    fd.set("seasonId", seasonId);
    startTransition(async () => { await archiveSeason(fd); flash("✓ Archived"); });
  }

  function handleDeleteSeason() {
    if (!confirmDeleteSeason) return;
    const fd = new FormData();
    fd.set("seasonId", confirmDeleteSeason.id);
    startTransition(async () => {
      await deleteSeason(fd);
      setConfirmDeleteSeason(null);
      flash("✓ Season deleted");
    });
  }

  function queueAdd() {
    if (!newTeamName.trim()) return;
    setTeamsToAdd(prev => [...prev, newTeamName.trim()]);
    setNewTeamName("");
  }

  function queueRemove(teamId: string) {
    setTeamsToRemove(prev => prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]);
  }

  function handleConfirmChanges() {
    if (!activeSeason) return;
    const fd = new FormData();
    fd.set("seasonId", activeSeason.id);
    fd.set("toAdd",    JSON.stringify(teamsToAdd));
    fd.set("toRemove", JSON.stringify(teamsToRemove));
    startTransition(async () => {
      const result = await applyTeamChanges(fd);
      if (result.ok) {
        setTeamsToAdd([]);
        setTeamsToRemove([]);
        setShowConfirm(false);
        flash("✓ Changes applied and schedule regenerated");
      } else flash("✗ Failed to apply changes");
    });
  }

  function handleRegenerateSchedule() {
    if (!activeSeason) return;
    startTransition(async () => {
      const result = await regenerateSchedule(activeSeason.id);
      if (result.ok) flash("✓ Schedule regenerated with new random matchups");
      else flash(`✗ ${result.error ?? "Failed"}`);
    });
  }

  return (
    <div className="space-y-8">
      {confirmDeleteSeason && (
        <DeleteWarning
          label={confirmDeleteSeason.name}
          items={["All teams and rosters", "All schedule matches and results", "All Pokémon stats records"]}
          onConfirm={handleDeleteSeason}
          onCancel={() => setConfirmDeleteSeason(null)}
          isPending={isPending}
        />
      )}

      {/* Confirm team changes modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-yellow-500/50">
            <h2 className="text-xl font-black">Confirm All Changes</h2>
            <p className="text-sm text-muted-foreground">
              ⚠️ This will regenerate the entire schedule. All existing match results will be lost.
            </p>
            {teamsToAdd.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-green-400 mb-1">Adding:</p>
                {teamsToAdd.map((n, i) => <p key={i} className="text-sm text-muted-foreground pl-3">+ {n}</p>)}
              </div>
            )}
            {teamsToRemove.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-red-400 mb-1">Removing:</p>
                {teamsToRemove.map(id => {
                  const t = teams.find(t => t.id === id);
                  return <p key={id} className="text-sm text-muted-foreground pl-3">− {t?.teamName}</p>;
                })}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowConfirm(false)} disabled={isPending}>Cancel</Button>
              <Button className="flex-1" onClick={handleConfirmChanges} disabled={isPending}>
                {isPending ? "Applying…" : "Confirm & Regenerate Schedule"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div>
        <h1 className="text-4xl font-black">Season Management</h1>
        <p className="mt-1 text-muted-foreground">Create seasons, manage teams, regenerate schedules.</p>
      </div>

      {/* Create new season */}
      <Card className="p-5 space-y-4">
        <h2 className="text-lg font-bold">Create New Season</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Season Name</label>
            <Input placeholder="e.g. Season 2027" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Draft Budget</label>
            <Input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Roster Size <span className="text-muted-foreground/60">(per team)</span>
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => setRosterSize(c => Math.max(1, c - 1))}
                className="rounded-md border bg-muted px-2 py-2 hover:bg-muted/80"><Minus size={14} /></button>
              <Input type="number" min={1} max={20} value={rosterSize}
                onChange={e => setRosterSize(Math.min(20, Math.max(1, Number(e.target.value))))}
                className="text-center font-bold text-lg" />
              <button onClick={() => setRosterSize(c => Math.min(20, c + 1))}
                className="rounded-md border bg-muted px-2 py-2 hover:bg-muted/80"><Plus size={14} /></button>
            </div>
            <p className="text-xs text-muted-foreground">Each team can draft up to {rosterSize} Pokémon</p>
          </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setTeamCount(c => Math.max(4, c - 1))}
                className="rounded-md border bg-muted px-2 py-2 hover:bg-muted/80"><Minus size={14} /></button>
              <Input type="number" min={4} max={12} value={teamCount}
                onChange={e => setTeamCount(Math.min(12, Math.max(4, Number(e.target.value))))}
                className="text-center font-bold text-lg" />
              <button onClick={() => setTeamCount(c => Math.min(12, c + 1))}
                className="rounded-md border bg-muted px-2 py-2 hover:bg-muted/80"><Plus size={14} /></button>
            </div>
            <p className="text-xs text-muted-foreground">
              {teamCount % 2 !== 0 ? "⚠️ Odd count — one team gets a bye each week" : ""}
              {` ${Math.min(teamCount - 1, 8)} week schedule will be generated`}
            </p>
          </div>
        </div>

        {/* Copy from season */}
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Copy From Season (optional)</label>
            <select value={sourceId} onChange={e => setSourceId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">— Start completely blank —</option>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {sourceId && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Toggle label="Team Names"   checked={copyNames}   onChange={setCopyNames}   />
              <Toggle label="Coaches"      checked={copyCoaches} onChange={setCopyCoaches} />
              <Toggle label="Rosters"      checked={copyRosters} onChange={setCopyRosters} />
              <Toggle label="Logos/Images" checked={copyLogos}   onChange={setCopyLogos}   />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
            {isPending ? "Creating…" : "Create Season & Generate Schedule"}
          </Button>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
      </Card>

      {/* Team management for active season */}
      {activeSeason && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Team Management — {activeSeason.name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adding or removing teams will regenerate the full schedule when you confirm.
              </p>
            </div>
            <button onClick={handleRegenerateSchedule} disabled={isPending}
              className="flex items-center gap-1.5 rounded-md border bg-muted px-3 py-2 text-xs font-medium hover:bg-muted/80 transition-colors"
              title="Regenerate schedule with new random matchups">
              <RefreshCw size={13} /> Re-randomize Schedule
            </button>
          </div>

          {/* Roster size editor */}
          <RosterSizeEditor season={activeSeason} />

          {/* Add team */}
          <div className="flex gap-3">
            <Input placeholder="New team name…" value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && queueAdd()}
              className="flex-1" />
            <Button onClick={queueAdd} disabled={!newTeamName.trim()}>
              <Plus size={14} className="mr-1" /> Queue Add
            </Button>
          </div>

          {/* Queued additions */}
          {teamsToAdd.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Queued to Add:</p>
              {teamsToAdd.map((n, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm">
                  <span>+ {n}</span>
                  <button onClick={() => setTeamsToAdd(prev => prev.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Existing teams */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Teams</p>
            {teams.map(team => {
              const markedForRemoval = teamsToRemove.includes(team.id);
              return (
                <div key={team.id}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${markedForRemoval ? "border-red-500/40 bg-red-500/10" : ""}`}>
                  <div>
                    <p className={`font-semibold ${markedForRemoval ? "line-through text-muted-foreground" : ""}`}>{team.teamName}</p>
                    <p className="text-xs text-muted-foreground">{team.coach?.name ?? "Unassigned"} · {team.wins}W–{team.losses}L</p>
                  </div>
                  <button onClick={() => queueRemove(team.id)}
                    className={`rounded-md p-2 transition-colors ${markedForRemoval ? "text-red-400 bg-red-500/20 hover:bg-red-500/30" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Confirm button */}
          {hasChanges && (
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-3">
              <p className="text-sm font-semibold text-yellow-400">
                You have {teamsToAdd.length > 0 ? `${teamsToAdd.length} addition(s)` : ""}
                {teamsToAdd.length > 0 && teamsToRemove.length > 0 ? " and " : ""}
                {teamsToRemove.length > 0 ? `${teamsToRemove.length} removal(s)` : ""} pending.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => { setTeamsToAdd([]); setTeamsToRemove([]); }}>
                  Discard All Changes
                </Button>
                <Button onClick={() => setShowConfirm(true)}>
                  Review & Confirm All Changes
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Seasons list */}
      <Card className="p-4 space-y-3">
        <h2 className="text-lg font-bold">All Seasons</h2>
        {nonArchived.map(s => (
          <div key={s.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${s.activeSeason ? "border-primary bg-primary/5" : ""}`}>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{s.name}</p>
                {s.activeSeason && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">ACTIVE</span>}
              </div>
              <p className="text-xs text-muted-foreground">Budget: {s.draftBudget} pts</p>
            </div>
            <div className="flex gap-2">
              {!s.activeSeason && (
                <Button variant="secondary" onClick={() => handleSetActive(s.id)} disabled={isPending}>
                  <Star size={14} className="mr-1" /> Set Active
                </Button>
              )}
              <Button variant="secondary" onClick={() => handleArchive(s.id)} disabled={isPending || s.activeSeason}>
                <Archive size={14} className="mr-1" /> Archive
              </Button>
              <button onClick={() => setConfirmDeleteSeason(s)}
                className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        {archived.length > 0 && (
          <>
            <p className="text-sm font-semibold text-muted-foreground mt-4">Archived</p>
            {archived.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3 opacity-60">
                <p className="font-semibold text-muted-foreground">{s.name}</p>
                <button onClick={() => setConfirmDeleteSeason(s)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  );
}
