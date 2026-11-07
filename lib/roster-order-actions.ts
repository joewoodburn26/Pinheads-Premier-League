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

  if (orderedIds.length === 0) return { ok: true };
  const supabase = createSupabaseAdminClient();

  // The cards may show only some teams (team filter). Keep everyone else where they
  // are and shuffle the shown teams within the spots they already held.
  const { data: first } = await supabase.from("teams").select("season_id").eq("id", orderedIds[0]).single();
  if (!first) return { ok: false, error: "Couldn't find that team." };
  const { data: all, error: readErr } = await supabase
    .from("teams")
    .select("id, draft_order, team_name")
    .eq("season_id", first.season_id)
    .order("draft_order", { ascending: true, nullsFirst: false })
    .order("team_name");
  if (readErr || !all) return { ok: false, error: readErr?.message ?? "Couldn't read the teams." };

  const moved = new Set(orderedIds);
  const queue = [...orderedIds];
  const finalOrder = all.map((t) => (moved.has(t.id) ? queue.shift()! : t.id));

  const results = await Promise.all(
    finalOrder.map((id, index) => supabase.from("teams").update({ draft_order: index }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };

  revalidatePath("/rosters");
  revalidatePath("/");
  return { ok: true };
}
