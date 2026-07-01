"use client";

import Image from "next/image";
import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import type { Pokemon, TeamPokemon } from "@/lib/types";
import { TypeBadge } from "@/components/type-badge";
import { pokemonTypesFor } from "@/lib/type-chart";
import { removeFromRoster, replaceInRoster, addToRoster, reorderRoster } from "@/lib/roster-actions";

// ── Pokémon Selector Modal ────────────────────────────────────────────────────

function PokemonSelectorModal({
  allPokemon, onSelect, onClose,
}: {
  allPokemon: Pokemon[];
  onSelect: (pokemon: Pokemon) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allPokemon;
    return allPokemon.filter((p) => p.name.toLowerCase().includes(q));
  }, [query, allPokemon]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-xl border bg-card shadow-xl" style={{ maxHeight: "80vh" }}>
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-2xl font-black">Select a Pokémon</h3>
          <button onClick={onClose} className="rounded-md px-3 py-1 text-sm hover:bg-muted">✕ Cancel</button>
        </div>
        <div className="border-b p-3">
          <input autoFocus type="text" placeholder="Search by name…" value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="overflow-y-auto p-2">
          {filtered.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No Pokémon found.</p>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.map((p) => {
              const types = pokemonTypesFor(p);
              return (
                <button key={p.id} onClick={() => onSelect(p)}
                  className="flex items-center gap-2 rounded-lg border bg-background p-2 text-left hover:bg-muted transition-colors">
                  <Image src={p.spriteUrl} alt={p.name} width={48} height={48} className="size-10 shrink-0 object-contain" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <div className="flex flex-wrap gap-0.5 mt-0.5">{types.map((t) => <TypeBadge key={t} type={t} />)}</div>
                    <p className="text-xs text-muted-foreground">{p.pointValue} pts</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Single Pokémon slot cell ──────────────────────────────────────────────────

function PokemonSlotCell({
  slot, allPokemon, isDragOver, onDragStart, onDragOver, onDragEnd, onDrop,
}: {
  slot: TeamPokemon & { pokemon?: Pokemon };
  allPokemon: Pokemon[];
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showSelector, setShowSelector] = useState(false);
  const pokemon = slot.pokemon;

  function handleRemove() {
    if (!confirm(`Remove ${pokemon?.name ?? "this Pokémon"} from the roster?`)) return;
    startTransition(async () => { await removeFromRoster(slot.id); });
  }

  function handleReplace(selected: Pokemon) {
    setShowSelector(false);
    startTransition(async () => { await replaceInRoster(slot.id, selected.id); });
  }

  if (!pokemon) return null;
  const types = pokemonTypesFor(pokemon);

  return (
    <>
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDrop={onDrop}
        className={`relative flex flex-col items-center gap-1 rounded-lg border bg-card p-3 text-center h-full transition-all cursor-grab active:cursor-grabbing select-none
          ${isPending ? "opacity-50" : ""}
          ${isDragOver ? "border-primary border-2 bg-primary/10 scale-105" : "hover:border-primary/40"}
        `}
      >
        <div className="absolute top-1 left-1 text-muted-foreground/40 text-xs select-none">⠿</div>
        <div className="absolute top-1 right-1 flex gap-1">
          <button onClick={() => setShowSelector(true)} title="Replace Pokémon"
            className="rounded bg-muted px-1.5 py-0.5 text-xs hover:bg-primary hover:text-primary-foreground transition-colors">↔</button>
          <button onClick={handleRemove} title="Remove Pokémon"
            className="rounded bg-muted px-1.5 py-0.5 text-xs hover:bg-destructive hover:text-destructive-foreground transition-colors">✕</button>
        </div>
        <Image src={pokemon.spriteUrl} alt={pokemon.name} width={96} height={96} className="size-20 object-contain mt-2" />
        <p className="text-sm font-semibold leading-tight">{pokemon.name}</p>
        <div className="flex flex-wrap justify-center gap-0.5">
          {types.map((t) => <TypeBadge key={t} type={t} />)}
        </div>
        <p className="mt-auto pt-2 text-lg font-black text-foreground">{pokemon.pointValue} pts</p>
      </div>
      {showSelector && (
        <PokemonSelectorModal allPokemon={allPokemon} onSelect={handleReplace} onClose={() => setShowSelector(false)} />
      )}
    </>
  );
}

// ── Empty slot cell ───────────────────────────────────────────────────────────

function EmptySlotCell({
  teamId, seasonId, allPokemon, isDragOver, onDragOver, onDrop,
}: {
  teamId: string; seasonId: string; allPokemon: Pokemon[];
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showSelector, setShowSelector] = useState(false);

  function handleAdd(selected: Pokemon) {
    setShowSelector(false);
    startTransition(async () => { await addToRoster(teamId, seasonId, selected.id); });
  }

  return (
    <>
      <div
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed transition-colors
          ${isDragOver ? "border-primary bg-primary/10 border-2 scale-105" : "bg-muted/40"}`}
      >
        <button onClick={() => setShowSelector(true)} disabled={isPending}
          className="flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
          <span className="text-2xl">+</span>
          <span>Add Pokémon</span>
        </button>
      </div>
      {showSelector && (
        <PokemonSelectorModal allPokemon={allPokemon} onSelect={handleAdd} onClose={() => setShowSelector(false)} />
      )}
    </>
  );
}

// ── Team roster editor ────────────────────────────────────────────────────────

export function TeamRosterEditor({
  teamId, seasonId, slots, allPokemon, rosterSize = 10,
}: {
  teamId: string;
  seasonId: string;
  slots: (TeamPokemon & { pokemon?: Pokemon })[];
  allPokemon: Pokemon[];
  rosterSize?: number;
}) {
  // Sync local slots with incoming prop whenever server data refreshes
  const [localSlots, setLocalSlots] = useState(slots);
  const [isPending, startTransition] = useTransition();
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Keep local state in sync with server data after revalidation
  useEffect(() => {
    setLocalSlots(slots);
  }, [slots]);

  const padded = Array.from({ length: rosterSize }, (_, i) => localSlots[i] ?? null);
  const totalPoints = localSlots.reduce((sum, s) => sum + (s.pokemon?.pointValue ?? 0), 0);

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
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newSlots = [...localSlots];
    const draggedSlot = newSlots[dragIndex];
    if (draggedSlot) {
      newSlots.splice(dragIndex, 1);
      newSlots.splice(dropIndex, 0, draggedSlot);
      setLocalSlots(newSlots);
    }

    setDragOverIndex(null);
    dragIndexRef.current = null;

    const orderedIds = newSlots
      .filter((s): s is TeamPokemon & { pokemon?: Pokemon } => s !== null)
      .map((s) => s.id);

    startTransition(async () => {
      await reorderRoster(orderedIds);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">⠿ Drag cards to reorder</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
        {padded.map((slot, idx) =>
          slot ? (
            <PokemonSlotCell
              key={slot.id}
              slot={slot}
              allPokemon={allPokemon}
              isDragOver={dragOverIndex === idx}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(idx)}
            />
          ) : (
            <EmptySlotCell
              key={`empty-${idx}`}
              teamId={teamId}
              seasonId={seasonId}
              allPokemon={allPokemon}
              isDragOver={dragOverIndex === idx}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
            />
          )
        )}
      </div>
      <div className={`flex items-center justify-end gap-3 rounded-lg border px-4 py-2 transition-colors ${isPending ? "bg-muted/20" : "bg-muted/40"}`}>
        {isPending && <span className="text-xs text-muted-foreground">Saving…</span>}
        <span className="text-sm text-muted-foreground">Total Points Used:</span>
        <span className={`text-2xl font-black ${totalPoints > 105 ? "text-red-500" : "text-foreground"}`}>
          {totalPoints}
          <span className="ml-1 text-base font-normal text-muted-foreground">/ 105</span>
        </span>
      </div>
    </div>
  );
}
