// Server-side read for private matchup notes. Permission checks happen in callers.

import { hasSupabaseEnv } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MatchupNotes = { notes: string; updatedAt: string | null };

// Mock-data mode (no Supabase): keep notes in memory (globalThis survives module reloads)
const store = globalThis as unknown as { __pplMockNotes?: Map<string, MatchupNotes> };
export const mockNotes = (store.__pplMockNotes ??= new Map());

export async function getMatchupNotes(teamId: string, opponentId: string): Promise<MatchupNotes> {
  if (!hasSupabaseEnv()) return mockNotes.get(`${teamId}|${opponentId}`) ?? { notes: "", updatedAt: null };
  const { data } = await createSupabaseAdminClient()
    .from("matchup_notes")
    .select("notes, updated_at")
    .eq("team_id", teamId)
    .eq("opponent_team_id", opponentId)
    .maybeSingle();
  return { notes: data?.notes ?? "", updatedAt: data?.updated_at ?? null };
}
