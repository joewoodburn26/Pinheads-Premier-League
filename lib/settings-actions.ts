"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { generateRoundRobin, shuffleArray, BYE_ID } from "@/lib/schedule-utils";

// ─── Season creation with schedule generation ─────────────────────────────────

export async function createNewSeason(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false, error: "Supabase not configured" };
  const supabase = createSupabaseAdminClient();

  const name        = z.string().min(1).parse(formData.get("name"));
  const budget      = z.coerce.number().int().positive().default(105).parse(formData.get("budget"));
  const teamCount   = z.coerce.number().int().min(4).max(12).default(8).parse(formData.get("teamCount"));
  const rosterSize  = z.coerce.number().int().min(1).max(20).default(10).parse(formData.get("rosterSize"));
  const sourceId    = formData.get("sourceSeasonId") as string | null;
  const copyNames   = formData.get("copyNames")   === "true";
  const copyCoaches = formData.get("copyCoaches") === "true";
  const copyRosters = formData.get("copyRosters") === "true";
  const copyLogos   = formData.get("copyLogos")   === "true";
  const copyPoints  = formData.get("copyPoints")  === "true";
  const pointsSourceId = formData.get("pointsSourceId") as string | null;

  // Create season
  const { data: season, error: seasonErr } = await supabase
    .from("seasons")
    .insert({ name, draft_budget: budget, roster_size: rosterSize, active_season: false, archived: false })
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
  const newTeamIds: string[] = [];
  for (let i = 0; i < teamCount; i++) {
    const source = sourceTeams[i];

    let coachId: string;
    if (source && copyCoaches) {
      coachId = source.coach_id;
    } else {
      const { data: coach } = await supabase
        .from("coaches")
        .insert({ name: source && copyNames ? source.coach?.name ?? `Coach ${i + 1}` : `Coach ${i + 1}`, bio: null, image_url: null })
        .select("id")
        .single();
      coachId = coach?.id ?? "";
    }

    const teamName = source && copyNames ? source.team_name : `Team ${i + 1}`;
    const logoUrl  = source && copyLogos  ? source.logo_url  : null;

    const { data: team } = await supabase
      .from("teams")
      .insert({ season_id: season.id, coach_id: coachId, team_name: teamName, logo_url: logoUrl, wins: 0, losses: 0 })
      .select("id")
      .single();

    if (team) {
      newTeamIds.push(team.id);
      if (source && copyRosters) {
        const { data: slots } = await supabase.from("team_pokemon").select("*").eq("team_id", source.id);
        for (const slot of slots ?? []) {
          await supabase.from("team_pokemon").insert({ season_id: season.id, team_id: team.id, pokemon_id: slot.pokemon_id });
        }
      }
    }
  }

  // Generate schedule
  const shuffled  = shuffleArray(newTeamIds);
  const matchups  = generateRoundRobin(shuffled, 8);

  for (const m of matchups) {
    await supabase.from("schedule_matches").insert({
      season_id:  season.id,
      week:       m.week,
      home_team:  m.isBye ? m.homeTeam : m.homeTeam,
      away_team:  m.isBye ? BYE_ID     : m.awayTeam,
      is_bye:     m.isBye,
      winner:     null,
      bo3_score:  null,
      home_diff:  0,
      away_diff:  0,
    });
  }

  // Seed season_point_values from source season or global defaults
  const effectivePointSource = pointsSourceId || sourceId;
  if (copyPoints && effectivePointSource) {
    // Copy from another season's overrides
    const { data: sourcePoints } = await supabase
      .from("season_point_values")
      .select("pokemon_id, point_value")
      .eq("season_id", effectivePointSource);

    if (sourcePoints && sourcePoints.length > 0) {
      const inserts = sourcePoints.map(row => ({
        season_id: season.id,
        pokemon_id: row.pokemon_id,
        point_value: row.point_value,
      }));
      await supabase.from("season_point_values").insert(inserts);
    } else {
      // Source season has no overrides — copy from global pokemon.point_value
      const { data: globalPokemon } = await supabase.from("pokemon").select("id, point_value");
      const inserts = (globalPokemon ?? []).map(row => ({
        season_id: season.id,
        pokemon_id: row.id,
        point_value: row.point_value,
      }));
      if (inserts.length > 0) await supabase.from("season_point_values").insert(inserts);
    }
  } else {
    // No copy source — seed from global pokemon.point_value as baseline
    const { data: globalPokemon } = await supabase.from("pokemon").select("id, point_value");
    const inserts = (globalPokemon ?? []).map(row => ({
      season_id: season.id,
      pokemon_id: row.id,
      point_value: row.point_value,
    }));
    if (inserts.length > 0) await supabase.from("season_point_values").insert(inserts);
  }

  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/settings/seasons");
  return { ok: true, seasonId: season.id };
}

