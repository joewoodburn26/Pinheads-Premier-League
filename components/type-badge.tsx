import type { PokemonType } from "@/lib/types";

const TYPE_BG: Record<string, string> = {
  Normal:   "bg-gray-400",
  Fire:     "bg-orange-500",
  Water:    "bg-blue-500",
  Electric: "bg-yellow-400",
  Grass:    "bg-green-500",
  Ice:      "bg-cyan-400",
  Fighting: "bg-red-600",
  Poison:   "bg-purple-500",
  Ground:   "bg-yellow-600",
  Flying:   "bg-indigo-400",
  Psychic:  "bg-pink-500",
  Bug:      "bg-lime-500",
  Rock:     "bg-yellow-700",
  Ghost:    "bg-purple-700",
  Dragon:   "bg-indigo-600",
  Dark:     "bg-gray-700",
  Steel:    "bg-gray-500",
  Fairy:    "bg-pink-400",
};

export function TypeBadge({ type }: { type: PokemonType | string }) {
  const bg = TYPE_BG[type] ?? "bg-gray-500";
  return (
    <span className={`${bg} rounded px-2 py-0.5 text-xs font-semibold uppercase text-white`}>
      {type}
    </span>
  );
}
