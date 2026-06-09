"use client";

import { useState, useTransition } from "react";
import { Trash2, Star, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createNewSeason,
  setActiveSeason,
  archiveSeason,
  deleteSeason,
} from "@/lib/settings-actions";
import type { Season } from "@/lib/types";

function DeleteWarning({
  season,
  onConfirm,
  onCancel,
  isPending,
}: {
  season: Season;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="w-full max-w-md p-6 space-y-4 border-destructive">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚠️</span>
          <h2 className="text-2xl font-black text-destructive">WARNING</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          You are about to permanently delete <span className="font-bold text-foreground">{season.name}</span> and ALL associated data:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>All teams and rosters</li>
          <li>All schedule matches and results</li>
          <li>All Pokémon stats records</li>
        </ul>
        <p className="text-sm font-semibold text-destructive">This cannot be undone.</p>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Yes, Delete Everything"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function SeasonManagementClient({ seasons }: { seasons: Season[] }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage]        = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Season | null>(null);

  // New season form state
  const [name, setName]             = useState("");
  const [budget, setBudget]         = useState(105);
  const [teamCount, setTeamCount]   = useState(8);
  const [sourceId, setSourceId]     = useState<string>("");
  const [copyNames, setCopyNames]   = useState(true);
  const [copyCoaches, setCopyCoaches] = useState(false);
  const [copyRosters, setCopyRosters] = useState(false);
  const [copyLogos, setCopyLogos]   = useState(false);

  const nonArchived  = seasons.filter((s) => !s.archived);
  const archived     = seasons.filter((s) => s.archived);

  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  function handleCreate() {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("budget", String(budget));
    fd.set("teamCount", String(teamCount));
    fd.set("sourceSeasonId", sourceId);
    fd.set("copyNames",   String(copyNames));
    fd.set("copyCoaches", String(copyCoaches));
    fd.set("copyRosters", String(copyRosters));
    fd.set("copyLogos",   String(copyLogos));
    startTransition(async () => {
      const result = await createNewSeason(fd);
      if (result.ok) {
        setName("");
        flash("✓ Season created");
      } else {
        flash(`✗ ${result.error ?? "Failed"}`);
      }
    });
  }

  function handleSetActive(seasonId: string) {
    const fd = new FormData();
    fd.set("seasonId", seasonId);
    startTransition(async () => {
      await setActiveSeason(fd);
      flash("✓ Active season updated — reload the site to see changes");
    });
  }

  function handleArchive(seasonId: string) {
    const fd = new FormData();
    fd.set("seasonId", seasonId);
    startTransition(async () => {
      await archiveSeason(fd);
      flash("✓ Season archived");
    });
  }

  function handleDeleteConfirm() {
    if (!confirmDelete) return;
    const fd = new FormData();
    fd.set("seasonId", confirmDelete.id);
    startTransition(async () => {
      await deleteSeason(fd);
      setConfirmDelete(null);
      flash("✓ Season deleted");
    });
  }

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      {label}
    </label>
  );

  return (
    <div className="space-y-6">
      {confirmDelete && (
        <DeleteWarning
          season={confirmDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
          isPending={isPending}
        />
      )}

      <div>
        <h1 className="text-4xl font-black">Season Management</h1>
        <p className="mt-1 text-muted-foreground">
          Create new seasons, set the active season, archive old ones, or delete test seasons.
        </p>
      </div>

      {/* Create new season */}
      <Card className="p-5 space-y-4">
        <h2 className="text-lg font-bold">Create New Season</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Season Name</label>
            <Input placeholder="e.g. Season 2027" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Draft Budget</label>
            <Input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Number of Teams</label>
            <Input type="number" min={1} max={16} value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))} />
          </div>
        </div>

        {/* Copy from season */}
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Copy From Season (optional)</label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">— Start completely blank —</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {sourceId && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What to copy:</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Toggle label="Team Names"    checked={copyNames}   onChange={setCopyNames}   />
                <Toggle label="Coaches"       checked={copyCoaches} onChange={setCopyCoaches} />
                <Toggle label="Rosters"       checked={copyRosters} onChange={setCopyRosters} />
                <Toggle label="Logos/Images"  checked={copyLogos}   onChange={setCopyLogos}   />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
            {isPending ? "Creating..." : "Create Season"}
          </Button>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
      </Card>

      {/* Active / current seasons */}
      <Card className="p-4 space-y-3">
        <h2 className="text-lg font-bold">Seasons</h2>
        {nonArchived.length === 0 && <p className="text-sm text-muted-foreground">No seasons yet.</p>}
        <div className="space-y-2">
          {nonArchived.map((s) => (
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
                <button
                  onClick={() => setConfirmDelete(s)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Delete season"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Archived */}
      {archived.length > 0 && (
        <Card className="p-4 space-y-3">
          <h2 className="text-lg font-bold text-muted-foreground">Archived Seasons</h2>
          <div className="space-y-2">
            {archived.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3 opacity-70">
                <p className="font-semibold text-muted-foreground">{s.name}</p>
                <button
                  onClick={() => setConfirmDelete(s)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
