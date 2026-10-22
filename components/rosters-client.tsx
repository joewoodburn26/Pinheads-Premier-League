"use client";

import { useState, useEffect } from "react";
import { DraftOrderCards } from "@/components/draft-order-cards";
import { TeamRosterEditor } from "@/components/team-roster-editor";
import type { Team, TeamPokemon, Pokemon } from "@/lib/types";

interface RosterData {
  team: Team;
  slots: (TeamPokemon & { pokemon?: Pokemon })[];
}

export function RostersClient({
  initialRosters, seasonId, allPokemon, rosterSize = 10, editableTeamIds = [], canReorderTeams = false,
}: {
  initialRosters: RosterData[];
  seasonId: string;
  allPokemon: Pokemon[];
  rosterSize?: number;
  /** Teams the signed-in member may edit (own team, or all for admins) */
  editableTeamIds?: string[];
  /** Draft order is admins only */
  canReorderTeams?: boolean;
}) {
  const [rosters, setRosters] = useState(initialRosters);
  const availablePokemon = allPokemon.filter(p => !p.banned);

  useEffect(() => {
    setRosters(initialRosters);
  }, [initialRosters]);

  function handleReorder(newTeamOrder: Team[]) {
    const reordered = newTeamOrder.map(team =>
      rosters.find(r => r.team.id === team.id)!
    );
    setRosters(reordered);
  }

  return (
    <div className="space-y-8">
      <DraftOrderCards teams={rosters.map(r => r.team)} onReorder={handleReorder} locked={!canReorderTeams} />

      {rosters.map(({ team, slots }) => (
        <section key={team.id} className="space-y-3">
          <h2 className="text-3xl font-bold">{team.teamName}</h2>
          <TeamRosterEditor
            key={`${team.id}-${slots.map(s => s.id).join("-")}`}
            teamId={team.id}
            seasonId={seasonId}
            slots={slots}
            allPokemon={availablePokemon}
            rosterSize={rosterSize}
            readOnly={!editableTeamIds.includes(team.id)}
          />
        </section>
      ))}
    </div>
  );
}
