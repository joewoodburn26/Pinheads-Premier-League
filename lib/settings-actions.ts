"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ─── Season actions ───────────────────────────────────────────────────────────

export async function createNewSeason(formData: FormData) {
  const supabase = await createClient();
  const name       = String(formData.get("name") ?? "New Season");
  const draftBudget = Number(formData.get("draftBudget") ?? 100);
  const rosterSize  = Number(formData.get("rosterSize") ?? 10);
  const format      = String(formData.get("format") ?? "all");

  const { error } = await supabase
    .from("seasons")
    .insert({ name, draft_budget: draftBudget, roster_size: rosterSize, format, active_season: false, archived: false });

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function setActiveSeason(seasonId: string) {
  const supabase = await createClient();

  // Deactivate all, then activate the selected one
  await supabase.from("seasons").update({ active_season: false }).neq("id", "00000000-0000-0000-0000-000000000000");
  const { error } = await supabase.from("seasons").update({ active_season: true }).eq("id", seasonId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function archiveSeason(seasonId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("seasons")
    .update({ archived: true, active_season: false })
    .eq("id", seasonId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function deleteSeason(seasonId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("seasons").delete().eq("id", seasonId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updateRosterSize(seasonId: string, rosterSize: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("seasons")
    .update({ roster_size: rosterSize })
    .eq("id", seasonId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updateSeasonFormat(seasonId: string, format: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("seasons")
    .update({ format })
    .eq("id", seasonId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

// ─── Team actions ─────────────────────────────────────────────────────────────

export async function applyTeamChanges(formData: FormData) {
  const supabase = await createClient();
  const seasonId = String(formData.get("seasonId") ?? "");

  // Parse coach assignments: field name "team_<teamId>" = coachId
  const entries = Array.from(formData.entries());
  const teamUpdates = entries
    .filter(([k]) => k.startsWith("team_"))
    .map(([k, v]) => ({ teamId: k.replace("team_", ""), coachId: String(v) }));

  for (const { teamId, coachId } of teamUpdates) {
    const { error } = await supabase
      .from("teams")
      .update({ coach_id: coachId || null })
      .eq("id", teamId)
      .eq("season_id", seasonId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/settings");
}

export async function regenerateSchedule(seasonId: string) {
  const supabase = await createClient();

  // Fetch teams for this season
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .eq("season_id", seasonId);

  if (teamsError) throw new Error(teamsError.message);
  if (!teams || teams.length < 2) throw new Error("Need at least 2 teams to generate a schedule.");

  // Delete existing schedule
  await supabase.from("schedule_matches").delete().eq("season_id", seasonId);

  // Generate round-robin (with bye if odd number)
  const ids = teams.map(t => t.id);
  if (ids.length % 2 !== 0) ids.push("BYE");
  const n = ids.length;
  const rounds: { home: string; away: string }[][] = [];

  for (let round = 0; round < n - 1; round++) {
    const matches: { home: string; away: string }[] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = ids[i];
      const away = ids[n - 1 - i];
      if (home !== "BYE" && away !== "BYE") {
        matches.push({ home, away });
      }
    }
    rounds.push(matches);
    // rotate: fix last, rotate rest
    ids.splice(1, 0, ids.pop()!);
  }

  const rows = rounds.flatMap((matches, roundIdx) =>
    matches.map(({ home, away }) => ({
      season_id: seasonId,
      week: roundIdx + 1,
      home_team: home,
      away_team: away,
      winner: null,
      is_bye: false,
    }))
  );

  if (rows.length > 0) {
    const { error } = await supabase.from("schedule_matches").insert(rows);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/schedule");
}
