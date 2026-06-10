import type { Pokemon, PokemonType } from "@/lib/types";
import { pokemonTypesFor } from "@/lib/type-chart";

// Type → hex color (matches typeColors in type-chart.ts)
export const TYPE_COLORS: Record<PokemonType, string> = {
  Normal:   "#A8A77A",
  Fire:     "#EE8130",
  Water:    "#6390F0",
  Electric: "#F7D02C",
  Grass:    "#7AC74C",
  Ice:      "#96D9D6",
  Fighting: "#C22E28",
  Poison:   "#A33EA1",
  Ground:   "#E2BF65",
  Flying:   "#A98FF3",
  Psychic:  "#F95587",
  Bug:      "#A6B91A",
  Rock:     "#B6A136",
  Ghost:    "#735797",
  Dragon:   "#6F35FC",
  Dark:     "#705746",
  Steel:    "#B7B7CE",
  Fairy:    "#D685AD",
};

export function getDominantTypeColor(pokemon: Pokemon[]): {
  color: string;
  secondColor: string;
  type: PokemonType;
} {
  const typeCounts: Partial<Record<PokemonType, number>> = {};

  for (const mon of pokemon) {
    for (const type of pokemonTypesFor(mon)) {
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    }
  }

  // Sort by count, pick top 2
  const sorted = (Object.entries(typeCounts) as [PokemonType, number][])
    .sort((a, b) => b[1] - a[1]);

  const dominantType  = sorted[0]?.[0] ?? "Normal";
  const secondaryType = sorted[1]?.[0] ?? dominantType;

  return {
    type:        dominantType,
    color:       TYPE_COLORS[dominantType],
    secondColor: TYPE_COLORS[secondaryType],
  };
}

// Convert hex to RGB string for use in rgba()
export function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
