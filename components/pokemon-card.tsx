import Image from "next/image";
import type { Pokemon } from "@/lib/types";
import { pokemonTypesFor } from "@/lib/type-chart";
import { TypeBadge } from "@/components/type-badge";
import { Card } from "@/components/ui/card";

const STAT_LABELS: { key: keyof Pick<Pokemon, "hp" | "attack" | "defense" | "specialAttack" | "specialDefense" | "speed">; label: string }[] = [
  { key: "hp",             label: "HP"      },
  { key: "attack",         label: "Atk"     },
  { key: "defense",        label: "Def"     },
  { key: "specialAttack",  label: "Sp.Atk"  },
  { key: "specialDefense", label: "Sp.Def"  },
  { key: "speed",          label: "Speed"   },
];

function statColor(value: number): string {
  if (value >= 150) return "bg-blue-500";
  if (value >= 120) return "bg-green-500";
  if (value >= 90)  return "bg-yellow-400";
  if (value >= 60)  return "bg-orange-400";
  return "bg-red-500";
}

function StatBar({ label, value }: { label: string; value: number }) {
  // Max stat in the game is ~255 (HP of Blissey). We cap the bar at 255.
  const pct = Math.min(100, Math.round((value / 255) * 100));
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 shrink-0 text-right text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${statColor(value)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 font-mono font-semibold">{value}</span>
    </div>
  );
}

export function PokemonCard({ pokemon }: { pokemon: Pokemon }) {
  const types = pokemonTypesFor(pokemon);

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <Image
          src={pokemon.spriteUrl}
          alt={pokemon.name}
          width={90}
          height={90}
          className="size-20 object-contain"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">{pokemon.name}</h3>
          <p className="text-sm text-muted-foreground">
            {pokemon.pointValue} pts · BST {pokemon.bst}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        {STAT_LABELS.map(({ key, label }) => (
          <StatBar key={key} label={label} value={pokemon[key]} />
        ))}
      </div>
    </Card>
  );
}
