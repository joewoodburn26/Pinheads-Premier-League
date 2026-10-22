"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { reorderTeams } from "@/lib/roster-order-actions";
import { initials } from "@/lib/utils";
import type { Team } from "@/lib/types";

export function DraftOrderCards({ teams, onReorder, locked = false }: {
  teams: Team[];
  onReorder: (newOrder: Team[]) => void;
  /** Only admins can change the draft order */
  locked?: boolean;
}) {
  const [error, setError] = useState("");
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

    const previous = teams;
    setError("");
    startTransition(async () => {
      try {
        const result = await reorderTeams(newTeams.map(t => t.id));
        if (!result.ok) {
          onReorder(previous);
          setError("error" in result && result.error ? result.error : "Couldn't save the draft order.");
        }
      } catch {
        onReorder(previous);
        setError("Couldn't save the draft order. Try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {locked ? "Draft order" : "⠿ Drag to set draft order — roster sections below will reorder to match"}
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {teams.map((team, idx) => (
          <div
            key={team.id}
            draggable={!locked}
            onDragStart={locked ? undefined : (e) => { e.dataTransfer.setData("text/plain", String(idx)); handleDragStart(idx); }}
            onDragOver={locked ? undefined : e => handleDragOver(e, idx)}
            onDragEnd={locked ? undefined : handleDragEnd}
            onDrop={locked ? undefined : (e) => { e.preventDefault(); handleDrop(idx); }}
            className={`flex items-center gap-2 rounded-lg border bg-card px-3 py-2 select-none transition-all ${locked ? "" : "cursor-grab active:cursor-grabbing"}
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
            {!locked && <span className="text-xs text-muted-foreground select-none ml-1">⠿</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
