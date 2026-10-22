import Image from "next/image";
import type { Pokemon, PokemonStats } from "@/lib/types";
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

export async function PokemonCard({
  pokemon,
  stats,
  ace,
  aceControl,
}: {
  pokemon: Pokemon;
  stats?: PokemonStats;
  /** "chosen" = coach picked it, "auto" = highest-points fallback */
  ace?: "chosen" | "auto";
  /** e.g. the star button on team pages */
  aceControl?: React.ReactNode;
}) {
  const types = pokemonTypesFor(pokemon);
  const abilities = await getAbilities(pokemon.dexNumber);

  return (
    <Card className={`relative p-4 ${ace ? "border-yellow-400/60 shadow-[0_0_24px_rgba(250,204,21,0.15)]" : ""}`}>
      {ace && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
          ★ Ace{ace === "auto" ? " · auto" : ""}
        </span>
      )}
      {/* Top section: sprite | info | points */}
      <div className="flex items-start gap-4">

        {/* Large sprite */}
        <div className="shrink-0">
          <Image
            src={pokemon.spriteUrl}
            alt={pokemon.name}
            width={120}
            height={120}
            className="size-28 object-contain"
          />
        </div>

        {/* Name → types → abilities */}
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

        {/* Point value (+ ace control) top-right */}
        <div className="flex shrink-0 items-start gap-1">
          <div className="text-right">
            <p className="text-3xl font-black leading-none">{pokemon.pointValue}</p>
            <p className="text-xs text-muted-foreground">pts</p>
          </div>
          {aceControl}
        </div>

      </div>

      {/* Stat bars */}
      <div className="mt-4 space-y-1.5">
        {STAT_LABELS.map(({ key, label }) => (
          <StatBar key={key} label={label} value={pokemon[key]} />
        ))}

        {/* BST total row — like Excel SUM */}
        <div className="flex items-center gap-2 border-t pt-1.5 text-xs">
          <span className="w-12 shrink-0 text-right font-semibold text-foreground">BST</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/60"
              style={{ width: `${Math.min(100, Math.round((pokemon.bst / 720) * 100))}%` }}
            />
          </div>
          <span className="w-8 shrink-0 font-mono font-black">{pokemon.bst}</span>
        </div>
      </div>

      {/* Season battle stats (only when provided) */}
      {stats && (
        <div className="mt-3 grid grid-cols-4 gap-1 border-t pt-3 text-center">
          {[
            { label: "GP", value: stats.gamesPlayed },
            { label: "W–L", value: `${stats.wins}–${stats.losses}` },
            { label: "KOs", value: stats.kos },
            { label: "Fainted", value: stats.deaths },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-base font-black tabular-nums">{s.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}