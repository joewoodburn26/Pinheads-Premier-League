"use server";

import { requireAdmin } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// ─── Season actions ───────────────────────────────────────────────────────────

export async function createNewSeason(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const name        = String(formData.get("name") ?? "New Season");
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
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  await supabase.from("seasons").update({ active_season: false }).neq("id", "00000000-0000-0000-0000-000000000000");
  const { error } = await supabase.from("seasons").update({ active_season: true }).eq("id", seasonId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function archiveSeason(seasonId: string) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("seasons")
    .update({ archived: true, active_season: false })
    .eq("id", seasonId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function deleteSeason(seasonId: string) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("seasons").delete().eq("id", seasonId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updateRosterSize(seasonId: string, rosterSize: number) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("seasons")
    .update({ roster_size: rosterSize })
    .eq("id", seasonId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updateSeasonFormat(seasonId: string, format: string) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("seasons")
    .update({ format })
    .eq("id", seasonId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updatePointsFromCsv(csv: string) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const lines = csv.split("\n").map((l: string) => l.trim()).filter(Boolean);

  const updates: { name: string; pointValue: number }[] = [];
  for (const line of lines) {
    const parts = line.split(",");
    if (parts.length < 2) continue;
    const namePart = parts[0].trim().replace(/^"|"$/g, "");
    const ptsPart  = parts[1].trim().replace(/^"|"$/g, "");
    const pts = Number(ptsPart);
    if (isNaN(pts)) continue;
    updates.push({ name: namePart, pointValue: pts });
  }

  if (updates.length === 0) throw new Error("No valid rows found in CSV.");

  for (const { name, pointValue } of updates) {
    const isNum = /^\d+$/.test(name);
    const { error } = isNum
      ? await supabase.from("pokemon").update({ point_value: pointValue }).eq("dex_number", Number(name))
      : await supabase.from("pokemon").update({ point_value: pointValue }).ilike("name", name);
    if (error) throw new Error(`Failed to update ${name}: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/draft");
}

// ─── Team actions ─────────────────────────────────────────────────────────────

export async function applyTeamChanges(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const seasonId = String(formData.get("seasonId") ?? "");

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
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .eq("season_id", seasonId);

  if (teamsError) throw new Error(teamsError.message);
  if (!teams || teams.length < 2) throw new Error("Need at least 2 teams to generate a schedule.");

  await supabase.from("schedule_matches").delete().eq("season_id", seasonId);

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
