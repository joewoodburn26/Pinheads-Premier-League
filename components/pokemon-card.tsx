import Image from "next/image";
import type { Pokemon } from "@/lib/types";
import { pokemonTypesFor } from "@/lib/type-chart";
import { TypeBadge } from "@/components/type-badge";
import { Card } from "@/components/ui/card";

// ── Fetch abilities from PokéAPI ─────────────────────────────────────────────

async function getAbilities(dexNumber: number): Promise<string[]> {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${dexNumber}`, {
      next: { revalidate: 86400 }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.abilities as { ability: { name: string } }[]).map((a) =>
      a.ability.name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    );
  } catch {
    return [];
  }
}

// ── Stat bar ─────────────────────────────────────────────────────────────────

const STAT_LABELS: {
  key: keyof Pick<Pokemon, "hp" | "attack" | "defense" | "specialAttack" | "specialDefense" | "speed">;
  label: string;
}[] = [
  { key: "hp",             label: "HP"     },
  { key: "attack",         label: "Atk"    },
  { key: "defense",        label: "Def"    },
  { key: "specialAttack",  label: "Sp.Atk" },
  { key: "specialDefense", label: "Sp.Def" },
  { key: "speed",          label: "Speed"  },
];

function statColor(value: number): string {
  if (value >= 150) return "bg-blue-500";
  if (value >= 120) return "bg-green-700";
  if (value >= 90)  return "bg-green-500";
  if (value >= 60)  return "bg-yellow-400";
  if (value >= 30)  return "bg-orange-400";
  return "bg-red-500";
}

function StatBar({ label, value }: { label: string; value: number }) {
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

// ── Card ─────────────────────────────────────────────────────────────────────

export async function PokemonCard({ pokemon }: { pokemon: Pokemon }) {
  const types = pokemonTypesFor(pokemon);
  const abilities = await getAbilities(pokemon.dexNumber);

  return (
    <Card className="p-4">
      {/* Top section: sprite (red) | info (blue) | points (green) */}
      <div className="flex items-start gap-4">

        {/* RED box: large sprite */}
        <div className="shrink-0">
          <Image
            src={pokemon.spriteUrl}
            alt={pokemon.name}
            width={120}
            height={120}
            className="size-28 object-contain"
          />
        </div>

        {/* BLUE box: name → types → abilities, top to bottom */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="text-xl font-bold leading-tight">{pokemon.name}</h3>
          <div className="flex flex-wrap gap-1">
            {types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>
          {abilities.length > 0 && (
            <p className="text-sm font-medium text-foreground">
              {abilities.join(" · ")}
            </p>
          )}
        </div>

        {/* GREEN box: point value, top-right, large and bold */}
        <div className="shrink-0 text-right">
          <p className="text-3xl font-black leading-none">{pokemon.pointValue}</p>
          <p className="text-xs text-muted-foreground">pts</p>
          <p className="mt-1 text-xs text-muted-foreground">BST {pokemon.bst}</p>
        </div>

      </div>

      {/* Stat bars */}
      <div className="mt-4 space-y-1.5">
        {STAT_LABELS.map(({ key, label }) => (
          <StatBar key={key} label={label} value={pokemon[key]} />
        ))}
      </div>
    </Card>
  );
}