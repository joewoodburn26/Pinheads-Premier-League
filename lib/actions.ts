"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const seasonSchema = z.object({ name: z.string().min(2), draftBudget: z.coerce.number().int().positive().default(105) });

export async function createSeason(formData: FormData) {
  if (!hasSupabaseEnv()) return;
  const input = seasonSchema.parse(Object.fromEntries(formData));
  const supabase = createSupabaseAdminClient();
  await supabase.from("seasons").insert({ name: input.name, draft_budget: input.draftBudget, active_season: false });
  revalidatePath("/seasons");
}

export async function setActiveSeason(formData: FormData) {
  if (!hasSupabaseEnv()) return;
  const seasonId = z.string().min(1).parse(formData.get("seasonId"));
  const supabase = createSupabaseAdminClient();
  await supabase.from("seasons").update({ active_season: false }).neq("id", seasonId);
  await supabase.from("seasons").update({ active_season: true }).eq("id", seasonId);
  revalidatePath("/");
}

export async function archiveSeason(formData: FormData) {
  if (!hasSupabaseEnv()) return;
  const seasonId = z.string().min(1).parse(formData.get("seasonId"));
  await createSupabaseAdminClient().from("seasons").update({ archived: true, active_season: false }).eq("id", seasonId);
  revalidatePath("/seasons");
}

export async function duplicateSeason(formData: FormData) {
  if (!hasSupabaseEnv()) return;
  const sourceSeasonId = z.string().min(1).parse(formData.get("seasonId"));
  const name = z.string().min(2).parse(formData.get("name"));
  const supabase = createSupabaseAdminClient();

  const { data: source } = await supabase.from("seasons").select("*").eq("id", sourceSeasonId).single();
  if (!source) return;

  const { data: season } = await supabase
    .from("seasons")
    .insert({ name, draft_budget: source.draft_budget, active_season: false })
    .select("*")
    .single();
  if (!season) return;

  const { data: teams } = await supabase.from("teams").select("*").eq("season_id", sourceSeasonId);
  const idMap = new Map<string, string>();
  for (const team of teams ?? []) {
    const { data: inserted } = await supabase
      .from("teams")
      .insert({
        season_id: season.id,
        coach_id: team.coach_id,
        team_name: team.team_name,
        logo_url: team.logo_url,
        wins: 0,
        losses: 0
      })
      .select("id")
      .single();
    if (inserted) idMap.set(team.id, inserted.id);
  }

  const { data: roster } = await supabase.from("team_pokemon").select("*").eq("season_id", sourceSeasonId);
  for (const slot of roster ?? []) {
    const teamId = idMap.get(slot.team_id);
    if (teamId) {
      await supabase.from("team_pokemon").insert({ season_id: season.id, team_id: teamId, pokemon_id: slot.pokemon_id });
    }
  }

  revalidatePath("/seasons");
}

export async function updatePokemonCost(pokemonId: string, pointValue: number) {
  if (!hasSupabaseEnv()) return;
  await createSupabaseAdminClient().from("pokemon").update({ point_value: pointValue }).eq("id", pokemonId);
  revalidatePath("/draft");
}

export async function updateTeamName(teamId: string, formData: FormData) {
  if (!hasSupabaseEnv()) return;
  const teamName = z.string().min(1).parse(formData.get("teamName"));
  await createSupabaseAdminClient().from("teams").update({ team_name: teamName }).eq("id", teamId);
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/standings");
}

export async function updateCoachName(coachId: string, teamId: string, formData: FormData) {
  if (!hasSupabaseEnv()) return;
  const name = z.string().min(1).parse(formData.get("coachName"));
  await createSupabaseAdminClient().from("coaches").update({ name }).eq("id", coachId);
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/standings");
}

export async function updateCoachBio(coachId: string, teamId: string, formData: FormData) {
  if (!hasSupabaseEnv()) return;
  const bio = z.string().parse(formData.get("bio"));
  await createSupabaseAdminClient().from("coaches").update({ bio }).eq("id", coachId);
  revalidatePath(`/teams/${teamId}`);
}

export async function updateMatch(formData: FormData) {
  if (!hasSupabaseEnv()) return;
  const id = z.string().min(1).parse(formData.get("id"));
  const winner = (formData.get("winner") as string) || null;
  const supabase = createSupabaseAdminClient();

  // Get the existing match so we know the previous winner
  const { data: existingMatch } = await supabase
    .from("schedule_matches")
    .select("*")
    .eq("id", id)
    .single();

  // Save the match result
  await supabase
    .from("schedule_matches")
    .update({
      winner,
      replay_1: formData.get("replay1") || null,
      replay_2: formData.get("replay2") || null,
      replay_3: formData.get("replay3") || null
    })
    .eq("id", id);

  // Recalculate wins/losses for both teams if winner changed
  if (existingMatch && existingMatch.winner !== winner) {
    const homeTeamId = existingMatch.home_team;
    const awayTeamId = existingMatch.away_team;
    const seasonId = existingMatch.season_id;

    // Get all matches for this season to recalculate from scratch
    const { data: allMatches } = await supabase
      .from("schedule_matches")
      .select("*")
      .eq("season_id", seasonId);

    // Build a map of teamId -> { wins, losses }
    const record: Record<string, { wins: number; losses: number }> = {};
    for (const match of allMatches ?? []) {
      if (!match.winner) continue;
      const w = match.winner;
      const l = match.home_team === w ? match.away_team : match.home_team;
      record[w] = { wins: (record[w]?.wins ?? 0) + 1, losses: record[w]?.losses ?? 0 };
      record[l] = { wins: record[l]?.wins ?? 0, losses: (record[l]?.losses ?? 0) + 1 };
    }

    // Update both teams involved in this match
    for (const teamId of [homeTeamId, awayTeamId]) {
      await supabase
        .from("teams")
        .update({
          wins: record[teamId]?.wins ?? 0,
          losses: record[teamId]?.losses ?? 0
        })
        .eq("id", teamId);
    }
  }

  revalidatePath("/schedule");
  revalidatePath("/standings");
  revalidatePath("/");
}

export async function updateRules(formData: FormData) {
  if (!hasSupabaseEnv()) return;
  await createSupabaseAdminClient()
    .from("league_rules")
    .upsert({ id: "default", content: z.string().parse(formData.get("content")), updated_at: new Date().toISOString() });
  revalidatePath("/rules");
}