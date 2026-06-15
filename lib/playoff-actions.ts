"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// ─── Save the entire bracket arrangement (team placements per slot) ──────────

const slotSchema = z.object({
  round: z.number().int(),
  roundName: z.string(),
  slotIndex: z.number().int(),
  team1Id: z.string().nullable(),
  team2Id: z.string().nullable(),
});

export async function saveBracketSlots(seasonId: string, slots: {
  round: number; roundName: string; slotIndex: number;
  team1Id: string | null; team2Id: string | null;
}[]) {
  if (!hasSupabaseEnv()) return { ok: false, error: "Supabase not configured" };
  const supabase = createSupabaseAdminClient();
  const parsed = slots.map(s => slotSchema.parse(s));

  for (const slot of parsed) {
    // Upsert — preserve existing winner/score/replays if the slot already exists
    const { data: existing } = await supabase
      .from("playoff_matches")
      .select("id, team1_id, team2_id, winner")
      .eq("season_id", seasonId)
      .eq("round", slot.round)
      .eq("slot_index", slot.slotIndex)
      .maybeSingle();

    if (existing) {
      // If teams changed, clear the result (stale)
      const teamsChanged = existing.team1_id !== slot.team1Id || existing.team2_id !== slot.team2Id;
      await supabase
        .from("playoff_matches")
        .update({
          round_name: slot.roundName,
          team1_id: slot.team1Id,
          team2_id: slot.team2Id,
          ...(teamsChanged ? { winner: null, bo3_score: null, team1_diff: 0, team2_diff: 0, replay_1: null, replay_2: null, replay_3: null } : {}),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("playoff_matches").insert({
        season_id: seasonId,
        round: slot.round,
        round_name: slot.roundName,
        slot_index: slot.slotIndex,
        team1_id: slot.team1Id,
        team2_id: slot.team2Id,
      });
    }
  }

  revalidatePath("/schedule");
  return { ok: true };
}

// ─── Update a single playoff match result ────────────────────────────────────

export async function updatePlayoffMatch(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false };
  const id        = z.string().min(1).parse(formData.get("id"));
  const winner    = (formData.get("winner") as string) || null;
  const bo3Score  = (formData.get("bo3Score") as string) || null;
  const team1Diff = parseInt(formData.get("team1Diff") as string) || 0;
  const team2Diff = parseInt(formData.get("team2Diff") as string) || 0;
  const replay1   = (formData.get("replay1") as string) || null;
  const replay2   = (formData.get("replay2") as string) || null;
  const replay3   = (formData.get("replay3") as string) || null;
  const seasonId  = z.string().min(1).parse(formData.get("seasonId"));

  const supabase = createSupabaseAdminClient();

  await supabase
    .from("playoff_matches")
    .update({
      winner, bo3_score: bo3Score,
      team1_diff: team1Diff, team2_diff: team2Diff,
      replay_1: replay1, replay_2: replay2, replay_3: replay3,
    })
    .eq("id", id);

  // ── Auto-advance winner to next round ──────────────────────────────────────
  if (winner) {
    const { data: match } = await supabase.from("playoff_matches").select("*").eq("id", id).single();
    if (match) {
      const nextRound = match.round + 1;
      const nextSlotIndex = Math.floor(match.slot_index / 2);
      const isTeam1Slot = match.slot_index % 2 === 0;

      // Check if next round slot exists
      const { data: nextSlot } = await supabase
        .from("playoff_matches")
        .select("*")
        .eq("season_id", seasonId)
        .eq("round", nextRound)
        .eq("slot_index", nextSlotIndex)
        .maybeSingle();

      if (nextSlot) {
        const updateField = isTeam1Slot ? { team1_id: winner } : { team2_id: winner };
        // If the advancing team changed, clear any stale result in the next match
        const prevAdvancer = isTeam1Slot ? nextSlot.team1_id : nextSlot.team2_id;
        const clearResult = prevAdvancer !== winner
          ? { winner: null, bo3_score: null, team1_diff: 0, team2_diff: 0, replay_1: null, replay_2: null, replay_3: null }
          : {};
        await supabase
          .from("playoff_matches")
          .update({ ...updateField, ...clearResult })
          .eq("id", nextSlot.id);
      } else {
        // Next round slot doesn't exist yet — create it
        // Determine round name from the structure based on team count in this season
        const { data: allMatches } = await supabase
          .from("playoff_matches")
          .select("round, slot_index")
          .eq("season_id", seasonId);
        const maxSlotInNextRound = (allMatches ?? [])
          .filter(m => m.round === nextRound)
          .reduce((max, m) => Math.max(max, m.slot_index), -1);
        const slotCountGuess = Math.max(maxSlotInNextRound + 1, nextSlotIndex + 1) * 2;
        const roundNameMap: Record<number, string> = { 2: "Finals", 4: "Semifinals", 8: "Quarterfinals", 16: "Round of 16" };

        await supabase.from("playoff_matches").insert({
          season_id: seasonId,
          round: nextRound,
          round_name: roundNameMap[slotCountGuess] ?? "Next Round",
          slot_index: nextSlotIndex,
          team1_id: isTeam1Slot ? winner : null,
          team2_id: isTeam1Slot ? null : winner,
        });
      }
    }
  }

  revalidatePath("/schedule");
  return { ok: true };
}

// ─── Get all playoff matches for a season ─────────────────────────────────────

export async function getPlayoffMatches(seasonId: string) {
  if (!hasSupabaseEnv()) return [];
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("playoff_matches")
    .select("*")
    .eq("season_id", seasonId)
    .order("round", { ascending: true })
    .order("slot_index", { ascending: true });

  return (data ?? []).map(row => ({
    id: row.id,
    seasonId: row.season_id,
    round: row.round,
    roundName: row.round_name,
    slotIndex: row.slot_index,
    team1Id: row.team1_id,
    team2Id: row.team2_id,
    winner: row.winner,
    bo3Score: row.bo3_score,
    team1Diff: row.team1_diff ?? 0,
    team2Diff: row.team2_diff ?? 0,
    replay1: row.replay_1,
    replay2: row.replay_2,
    replay3: row.replay_3,
  }));
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type PlayoffMatch = {
  id: string;
  seasonId: string;
  round: number;
  roundName: string;
  slotIndex: number;
  team1Id: string | null;
  team2Id: string | null;
  winner: string | null;
  bo3Score: string | null;
  team1Diff: number;
  team2Diff: number;
  replay1: string | null;
  replay2: string | null;
  replay3: string | null;
};
