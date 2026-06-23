"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function toggleBan(pokemonId: string, banned: boolean): Promise<{ ok: boolean }> {
  if (!hasSupabaseEnv()) return { ok: false };
  await createSupabaseAdminClient()
    .from("pokemon")
    .update({ banned })
    .eq("id", pokemonId);
  revalidatePath("/settings/pokedex");
  revalidatePath("/draft");
  revalidatePath("/rosters");
  return { ok: true };
}

export async function updatePointValue(pokemonId: string, pointValue: number): Promise<{ ok: boolean }> {
  if (!hasSupabaseEnv()) return { ok: false };
  await createSupabaseAdminClient()
    .from("pokemon")
    .update({ point_value: pointValue })
    .eq("id", pokemonId);
  revalidatePath("/settings/pokedex");
  revalidatePath("/draft");
  return { ok: true };
}