// ─── Regenerate schedule when teams change ────────────────────────────────────

export async function regenerateSchedule(seasonId: string) {
  if (!hasSupabaseEnv()) return { ok: false };
  const supabase = createSupabaseAdminClient();

  // Get all teams for this season
  const { data: teams } = await supabase.from("teams").select("id").eq("season_id", seasonId);
  const teamIds = (teams ?? []).map(t => t.id);

  if (teamIds.length < 2) return { ok: false, error: "Need at least 2 teams" };

  // Delete existing schedule
  await supabase.from("schedule_matches").delete().eq("season_id", seasonId);

  // Generate new randomized schedule
  const shuffled = shuffleArray(teamIds);
  const matchups = generateRoundRobin(shuffled, 8);

  for (const m of matchups) {
    await supabase.from("schedule_matches").insert({
      season_id: seasonId,
      week:      m.week,
      home_team: m.homeTeam,
      away_team: m.isBye ? BYE_ID : m.awayTeam,
      is_bye:    m.isBye,
      winner:    null,
      bo3_score: null,
      home_diff: 0,
      away_diff: 0,
    });
  }

  revalidatePath("/schedule");
  return { ok: true };
}

// ─── Batch team add/remove with confirm ───────────────────────────────────────

export async function applyTeamChanges(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false };
  const supabase   = createSupabaseAdminClient();
  const seasonId   = z.string().min(1).parse(formData.get("seasonId"));
  const toAdd      = JSON.parse(formData.get("toAdd") as string ?? "[]") as string[];
  const toRemove   = JSON.parse(formData.get("toRemove") as string ?? "[]") as string[];

  // Remove teams
  for (const teamId of toRemove) {
    const { data: team } = await supabase.from("teams").select("coach_id").eq("id", teamId).single();
    await supabase.from("team_pokemon").delete().eq("team_id", teamId);
    await supabase.from("pokemon_stats").delete().eq("team_id", teamId);
    await supabase.from("teams").delete().eq("id", teamId);
    if (team?.coach_id) await supabase.from("coaches").delete().eq("id", team.coach_id);
  }

  // Add teams
  for (const teamName of toAdd) {
    const { data: coach } = await supabase
      .from("coaches")
      .insert({ name: "Unassigned Coach", bio: null, image_url: null })
      .select("id")
      .single();
    if (coach) {
      await supabase.from("teams").insert({
        season_id: seasonId, coach_id: coach.id,
        team_name: teamName, logo_url: null, wins: 0, losses: 0,
      });
    }
  }

  // Regenerate schedule after changes
  await regenerateSchedule(seasonId);

  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/settings/team-management");
  return { ok: true };
}

// ─── Season management ────────────────────────────────────────────────────────

export async function setActiveSeason(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false };
  const seasonId = z.string().min(1).parse(formData.get("seasonId"));
  const supabase = createSupabaseAdminClient();
  await supabase.from("seasons").update({ active_season: false }).neq("id", seasonId);
  await supabase.from("seasons").update({ active_season: true }).eq("id", seasonId);
  revalidatePath("/");
  revalidatePath("/schedule");
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

// ─── Team management ──────────────────────────────────────────────────────────

export async function addTeam(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false };
  const supabase  = createSupabaseAdminClient();
  const teamName  = z.string().min(1).parse(formData.get("teamName"));
  const seasonId  = z.string().min(1).parse(formData.get("seasonId"));
  const { data: coach } = await supabase
    .from("coaches")
    .insert({ name: "Unassigned Coach", bio: null, image_url: null })
    .select("id")
    .single();
  if (!coach) return { ok: false, error: "Failed to create coach" };
  await supabase.from("teams").insert({ season_id: seasonId, coach_id: coach.id, team_name: teamName, logo_url: null, wins: 0, losses: 0 });
  revalidatePath("/");
  revalidatePath("/settings/team-management");
  return { ok: true };
}

