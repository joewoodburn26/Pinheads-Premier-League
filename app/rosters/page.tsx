import Image from "next/image";
import { getTeams, getRoster, getActiveSeason } from "@/lib/data";
import { TypeBadge } from "@/components/type-badge";
import { pokemonTypesFor } from "@/lib/type-chart";
import type { Pokemon } from "@/lib/types";

// ─── Small inline Pokémon cell ──────────────────────────────────────────────

function PokemonSlot({ pokemon }: { pokemon: Pokemon }) {
  const types = pokemonTypesFor(pokemon);
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border bg-card p-2 text-center">
      <Image
        src={pokemon.spriteUrl}
        alt={pokemon.name}
        width={64}
        height={64}
        className="size-14 object-contain"
      />
      <p className="text-xs font-semibold leading-tight">{pokemon.name}</p>
      <div className="flex flex-wrap justify-center gap-0.5">
        {types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{pokemon.pointValue} pts</p>
    </div>
  );
}

function EmptySlot() {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center rounded-lg border border-dashed bg-muted/40 text-xs text-muted-foreground">
      Empty
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function RostersPage() {
  const season = await getActiveSeason();
  const teams = await getTeams(season.id);

  // Fetch all rosters in parallel
  const rostersRaw = await Promise.all(teams.map((team) => getRoster(team.id)));

  const rosters = teams.map((team, i) => ({
    team,
    slots: rostersRaw[i],
  }));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-black">Rosters</h1>
        <p className="mt-1 text-muted-foreground">{season.name} · all team rosters</p>
      </div>

      {rosters.map(({ team, slots }) => {
        // Pad to 10 slots so the grid is always full
        const padded = Array.from({ length: 10 }, (_, i) => slots[i] ?? null);

        return (
          <section key={team.id} className="space-y-3">
            <h2 className="text-2xl font-bold">{team.teamName}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">
              {padded.map((slot, idx) =>
                slot?.pokemon ? (
                  <PokemonSlot key={slot.id} pokemon={slot.pokemon} />
                ) : (
                  <EmptySlot key={`empty-${idx}`} />
                )
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
