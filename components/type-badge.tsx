import type { PokemonType } from "@/lib/types";
import { typeColors } from "@/lib/type-chart";

export function TypeBadge({ type }: { type: PokemonType }) {
  return (
    <span
      className="inline-flex min-w-16 items-center justify-center rounded px-2 py-1 text-xs font-bold uppercase text-black"
      style={{ backgroundColor: typeColors[type] }}
    >
      {type}
    </span>
  );
}
