"use server";

import { denied, requireAdmin } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Reorder teams (draft order). orderedIds = team IDs in new desired order.
export async function reorderTeams(orderedIds: string[]) {
  const blocked = await denied(requireAdmin);
  if (blocked) return { ok: false, error: blocked };
  if (!hasSupabaseEnv()) {
    revalidatePath("/rosters");
    return { ok: true };
  }

  const supabase = createSupabaseAdminClient();

  const updates = orderedIds.map((id, index) =>
    supabase.from("teams").update({ draft_order: index }).eq("id", id)
  );

  await Promise.all(updates);

  revalidatePath("/rosters");
  revalidatePath("/");
  return { ok: true };
}
