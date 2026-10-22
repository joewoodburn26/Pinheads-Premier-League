// Server-side reads for Draft Plans. Permission checks happen in the callers.

import { hasSupabaseEnv } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTeams } from "@/lib/data";
import type { CurrentUser } from "@/lib/auth";
import type { Pokemon, Team } from "@/lib/types";

export type PlanPick = { id: string; note: string };

export type DraftPlan = {
  id: string;
  teamId: string;
  name: string;
  picks: PlanPick[];
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedSlot = { pokemon: Pokemon; note: string };

// Mock-data mode (no Supabase): keep plans in memory so the pages still work locally.
// Stored on globalThis because Next.js can load this module more than once.
const globalStore = globalThis as unknown as { __pplMockPlans?: (DraftPlan & { createdBy: string | null })[] };
export const mockPlans = (globalStore.__pplMockPlans ??= []);

function mapPlan(row: Record<string, unknown>): DraftPlan {
  const creator = row.creator as { name?: string } | null | undefined;
  return {
    id: row.id as string,
    teamId: row.team_id as string,
    name: row.name as string,
    picks: Array.isArray(row.picks) ? (row.picks as PlanPick[]) : [],
    createdByName: creator?.name ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getTeamPlans(teamId: string): Promise<DraftPlan[]> {
  if (!hasSupabaseEnv()) {
    return mockPlans.filter((p) => p.teamId === teamId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const { data } = await createSupabaseAdminClient()
    .from("draft_plans")
    .select("*, creator:profiles(name)")
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false });
  return (data ?? []).map(mapPlan);
}

export async function getPlan(planId: string): Promise<DraftPlan | undefined> {
  if (!hasSupabaseEnv()) return mockPlans.find((p) => p.id === planId);
  const { data } = await createSupabaseAdminClient()
    .from("draft_plans")
    .select("*, creator:profiles(name)")
    .eq("id", planId)
    .maybeSingle();
  return data ? mapPlan(data) : undefined;
}

/** The team in this season that the member is linked to (through their coach). */
export async function getMyTeam(user: CurrentUser | null, seasonId: string | undefined): Promise<Team | undefined> {
  if (!user?.coachId) return undefined;
  const teams = await getTeams(seasonId);
  return teams.find((t) => t.coachId === user.coachId);
}

/** Turn saved picks into Pokémon with current point values; skips any that no longer exist. */
export function resolvePicks(picks: PlanPick[], allPokemon: Pokemon[]): ResolvedSlot[] {
  const byId = new Map(allPokemon.map((p) => [p.id, p]));
  return picks.flatMap(({ id, note }) => {
    const pokemon = byId.get(id);
    return pokemon ? [{ pokemon, note: note ?? "" }] : [];
  });
}
