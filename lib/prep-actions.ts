"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTeamEditor } from "@/lib/auth";
import { mockNotes } from "@/lib/prep-notes";

/** Save private notes for (your team vs opponent). Returns { error } on failure. */
export async function saveMatchupNotes(
  teamId: string,
  opponentId: string,
  notes: string,
): Promise<{ error?: string; savedAt?: string }> {
  let text: string;
  try {
    z.string().min(1).parse(teamId);
    z.string().min(1).parse(opponentId);
    text = z.string().max(5000, "Notes can be up to 5,000 characters.").parse(notes);
  } catch (err) {
    return { error: err instanceof z.ZodError ? err.issues[0]?.message ?? "Check your notes." : "Check your notes." };
  }

  let user;
  try {
    user = await requireTeamEditor(teamId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Not allowed." };
  }

  const now = new Date().toISOString();
  if (!hasSupabaseEnv()) {
    mockNotes.set(`${teamId}|${opponentId}`, { notes: text, updatedAt: now });
  } else {
    const { error } = await createSupabaseAdminClient()
      .from("matchup_notes")
      .upsert(
        { team_id: teamId, opponent_team_id: opponentId, notes: text, updated_by: user.id, updated_at: now },
        { onConflict: "team_id,opponent_team_id" },
      );
    if (error) return { error: error.message };
  }

  revalidatePath("/prep");
  return { savedAt: now };
}
