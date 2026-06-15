"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { reorderTeams } from "@/lib/roster-order-actions";
import { initials } from "@/lib/utils";
import type { Team } from "@/lib/types";

export function DraftOrderCards({ teams, onReorder }: {
  teams: Team[];
  onReorder: (newOrder: Team[]) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleDrop(dropIndex: number) {
    const dragIndex = dragIndexRef.current;
    setDragOverIndex(null);
    dragIndexRef.current = null;
    if (dragIndex === null || dragIndex === dropIndex) return;

    const newTeams = [...teams];
    const [dragged] = newTeams.splice(dragIndex, 1);
    newTeams.splice(dropIndex, 0, dragged);

    onReorder(newTeams);

    startTransition(async () => {
      await reorderTeams(newTeams.map(t => t.id));
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">⠿ Drag to set draft order — roster sections below will reorder to match</p>
      <div className="flex flex-wrap gap-2">
        {teams.map((team, idx) => (
          <div
            key={team.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            onDrop={() => handleDrop(idx)}
            className={`flex items-center gap-2 rounded-lg border bg-card px-3 py-2 cursor-grab active:cursor-grabbing select-none transition-all
              ${dragOverIndex === idx ? "border-primary border-2 bg-primary/10 scale-105" : "hover:border-primary/40"}
              ${isPending ? "opacity-60" : ""}
            `}
          >
            <span className="text-xs font-black text-muted-foreground w-5 text-center shrink-0">{idx + 1}</span>
            <div className="grid size-9 place-items-center rounded-md border bg-muted text-xs font-black shrink-0 overflow-hidden">
              {team.logoUrl
                ? <Image src={`${team.logoUrl}?v=${Date.now()}`} alt="" width={36} height={36} className="size-9 object-cover" unoptimized />
                : initials(team.teamName)
              }
            </div>
            <span className="text-sm font-semibold whitespace-nowrap">{team.teamName}</span>
            <span className="text-xs text-muted-foreground select-none ml-1">⠿</span>
          </div>
        ))}
      </div>
    </div>
  );
}
