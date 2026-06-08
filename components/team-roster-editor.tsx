"use client";

import Image from "next/image";
import { useState, useTransition, useMemo } from "react";
import type { Pokemon, TeamPokemon } from "@/lib/types";
import { TypeBadge } from "@/components/type-badge";
import { pokemonTypesFor } from "@/lib/type-chart";
import { removeFromRoster, replaceInRoster, addToRoster } from "@/lib/roster-actions";

// ── Pokémon Selector Modal ────────────────────────────────────────────────────

function PokemonSelectorModal({
  allPokemon,
  onSelect,
  onClose,
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
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-heading text-2xl">Select a Pokémon</h3>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm hover:bg-muted"
          >
            ✕ Cancel
          </button>
        </div>

        {/* Search */}
        <div className="border-b p-3">
          <input
            autoFocus
            type="text"
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Results */}
        <div className="overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">No Pokémon found.</p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.map((p) => {
              const types = pokemonTypesFor(p);
              return (
                <button
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className="flex items-center gap-2 rounded-lg border bg-background p-2 text-left hover:bg-muted transition-colors"
                >
                  <Image
                    src={p.spriteUrl}
                    alt={p.name}
                    width={48}
                    height={48}
                    className="size-10 shrink-0 object-contain"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {types.map((t) => <TypeBadge key={t} type={t} />)}
                    </div>
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
  slot,
  allPokemon,
}: {
  slot: TeamPokemon & { pokemon?: Pokemon };
  allPokemon: Pokemon[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showSelector, setShowSelector] = useState(false);
  const pokemon = slot.pokemon;

  function handleRemove() {
    if (!confirm(`Remove ${pokemon?.name ?? "this Pokémon"} from the roster?`)) return;
    startTransition(async () => {
      await removeFromRoster(slot.id);
    });
  }

  function handleReplace(selected: Pokemon) {
    setShowSelector(false);
    startTransition(async () => {
      await replaceInRoster(slot.id, selected.id);
    });
  }

  if (!pokemon) return null;

  const types = pokemonTypesFor(pokemon);

  return (
    <>
      <div className={`relative flex flex-col items-center gap-1 rounded-lg border bg-card p-3 text-center h-full transition-opacity ${isPending ? "opacity-50" : ""}`}>
        {/* Action buttons */}
        <div className="absolute top-1 right-1 flex gap-1">
          <button
            onClick={() => setShowSelector(true)}
            title="Replace Pokémon"
            className="rounded bg-muted px-1.5 py-0.5 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            ↔
          </button>
          <button
            onClick={handleRemove}
            title="Remove Pokémon"
            className="rounded bg-muted px-1.5 py-0.5 text-xs hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        <Image
          src={pokemon.spriteUrl}
          alt={pokemon.name}
          width={96}
          height={96}
          className="size-20 object-contain"
        />
        <p className="text-sm font-semibold leading-tight">{pokemon.name}</p>
        <div className="flex flex-wrap justify-center gap-0.5">
          {types.map((t) => <TypeBadge key={t} type={t} />)}
        </div>
        <p className="mt-auto pt-2 text-lg font-black text-foreground">
          {pokemon.pointValue} pts
        </p>
      </div>

      {showSelector && (
        <PokemonSelectorModal
          allPokemon={allPokemon}
          onSelect={handleReplace}
          onClose={() => setShowSelector(false)}
        />
      )}
    </>
  );
}

// ── Empty slot cell ───────────────────────────────────────────────────────────

function EmptySlotCell({
  teamId,
  seasonId,
  allPokemon,
}: {
  teamId: string;
  seasonId: string;
  allPokemon: Pokemon[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showSelector, setShowSelector] = useState(false);

  function handleAdd(selected: Pokemon) {
    setShowSelector(false);
    startTransition(async () => {
      await addToRoster(teamId, seasonId, selected.id);
    });
  }

  return (
    <>
      <button
        onClick={() => setShowSelector(true)}
        disabled={isPending}
        className="flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
      >
        <span className="text-2xl">+</span>
        <span>Add Pokémon</span>
      </button>

      {showSelector && (
        <PokemonSelectorModal
          allPokemon={allPokemon}
          onSelect={handleAdd}
          onClose={() => setShowSelector(false)}
        />
      )}
    </>
  );
}

// ── Team roster row ───────────────────────────────────────────────────────────

export function TeamRosterEditor({
  teamId,
  seasonId,
  slots,
  allPokemon,
}: {
  teamId: string;
  seasonId: string;
  slots: (TeamPokemon & { pokemon?: Pokemon })[];
  allPokemon: Pokemon[];
}) {
  const totalPoints = slots.reduce((sum, s) => sum + (s.pokemon?.pointValue ?? 0), 0);
  const padded = Array.from({ length: 10 }, (_, i) => slots[i] ?? null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
        {padded.map((slot, idx) =>
          slot ? (
            <PokemonSlotCell key={slot.id} slot={slot} allPokemon={allPokemon} />
          ) : (
            <EmptySlotCell
              key={`empty-${idx}`}
              teamId={teamId}
              seasonId={seasonId}
              allPokemon={allPokemon}
            />
          )
        )}
      </div>

      {/* Points total */}
      <div className="flex items-center justify-end gap-3 rounded-lg border bg-muted/40 px-4 py-2">
        <span className="text-sm text-muted-foreground">Total Points Used:</span>
        <span className={`font-heading text-2xl font-black ${totalPoints > 105 ? "text-red-500" : "text-foreground"}`}>
          {totalPoints}
          <span className="ml-1 text-base font-normal text-muted-foreground">/ 105</span>
        </span>
      </div>
    </div>
  );
}
