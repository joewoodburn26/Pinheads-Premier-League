"use client";

import Image from "next/image";
import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import type { Pokemon, TeamPokemon, PokemonType } from "@/lib/types";
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
  const [query,      setQuery]      = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [minPts,     setMinPts]     = useState("");
  const [maxPts,     setMaxPts]     = useState("");
  const [sortBy,     setSortBy]     = useState<"points" | "name">("points");
  const [sortDir,    setSortDir]    = useState<"desc" | "asc">("desc");

  const types = [
    "Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison",
    "Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"
  ];

  const filtered = useMemo(() => {
    const q    = query.toLowerCase().trim();
    const minP = minPts === "" ? 0 : parseInt(minPts);
    const maxP = maxPts === "" ? Infinity : parseInt(maxPts);
    return [...allPokemon]
      .filter((p) => {
        if (q && !p.name.toLowerCase().includes(q)) return false;
        if (typeFilter && !pokemonTypesFor(p).includes(typeFilter as PokemonType)) return false;
        if (p.pointValue < minP || p.pointValue > maxP) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name") {
          return sortDir === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        }
        return sortDir === "asc"
          ? a.pointValue - b.pointValue
          : b.pointValue - a.pointValue;
      });
  }, [query, typeFilter, minPts, maxPts, sortBy, sortDir, allPokemon]);

  // Group by point value
  const groups = useMemo(() => {
    const map = new Map<number, Pokemon[]>();
    for (const p of filtered) {
      const arr = map.get(p.pointValue) ?? [];
      arr.push(p);
      map.set(p.pointValue, arr);
    }
    const entries = [...map.entries()];
    entries.sort((a, b) => sortDir === "asc" ? a[0] - b[0] : b[0] - a[0]);
    return entries;
  }, [filtered, sortDir]);

  function toggleSort(key: "points" | "name") {
    if (sortBy === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDir(key === "name" ? "asc" : "desc"); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-3xl flex-col rounded-xl border bg-card shadow-xl" style={{ maxHeight: "85vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 shrink-0">
          <h3 className="text-2xl font-black">Select a Pokémon</h3>
          <button onClick={onClose} className="rounded-md px-3 py-1 text-sm hover:bg-muted">✕ Cancel</button>
        </div>

        {/* Filters */}
        <div className="border-b p-3 space-y-2 shrink-0">
          {/* Search + type */}
          <div className="flex gap-2">
            <input autoFocus type="text" placeholder="Search by name…" value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="rounded-md border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">All Types</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Points range + sort */}
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" placeholder="Min pts" value={minPts}
              onChange={e => setMinPts(e.target.value)}
              className="w-24 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <span className="text-muted-foreground text-xs">to</span>
            <input type="number" placeholder="Max pts" value={maxPts}
              onChange={e => setMaxPts(e.target.value)}
              className="w-24 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />

            <div className="ml-auto flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Sort:</span>
              <button onClick={() => toggleSort("points")}
                className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${sortBy === "points" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
                Points {sortBy === "points" ? (sortDir === "desc" ? "↓" : "↑") : ""}
              </button>
              <button onClick={() => toggleSort("name")}
                className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${sortBy === "name" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
                A–Z {sortBy === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </button>
            </div>

            <span className="text-xs text-muted-foreground">{filtered.length} Pokémon</span>
          </div>
        </div>

        {/* Results grouped by point value */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">No Pokémon found.</p>
          )}

          {sortBy === "points" ? (
            // Grouped by point value
            groups.map(([pts, mons]) => (
              <div key={pts}>
                <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-muted/90 backdrop-blur px-4 py-1.5">
                  <span className="text-lg font-black">{pts}</span>
                  <span className="text-xs font-semibold text-muted-foreground">pts</span>
                  <span className="ml-auto text-xs text-muted-foreground">{mons.length} Pokémon</span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
                  {mons.map(p => (
                    <button key={p.id} onClick={() => onSelect(p)}
                      className="flex items-center gap-2 rounded-lg border bg-background p-2 text-left hover:bg-muted hover:border-primary/40 transition-colors">
                      <Image src={p.spriteUrl} alt={p.name} width={48} height={48} className="size-10 shrink-0 object-contain" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <div className="flex flex-wrap gap-0.5 mt-0.5">{pokemonTypesFor(p).map(t => <TypeBadge key={t} type={t} />)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            // Flat list sorted by name
            <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
              {filtered.map(p => (
                <button key={p.id} onClick={() => onSelect(p)}
                  className="flex items-center gap-2 rounded-lg border bg-background p-2 text-left hover:bg-muted hover:border-primary/40 transition-colors">
                  <Image src={p.spriteUrl} alt={p.name} width={48} height={48} className="size-10 shrink-0 object-contain" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <div className="flex flex-wrap gap-0.5 mt-0.5">{pokemonTypesFor(p).map(t => <TypeBadge key={t} type={t} />)}</div>
                    <p className="text-xs text-muted-foreground font-bold">{p.pointValue} pts</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Single Pokémon slot cell ──────────────────────────────────────────────────

function PokemonSlotCell({
  slot, allPokemon, isDragOver, onDragStart, onDragOver, onDragEnd, onDrop, readOnly = false,
}: {
  slot: TeamPokemon & { pokemon?: Pokemon };
  allPokemon: Pokemon[];
  readOnly?: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showSelector, setShowSelector] = useState(false);
  const [error, setError] = useState("");
  const pokemon = slot.pokemon;

  function handleRemove() {
    if (!confirm(`Remove ${pokemon?.name ?? "this Pokémon"} from the roster?`)) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await removeFromRoster(slot.id);
        if (!result.success) setError(result.error ?? "Couldn't remove it.");
      } catch {
        setError("Couldn't remove it. Try again.");
      }
    });
  }

  function handleReplace(selected: Pokemon) {
    setShowSelector(false);
    setError("");
    startTransition(async () => {
      try {
        const result = await replaceInRoster(slot.id, selected.id);
        if (!result.success) setError(result.error ?? "Couldn't replace it.");
      } catch {
        setError("Couldn't replace it. Try again.");
      }
    });
  }

  if (!pokemon) return null;
  const types = pokemonTypesFor(pokemon);

  return (
    <>
      <div
        draggable={!readOnly}
        onDragStart={readOnly ? undefined : onDragStart}
        onDragOver={readOnly ? undefined : onDragOver}
        onDragEnd={readOnly ? undefined : onDragEnd}
        onDrop={readOnly ? undefined : onDrop}
        className={`relative flex flex-col items-center gap-1 rounded-lg border bg-card p-3 text-center h-full transition-all select-none ${readOnly ? "" : "cursor-grab active:cursor-grabbing"}
          ${isPending ? "opacity-50" : ""}
          ${isDragOver ? "border-primary border-2 bg-primary/10 scale-105" : "hover:border-primary/40"}
        `}
      >
        {!readOnly && (
          <>
            <div className="absolute top-1 left-1 text-muted-foreground/40 text-xs select-none">⠿</div>
            <div className="absolute top-1 right-1 flex gap-1">
              <button onClick={() => setShowSelector(true)} title="Replace Pokémon"
                className="rounded bg-muted px-1.5 py-0.5 text-xs hover:bg-primary hover:text-primary-foreground transition-colors">↔</button>
              <button onClick={handleRemove} title="Remove Pokémon"
                className="rounded bg-muted px-1.5 py-0.5 text-xs hover:bg-destructive hover:text-destructive-foreground transition-colors">✕</button>
            </div>
          </>
        )}
        <Image src={pokemon.spriteUrl} alt={pokemon.name} width={96} height={96} draggable={false} className="pointer-events-none size-20 object-contain mt-2" />
        <p className="text-sm font-semibold leading-tight">{pokemon.name}</p>
        <div className="flex flex-wrap justify-center gap-0.5">
          {types.map((t) => <TypeBadge key={t} type={t} />)}
        </div>
        <p className="mt-auto pt-2 text-lg font-black text-foreground">{pokemon.pointValue} pts</p>
        {error && <p className="text-[10px] leading-tight text-red-400">{error}</p>}
      </div>
      {showSelector && (
        <PokemonSelectorModal allPokemon={allPokemon} onSelect={handleReplace} onClose={() => setShowSelector(false)} />
      )}
    </>
  );
}

// ── Empty slot cell ───────────────────────────────────────────────────────────

function EmptySlotCell({
  teamId, seasonId, allPokemon, isDragOver, onDragOver, onDrop, readOnly = false,
}: {
  teamId: string; seasonId: string; allPokemon: Pokemon[];
  readOnly?: boolean;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showSelector, setShowSelector] = useState(false);

  const [error, setError] = useState("");

  function handleAdd(selected: Pokemon) {
    setShowSelector(false);
    setError("");
    startTransition(async () => {
      try {
        const result = await addToRoster(teamId, seasonId, selected.id);
        if (!result.success) setError(result.error ?? "Couldn't add it.");
      } catch {
        setError("Couldn't add it. Try again.");
      }
    });
  }

  if (readOnly) {
    return (
      <div className="flex h-full min-h-[180px] w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 text-xs text-muted-foreground">
        Empty slot
      </div>
    );
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
          {error && <span className="px-2 text-[10px] leading-tight text-red-400">{error}</span>}
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
  teamId, seasonId, slots, allPokemon, rosterSize = 10, readOnly = false,
}: {
  teamId: string;
  seasonId: string;
  slots: (TeamPokemon & { pokemon?: Pokemon })[];
  allPokemon: Pokemon[];
  rosterSize?: number;
  /** View-only for members who can't edit this team */
  readOnly?: boolean;
}) {
  // Sync local slots with incoming prop whenever server data refreshes
  const [localSlots, setLocalSlots] = useState(slots);
  const [isPending, startTransition] = useTransition();
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [orderError, setOrderError] = useState("");

  // Keep local state in sync with server data after revalidation
  useEffect(() => {
    setLocalSlots(slots);
  }, [slots]);

  const padded = Array.from({ length: rosterSize }, (_, i) => localSlots[i] ?? null);
  const totalPoints = localSlots.reduce((sum, s) => sum + (s.pokemon?.pointValue ?? 0), 0);

  function handleDragStart(e: React.DragEvent, index: number) {
    dragIndexRef.current = index;
    // Firefox won't start a drag unless some data is set
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    if (dragIndexRef.current === null) return; // ignore drags from elsewhere (other teams, files)
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) setDragOverIndex(index);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const previous = localSlots;
    const newSlots = [...localSlots];
    const draggedSlot = newSlots[dragIndex];
    if (!draggedSlot) {
      setDragOverIndex(null);
      dragIndexRef.current = null;
      return;
    }
    newSlots.splice(dragIndex, 1);
    // Dropping on an empty slot moves the card to the end of the filled slots
    newSlots.splice(Math.min(dropIndex, newSlots.length), 0, draggedSlot);
    setLocalSlots(newSlots);
    setOrderError("");

    setDragOverIndex(null);
    dragIndexRef.current = null;

    const orderedIds = newSlots
      .filter((s): s is TeamPokemon & { pokemon?: Pokemon } => s !== null)
      .map((s) => s.id);

    startTransition(async () => {
      try {
        const result = await reorderRoster(orderedIds);
        if (!result.success) {
          setLocalSlots(previous);
          setOrderError(`Couldn't save the new order: ${"error" in result ? result.error : "unknown error"}`);
        }
      } catch {
        setLocalSlots(previous);
        setOrderError("Couldn't save the new order. Try again.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {!readOnly && <p className="text-xs text-muted-foreground">⠿ Drag cards to reorder</p>}
      {orderError && <p className="text-xs text-red-400">{orderError}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
        {padded.map((slot, idx) =>
          slot ? (
            <PokemonSlotCell
              key={slot.id}
              slot={slot}
              allPokemon={allPokemon}
              readOnly={readOnly}
              isDragOver={dragOverIndex === idx}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, idx)}
            />
          ) : (
            <EmptySlotCell
              key={`empty-${idx}`}
              teamId={teamId}
              seasonId={seasonId}
              allPokemon={allPokemon}
              readOnly={readOnly}
              isDragOver={dragOverIndex === idx}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
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
