"use server";

// Admin schedule editing. The Schedule page sends the whole regular-season schedule
// as it should be after the edits; this works out what changed and saves it.
//
// • A game whose two teams stay the same keeps its result, even if it moved week
//   or the home/away sides swapped.
// • A game whose teams changed, or that was removed, loses its result, and the
//   stats its replays added are taken back off (same as clearing a report).
// • Records are recounted at the end.

import { revalidatePath } from "next/cache";
import { denied, requireAdmin } from "@/lib/auth";
import { isLegacyImport, recomputeRecords, undoImport } from "@/lib/report-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { planScheduleSave, type EditedGame, type SavedGame } from "@/lib/schedule-edit";

type Supabase = ReturnType<typeof createSupabaseAdminClient>;

export async function saveScheduleEdits(
  seasonId: string,
  games: EditedGame[],
): Promise<{ error?: string; notes?: string[]; changed?: number }> {
  const blocked = await denied(requireAdmin);
  if (blocked) return { error: blocked };
  if (!hasSupabaseEnv()) return { error: "Supabase isn't configured, so the schedule can't be saved." };
  const supabase = createSupabaseAdminClient();

  try {
    const [{ data: rows, error: readErr }, { data: teams, error: teamErr }] = await Promise.all([
      supabase.from("schedule_matches").select("*").eq("season_id", seasonId),
      supabase.from("teams").select("id").eq("season_id", seasonId),
    ]);
    if (readErr) throw new Error(readErr.message);
    if (teamErr) throw new Error(teamErr.message);

    const saved: SavedGame[] = (rows ?? [])
      .filter((r) => !r.is_bye && r.away_team !== "BYE")
      .map((r) => ({
        id: r.id,
        week: r.week,
        home: r.home_team,
        away: r.away_team,
        played: Boolean(r.winner),
        replays: [r.replay_1, r.replay_2, r.replay_3].filter(Boolean) as string[],
        homeDiff: r.home_diff ?? 0,
        awayDiff: r.away_diff ?? 0,
      }));

    const plan = planScheduleSave(saved, games, new Set((teams ?? []).map((t) => t.id as string)));
    if (plan.error) return { error: plan.error };

    // Results that go away: undo their stats first
    const notes: string[] = [];
    for (const g of [...plan.remove, ...plan.update.filter((u) => u.clearResult).map((u) => u.before)]) {
      for (const url of g.replays) {
        if (!(await undoImport(supabase, url)) && (await isLegacyImport(supabase, url))) {
          notes.push("Some stats were saved by the old parser and couldn't be removed automatically; fix them on the Stats page.");
        }
      }
    }

    if (plan.remove.length) {
      const { error } = await supabase.from("schedule_matches").delete().in("id", plan.remove.map((g) => g.id));
      if (error) throw new Error(error.message);
    }
    for (const u of plan.update) await updateGame(supabase, u);
    if (plan.insert.length) {
      const { error } = await supabase.from("schedule_matches").insert(
        plan.insert.map((g) => ({ season_id: seasonId, week: g.week, home_team: g.home, away_team: g.away, winner: null, is_bye: false })),
      );
      if (error) throw new Error(error.message);
    }

    await recomputeRecords(supabase, seasonId);
    revalidatePath("/schedule");
    revalidatePath("/stats");
    revalidatePath("/");
    return { notes: [...new Set(notes)], changed: plan.remove.length + plan.update.length + plan.insert.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save the schedule." };
  }
}

async function updateGame(supabase: Supabase, u: ReturnType<typeof planScheduleSave>["update"][number]) {
  const patch: Record<string, unknown> = { week: u.week, home_team: u.home, away_team: u.away };
  if (u.clearResult) {
    Object.assign(patch, { winner: null, bo3_score: null, home_diff: 0, away_diff: 0, replay_1: null, replay_2: null, replay_3: null });
  } else if (u.sidesSwapped) {
    // Same game, home and away flipped: the battle differentials go with their team
    Object.assign(patch, { home_diff: u.before.awayDiff, away_diff: u.before.homeDiff });
  }
  const { error } = await supabase.from("schedule_matches").update(patch).eq("id", u.id);
  if (error) throw new Error(error.message);
}
