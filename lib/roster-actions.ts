"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { teamPokemon } from "@/lib/mock-data";

// ── Remove a Pokémon slot from a roster ──────────────────────────────────────
export async function removeFromRoster(slotId: string) {
  if (!hasSupabaseEnv()) {
    const idx = teamPokemon.findIndex((s) => s.id === slotId);
    if (idx !== -1) teamPokemon.splice(idx, 1);
    revalidatePath("/rosters");
    revalidatePath("/teams");
    return { success: true };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("team_pokemon")
    .delete()
    .eq("id", slotId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/rosters");
  revalidatePath("/teams");
  return { success: true };
}

// ── Replace a Pokémon in an existing slot ────────────────────────────────────
export async function replaceInRoster(slotId: string, newPokemonId: string) {
  z.string().min(1).parse(slotId);
  z.string().min(1).parse(newPokemonId);

  if (!hasSupabaseEnv()) {
    const slot = teamPokemon.find((s) => s.id === slotId);
    if (slot) slot.pokemonId = newPokemonId;
    revalidatePath("/rosters");
    revalidatePath("/teams");
    return { success: true };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("team_pokemon")
    .update({ pokemon_id: newPokemonId })
    .eq("id", slotId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/rosters");
  revalidatePath("/teams");
  return { success: true };
}

// ── Add a brand-new Pokémon slot to a roster ─────────────────────────────────
export async function addToRoster(teamId: string, seasonId: string, pokemonId: string) {
  z.string().min(1).parse(teamId);
  z.string().min(1).parse(seasonId);
  z.string().min(1).parse(pokemonId);

  if (!hasSupabaseEnv()) {
    teamPokemon.push({
      id: `slot-${Date.now()}`,
      seasonId,
      teamId,
      pokemonId,
    });
    revalidatePath("/rosters");
    revalidatePath("/teams");
    return { success: true };
  }

  const supabase = createSupabaseAdminClient();

  // Get current max slot_order for this team
  const { data: existing } = await supabase
    .from("team_pokemon")
    .select("slot_order")
    .eq("team_id", teamId)
    .order("slot_order", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.slot_order ?? -1) + 1;

  const { error } = await supabase
    .from("team_pokemon")
    .insert({ team_id: teamId, season_id: seasonId, pokemon_id: pokemonId, slot_order: nextOrder });

  if (error) return { success: false, error: error.message };

  revalidatePath("/rosters");
  revalidatePath("/teams");
  return { success: true };
}

// ── Reorder roster slots ──────────────────────────────────────────────────────
// orderedIds: array of slot IDs in the new desired order
export async function reorderRoster(orderedIds: string[]) {
  if (!hasSupabaseEnv()) {
    revalidatePath("/rosters");
    return { success: true };
  }

  const supabase = createSupabaseAdminClient();

  // Update each slot's slot_order to match its position in the array
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("team_pokemon")
      .update({ slot_order: index })
      .eq("id", id)
  );

  await Promise.all(updates);

  revalidatePath("/rosters");
  revalidatePath("/teams");
  return { success: true };
}
