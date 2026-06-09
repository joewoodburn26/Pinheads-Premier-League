"use client";

import { useState, useTransition } from "react";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addTeam, deleteTeam } from "@/lib/settings-actions";
import type { Season, Team } from "@/lib/types";

function DeleteWarning({
  team,
  onConfirm,
  onCancel,
  isPending,
}: {
  team: Team;
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
          You are about to permanently delete <span className="font-bold text-foreground">{team.teamName}</span> and all associated data including:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Team page and all info</li>
          <li>Entire roster (all Pokémon slots)</li>
          <li>All schedule matches involving this team</li>
          <li>All stats records for this team</li>
          <li>Coach record</li>
        </ul>
        <p className="text-sm font-semibold text-destructive">This cannot be undone.</p>
        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onCancel}
            disabled={isPending}
          >
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

export function TeamManagementClient({
  season,
  teams,
}: {
  season: Season;
  teams: Team[];
}) {
  const [newTeamName, setNewTeamName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Team | null>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function handleAdd() {
    if (!newTeamName.trim()) return;
    const fd = new FormData();
    fd.set("teamName", newTeamName.trim());
    fd.set("seasonId", season.id);
    startTransition(async () => {
      const result = await addTeam(fd);
      if (result.ok) {
        setNewTeamName("");
        setMessage("✓ Team added");
      } else {
        setMessage(`✗ ${result.error ?? "Failed"}`);
      }
      setTimeout(() => setMessage(""), 3000);
    });
  }

  function handleDeleteConfirm() {
    if (!confirmDelete) return;
    const fd = new FormData();
    fd.set("teamId", confirmDelete.id);
    startTransition(async () => {
      await deleteTeam(fd);
      setConfirmDelete(null);
      setMessage("✓ Team deleted");
      setTimeout(() => setMessage(""), 3000);
    });
  }

  return (
    <div className="space-y-6">
      {confirmDelete && (
        <DeleteWarning
          team={confirmDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
          isPending={isPending}
        />
      )}

      <div>
        <h1 className="text-4xl font-black">Team Management</h1>
        <p className="mt-1 text-muted-foreground">
          {season.name} · {teams.length} team{teams.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Add team */}
      <Card className="p-4 space-y-3">
        <h2 className="text-lg font-bold">Add New Team</h2>
        <div className="flex gap-3">
          <Input
            placeholder="Team name (e.g. Canton Charizards)"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={isPending || !newTeamName.trim()}>
            <Plus size={16} className="mr-2" /> Add Team
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Creates a blank team page with 10 empty roster slots. Edit team name, coach, logo and roster from the team page.
        </p>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </Card>

      {/* Team list */}
      <Card className="p-4 space-y-3">
        <h2 className="text-lg font-bold">Current Teams</h2>
        {teams.length === 0 && (
          <p className="text-sm text-muted-foreground">No teams yet. Add one above.</p>
        )}
        <div className="space-y-2">
          {teams.map((team) => (
            <div
              key={team.id}
              className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
            >
              <div>
                <p className="font-semibold">{team.teamName}</p>
                <p className="text-xs text-muted-foreground">
                  Coach: {team.coach?.name ?? "Unassigned"} · {team.wins}W–{team.losses}L
                </p>
              </div>
              <button
                onClick={() => setConfirmDelete(team)}
                className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Delete team"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
