"use server";

// Save, rename and delete Draft Plans. These return { error } so the Draft
// room and team page can show the exact message.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getActiveSeason } from "@/lib/data";
import { denied, requireSignedIn, requireTeamEditor } from "@/lib/auth";
import { getMyTeam, getPlan, mockPlans } from "@/lib/plans";

type Result = { error?: string };

const nameSchema = z.string().trim().min(1, "Give the plan a name.").max(80, "Keep the name under 80 characters.");
const picksSchema = z
  .array(z.object({ id: z.string().min(1), note: z.string().max(300).default("") }))
  .max(12, "A plan can have at most 12 Pokémon.");

async function planGuard(planId: string): Promise<{ teamId: string } | { error: string }> {
  const plan = await getPlan(planId);
  if (!plan) return { error: "That plan no longer exists." };
  const blocked = await denied(() => requireTeamEditor(plan.teamId));
  if (blocked) return { error: blocked };
  return { teamId: plan.teamId };
}

function refresh(teamId: string, planId?: string) {
  revalidatePath(`/teams/${teamId}`);
  if (planId) revalidatePath(`/teams/${teamId}/plans/${planId}`);
}

/**
 * Save the builder as a plan.
 * With planId: overwrite that plan's picks (and name). Without: create a new plan
 * on the signed-in member's own team.
 */
export async function savePlan(input: {
  planId?: string | null;
  name: string;
  picks: { id: string; note: string }[];
}): Promise<Result & { id?: string; teamId?: string }> {
  let name: string, picks: { id: string; note: string }[];
  try {
    name = nameSchema.parse(input.name);
    picks = picksSchema.parse(input.picks);
  } catch (err) {
    return { error: err instanceof z.ZodError ? err.issues[0]?.message ?? "Check the plan." : "Check the plan." };
  }
  if (picks.length === 0) return { error: "Add at least one Pokémon before saving." };
  const now = new Date().toISOString();

  // ── Update an existing plan ──
  if (input.planId) {
    const guard = await planGuard(input.planId);
    if ("error" in guard) return guard;

    if (!hasSupabaseEnv()) {
      const p = mockPlans.find((x) => x.id === input.planId)!;
      Object.assign(p, { name, picks, updatedAt: now });
    } else {
      const { error } = await createSupabaseAdminClient()
        .from("draft_plans")
        .update({ name, picks, updated_at: now })
        .eq("id", input.planId);
      if (error) return { error: error.message };
    }
    refresh(guard.teamId, input.planId);
    return { id: input.planId, teamId: guard.teamId };
  }

  // ── Create a new plan on your own team ──
  let user;
  try {
    user = await requireSignedIn();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Please sign in first." };
  }
  const season = await getActiveSeason();
  const team = await getMyTeam(user, season?.id);
  if (!team) return { error: "Your account isn't linked to a team this season. Ask the league owner." };

  if (!hasSupabaseEnv()) {
    const id = `plan-${Date.now()}`;
    mockPlans.push({ id, teamId: team.id, name, picks, createdBy: user.id, createdByName: user.name, createdAt: now, updatedAt: now });
    refresh(team.id);
    return { id, teamId: team.id };
  }

  const { data, error } = await createSupabaseAdminClient()
    .from("draft_plans")
    .insert({ team_id: team.id, name, picks, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Couldn't save the plan." };

  refresh(team.id);
  return { id: data.id as string, teamId: team.id };
}

export async function renamePlan(planId: string, newName: string): Promise<Result> {
  let name: string;
  try {
    name = nameSchema.parse(newName);
  } catch (err) {
    return { error: err instanceof z.ZodError ? err.issues[0]?.message ?? "Check the name." : "Check the name." };
  }
  const guard = await planGuard(planId);
  if ("error" in guard) return guard;

  if (!hasSupabaseEnv()) {
    const p = mockPlans.find((x) => x.id === planId)!;
    p.name = name;
  } else {
    const { error } = await createSupabaseAdminClient().from("draft_plans").update({ name }).eq("id", planId);
    if (error) return { error: error.message };
  }
  refresh(guard.teamId, planId);
  return {};
}

export async function deletePlan(planId: string): Promise<Result> {
  const guard = await planGuard(planId);
  if ("error" in guard) return guard;

  if (!hasSupabaseEnv()) {
    const i = mockPlans.findIndex((x) => x.id === planId);
    if (i !== -1) mockPlans.splice(i, 1);
  } else {
    const { error } = await createSupabaseAdminClient().from("draft_plans").delete().eq("id", planId);
    if (error) return { error: error.message };
  }
  refresh(guard.teamId, planId);
  return {};
}
