"use client";

import { useState } from "react";
import { DraftOrderCards } from "@/components/draft-order-cards";
import { TeamRosterEditor } from "@/components/team-roster-editor";
import type { Team, TeamPokemon, Pokemon } from "@/lib/types";

interface RosterData {
  team: Team;
  slots: (TeamPokemon & { pokemon?: Pokemon })[];
}

export function RostersClient({
  initialRosters, seasonId, allPokemon,
}: {
  initialRosters: RosterData[];
  seasonId: string;
  allPokemon: Pokemon[];
}) {
  const [rosters, setRosters] = useState(initialRosters);

  function handleReorder(newTeamOrder: Team[]) {
    // Re-sort rosters to match the new team order
    const reordered = newTeamOrder.map(team =>
      rosters.find(r => r.team.id === team.id)!
    );
    setRosters(reordered);
  }

  return (
    <div className="space-y-8">
      <DraftOrderCards teams={rosters.map(r => r.team)} onReorder={handleReorder} />

      {rosters.map(({ team, slots }) => (
        <section key={team.id} className="space-y-3">
          <h2 className="text-3xl font-bold">{team.teamName}</h2>
          <TeamRosterEditor
            key={`${team.id}-${slots.map(s => s.id).join("-")}`}
            teamId={team.id}
            seasonId={seasonId}
            slots={slots}
            allPokemon={allPokemon}
          />
        </section>
      ))}
    </div>
  );
}
