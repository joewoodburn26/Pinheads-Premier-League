"use server";

import { canAdmin } from "@/lib/auth";

import { revalidatePath, revalidateTag } from "next/cache";
import { POKEDEX_TAG } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function toggleBan(pokemonId: string, banned: boolean): Promise<{ ok: boolean }> {
  if (!hasSupabaseEnv()) return { ok: false };
  if (!(await canAdmin())) return { ok: false };
  await createSupabaseAdminClient()
    .from("pokemon")
    .update({ banned })
    .eq("id", pokemonId);
  revalidateTag(POKEDEX_TAG);
  revalidatePath("/settings/pokedex");
  revalidatePath("/draft");
  revalidatePath("/rosters");
  return { ok: true };
}

export async function updatePointValue(pokemonId: string, pointValue: number): Promise<{ ok: boolean }> {
  if (!hasSupabaseEnv()) return { ok: false };
  if (!(await canAdmin())) return { ok: false };
  await createSupabaseAdminClient()
    .from("pokemon")
    .update({ point_value: pointValue })
    .eq("id", pokemonId);
  revalidateTag(POKEDEX_TAG);
  revalidatePath("/settings/pokedex");
  revalidatePath("/draft");
  return { ok: true };
}
