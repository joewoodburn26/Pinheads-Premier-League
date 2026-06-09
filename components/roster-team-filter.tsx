"use client";

import { useRouter, usePathname } from "next/navigation";
import type { Team } from "@/lib/types";

export function RosterTeamFilter({
  allTeams,
  selectedIds,
}: {
  allTeams: Team[];
  selectedIds: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  function toggle(teamId: string) {
    const current = new Set(selectedIds);
    if (current.has(teamId)) {
      current.delete(teamId);
    } else {
      current.add(teamId);
    }
    const ids = [...current];
    if (ids.length === 0 || ids.length === allTeams.length) {
      router.push(pathname); // no filter = show all
    } else {
      router.push(`${pathname}?teams=${ids.join(",")}`);
    }
  }

  function showAll() {
    router.push(pathname);
  }

  const allSelected = selectedIds.length === 0;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Filter Teams
      </p>
      <div className="flex flex-wrap gap-2">
        {/* "All Teams" button */}
        <button
          onClick={showAll}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            allSelected
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80 text-foreground"
          }`}
        >
          All Teams
        </button>

        {/* Individual team buttons */}
        {allTeams.map((team) => {
          const active = selectedIds.includes(team.id);
          return (
            <button
              key={team.id}
              onClick={() => toggle(team.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-foreground"
              }`}
            >
              {team.teamName}
            </button>
          );
        })}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {selectedIds.length} of {allTeams.length} teams
        </p>
      )}
    </div>
  );
}
