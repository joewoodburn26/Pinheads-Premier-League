import Image from "next/image";
import type { Pokemon } from "@/lib/types";
import { defenseProfile, pokemonTypesFor } from "@/lib/type-chart";
import { TypeBadge } from "@/components/type-badge";
import { Card } from "@/components/ui/card";

export function PokemonCard({ pokemon }: { pokemon: Pokemon }) {
  const types = pokemonTypesFor(pokemon);
  const profile = defenseProfile(types);

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <Image src={pokemon.spriteUrl} alt={pokemon.name} width={90} height={90} className="size-20 object-contain" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">{pokemon.name}</h3>
          <p className="text-sm text-muted-foreground">{pokemon.pointValue} pts · BST {pokemon.bst}</p>
          <div className="mt-2 flex flex-wrap gap-1">{types.map((type) => <TypeBadge key={type} type={type} />)}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
        <p><span className="font-semibold text-foreground">Weak:</span> {profile.weaknesses.join(", ") || "None"}</p>
        <p><span className="font-semibold text-foreground">Resist:</span> {profile.resistances.join(", ") || "None"}</p>
        <p><span className="font-semibold text-foreground">Immune:</span> {profile.immunities.join(", ") || "None"}</p>
      </div>
    </Card>
  );
}