export async function deleteTeam(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false };
  const teamId   = z.string().min(1).parse(formData.get("teamId"));
  const supabase = createSupabaseAdminClient();
  const { data: team } = await supabase.from("teams").select("coach_id").eq("id", teamId).single();
  await supabase.from("team_pokemon").delete().eq("team_id", teamId);
  await supabase.from("pokemon_stats").delete().eq("team_id", teamId);
  await supabase.from("schedule_matches").delete().or(`home_team.eq.${teamId},away_team.eq.${teamId}`);
  await supabase.from("teams").delete().eq("id", teamId);
  if (team?.coach_id) await supabase.from("coaches").delete().eq("id", team.coach_id);
  revalidatePath("/");
  revalidatePath("/settings/team-management");
  return { ok: true };
}

// ─── Point restructure ────────────────────────────────────────────────────────

export async function updatePokemonPoints(updates: { id: string; pointValue: number }[], seasonId?: string) {
  if (!hasSupabaseEnv()) return { ok: false };
  const supabase = createSupabaseAdminClient();
  for (const { id, pointValue } of updates) {
    if (seasonId) {
      await supabase.from("season_point_values").upsert({
        season_id: seasonId, pokemon_id: id, point_value: pointValue,
      }, { onConflict: "season_id,pokemon_id" });
    } else {
      await supabase.from("pokemon").update({ point_value: pointValue }).eq("id", id);
    }
  }
  revalidatePath("/draft");
  revalidatePath("/settings/point-restructure");
  return { ok: true };
}

export async function updatePointsFromCsv(formData: FormData) {
  if (!hasSupabaseEnv()) return { ok: false, error: "Supabase not configured" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file" };
  const seasonId = formData.get("seasonId") as string | null;
  const text  = await file.text();
  const lines = text.split("\n").slice(1);
  const supabase = createSupabaseAdminClient();
  let updated = 0;
  for (const line of lines) {
    const cols = line.split(",");
    if (cols.length < 2) continue;
    const dexNumber  = parseInt(cols[0]?.trim());
    // Points column is last (index 12 in new format, index 3 in old format)
    const pointValue = parseInt(cols[cols.length - 1]?.trim());
    if (isNaN(dexNumber) || isNaN(pointValue)) continue;

    // Find the pokemon by dex number
    const { data: mon } = await supabase
      .from("pokemon").select("id").eq("dex_number", dexNumber).maybeSingle();
    if (!mon) continue;

    if (seasonId) {
      await supabase.from("season_point_values").upsert({
        season_id: seasonId, pokemon_id: mon.id, point_value: pointValue,
      }, { onConflict: "season_id,pokemon_id" });
    } else {
      await supabase.from("pokemon").update({ point_value: pointValue }).eq("id", mon.id);
    }
    updated++;
  }
  revalidatePath("/draft");
  revalidatePath("/settings/point-restructure");
  return { ok: true, updated };
}

// ─── Update roster size for a season ─────────────────────────────────────────

export async function updateRosterSize(seasonId: string, rosterSize: number): Promise<{ ok: boolean }> {
  if (!hasSupabaseEnv()) return { ok: false };
  const supabase = createSupabaseAdminClient();

  await supabase
    .from("seasons")
    .update({ roster_size: rosterSize })
    .eq("id", seasonId);

  // Remove pokemon over the new limit for each team in this season
  const { data: teams } = await supabase
    .from("teams")
    .select("id")
    .eq("season_id", seasonId);

  for (const team of teams ?? []) {
    const { data: slots } = await supabase
      .from("team_pokemon")
      .select("id")
      .eq("team_id", team.id)
      .order("slot_order", { ascending: true });

    const over = (slots ?? []).slice(rosterSize);
    for (const slot of over) {
      await supabase.from("team_pokemon").delete().eq("id", slot.id);
    }
  }

  revalidatePath("/rosters");
  revalidatePath("/settings/seasons");
  return { ok: true };
}
