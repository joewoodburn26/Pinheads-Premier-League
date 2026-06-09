"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/server";

// ─── Season actions ───────────────────────────────────────────────────────────

export async function createNewSeason(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false, error: "Supabase not configured" };
  const supabase = createSupabaseAdminClient();

  const name        = z.string().min(1).parse(formData.get("name"));
  const budget      = z.coerce.number().int().positive().default(105).parse(formData.get("budget"));
  const teamCount   = z.coerce.number().int().min(1).max(16).default(8).parse(formData.get("teamCount"));
  const sourceId    = formData.get("sourceSeasonId") as string | null;
  const copyNames   = formData.get("copyNames") === "true";
  const copyCoaches = formData.get("copyCoaches") === "true";
  const copyRosters = formData.get("copyRosters") === "true";
  const copyLogos   = formData.get("copyLogos") === "true";

  // Create the season
  const { data: season, error: seasonErr } = await supabase
    .from("seasons")
    .insert({ name, draft_budget: budget, active_season: false, archived: false })
    .select("*")
    .single();
  if (seasonErr || !season) return { ok: false, error: seasonErr?.message };

  // Get source teams if copying
  let sourceTeams: any[] = [];
  if (sourceId && (copyNames || copyCoaches || copyLogos || copyRosters)) {
    const { data } = await supabase.from("teams").select("*, coach:coaches(*)").eq("season_id", sourceId);
    sourceTeams = data ?? [];
  }

  // Create teams
  for (let i = 0; i < teamCount; i++) {
    const source = sourceTeams[i];

    // Handle coach
    let coachId: string;
    if (source && copyCoaches) {
      // Reuse same coach record
      coachId = source.coach_id;
    } else {
      // Create blank coach
      const { data: coach } = await supabase
        .from("coaches")
        .insert({ name: source && copyNames ? source.coach?.name ?? `Coach ${i + 1}` : `Coach ${i + 1}`, bio: null, image_url: null })
        .select("id")
        .single();
      coachId = coach?.id ?? "";
    }

    const teamName = source && copyNames ? source.team_name : `Team ${i + 1}`;
    const logoUrl  = source && copyLogos ? source.logo_url : null;

    const { data: team } = await supabase
      .from("teams")
      .insert({ season_id: season.id, coach_id: coachId, team_name: teamName, logo_url: logoUrl, wins: 0, losses: 0 })
      .select("id")
      .single();

    // Copy roster
    if (team && source && copyRosters) {
      const { data: slots } = await supabase.from("team_pokemon").select("*").eq("team_id", source.id);
      for (const slot of slots ?? []) {
        await supabase.from("team_pokemon").insert({ season_id: season.id, team_id: team.id, pokemon_id: slot.pokemon_id });
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/seasons");
  revalidatePath("/settings/seasons");
  return { ok: true, seasonId: season.id };
}

export async function setActiveSeason(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false };
  const seasonId = z.string().min(1).parse(formData.get("seasonId"));
  const supabase = createSupabaseAdminClient();
  await supabase.from("seasons").update({ active_season: false }).neq("id", seasonId);
  await supabase.from("seasons").update({ active_season: true }).eq("id", seasonId);
  revalidatePath("/");
  revalidatePath("/seasons");
  revalidatePath("/settings/seasons");
  return { ok: true };
}

export async function archiveSeason(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false };
  const seasonId = z.string().min(1).parse(formData.get("seasonId"));
  await createSupabaseAdminClient()
    .from("seasons")
    .update({ archived: true, active_season: false })
    .eq("id", seasonId);
  revalidatePath("/seasons");
  revalidatePath("/settings/seasons");
  return { ok: true };
}

export async function deleteSeason(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false };
  const seasonId = z.string().min(1).parse(formData.get("seasonId"));
  const supabase = createSupabaseAdminClient();

  // Delete in order: pokemon slots → schedule → stats → teams → season
  await supabase.from("team_pokemon").delete().eq("season_id", seasonId);
  await supabase.from("schedule_matches").delete().eq("season_id", seasonId);
  await supabase.from("pokemon_stats").delete().eq("season_id", seasonId);
  await supabase.from("teams").delete().eq("season_id", seasonId);
  await supabase.from("seasons").delete().eq("id", seasonId);

  revalidatePath("/");
  revalidatePath("/seasons");
  revalidatePath("/settings/seasons");
  return { ok: true };
}

// ─── Team management actions ──────────────────────────────────────────────────

export async function addTeam(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false };
  const supabase = createSupabaseAdminClient();
  const teamName = z.string().min(1).parse(formData.get("teamName"));
  const seasonId = z.string().min(1).parse(formData.get("seasonId"));

  const { data: coach } = await supabase
    .from("coaches")
    .insert({ name: "Unassigned Coach", bio: null, image_url: null })
    .select("id")
    .single();
  if (!coach) return { ok: false, error: "Failed to create coach" };

  await supabase.from("teams").insert({
    season_id: seasonId,
    coach_id: coach.id,
    team_name: teamName,
    logo_url: null,
    wins: 0,
    losses: 0,
  });

  revalidatePath("/");
  revalidatePath("/standings");
  revalidatePath("/rosters");
  revalidatePath("/settings/team-management");
  return { ok: true };
}

export async function deleteTeam(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false };
  const teamId = z.string().min(1).parse(formData.get("teamId"));
  const supabase = createSupabaseAdminClient();

  // Get coach id first
  const { data: team } = await supabase.from("teams").select("coach_id").eq("id", teamId).single();

  await supabase.from("team_pokemon").delete().eq("team_id", teamId);
  await supabase.from("pokemon_stats").delete().eq("team_id", teamId);
  await supabase.from("schedule_matches").delete().or(`home_team.eq.${teamId},away_team.eq.${teamId}`);
  await supabase.from("teams").delete().eq("id", teamId);
  if (team?.coach_id) {
    await supabase.from("coaches").delete().eq("id", team.coach_id);
  }

  revalidatePath("/");
  revalidatePath("/standings");
  revalidatePath("/rosters");
  revalidatePath("/settings/team-management");
  return { ok: true };
}

// ─── Point restructure actions ────────────────────────────────────────────────

export async function updatePokemonPoints(updates: { id: string; pointValue: number }[]) {
  if (!hasSupabaseEnv()) return { ok: false };
  const supabase = createSupabaseAdminClient();
  for (const { id, pointValue } of updates) {
    await supabase.from("pokemon").update({ point_value: pointValue }).eq("id", id);
  }
  revalidatePath("/draft");
  revalidatePath("/rosters");
  return { ok: true };
}

export async function updatePointsFromCsv(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false, error: "Supabase not configured" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file" };

  const text = await file.text();
  const lines = text.split("\n").slice(1); // skip header
  const supabase = createSupabaseAdminClient();
  let updated = 0;

  for (const line of lines) {
    const cols = line.split(",");
    if (cols.length < 4) continue;
    const dexNumber = parseInt(cols[0]?.trim());
    const pointValue = parseInt(cols[3]?.trim());
    if (isNaN(dexNumber) || isNaN(pointValue)) continue;
    const { error } = await supabase
      .from("pokemon")
      .update({ point_value: pointValue })
      .eq("dex_number", dexNumber);
    if (!error) updated++;
  }

  revalidatePath("/draft");
  revalidatePath("/rosters");
  return { ok: true, updated };
}
