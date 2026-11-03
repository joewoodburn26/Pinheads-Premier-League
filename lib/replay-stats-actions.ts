"use server";

import { denied, requireOwner, requireSignedIn } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/server";

// Parsing replays and saving their stats now lives in lib/match-report.ts.

// ── Reset ALL stats for a season ──────────────────────────────────────────────

export async function resetAllStats(seasonId: string): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabaseEnv()) return { ok: false, error: "Supabase not configured" };
  const blocked = await denied(requireOwner);
  if (blocked) return { ok: false, error: blocked };
  const supabase = createSupabaseAdminClient();
  await supabase.from("pokemon_stats").delete().eq("season_id", seasonId);
  await supabase.from("replay_imports").delete().eq("season_id", seasonId);
  revalidatePath("/stats");
  return { ok: true };
}

// ── Update a single pokemon's stats manually ──────────────────────────────────

export async function updatePokemonStats(
  statId: string,
  gamesPlayed: number,
  kos: number,
  deaths: number,
  // Extra fields needed when creating a new row for a placeholder
  extra?: { seasonId: string; teamId: string; pokemonId: string },
): Promise<{ ok: boolean }> {
  if (!hasSupabaseEnv()) return { ok: false };
  if (await denied(requireSignedIn)) return { ok: false };
  const supabase = createSupabaseAdminClient();

  if (statId.startsWith("placeholder-") && extra) {
    // Row doesn't exist yet — insert it
    await supabase.from("pokemon_stats").insert({
      season_id:    extra.seasonId,
      team_id:      extra.teamId,
      pokemon_id:   extra.pokemonId,
      games_played: gamesPlayed,
      wins:         0,
      losses:       0,
      kos,
      deaths,
    });
  } else {
    await supabase
      .from("pokemon_stats")
      .update({ games_played: gamesPlayed, kos, deaths })
      .eq("id", statId);
  }

  revalidatePath("/stats");
  return { ok: true };
}

// ── Get parsed replays for a season ──────────────────────────────────────────

export async function getParsedReplays(seasonId: string): Promise<string[]> {
  if (!hasSupabaseEnv()) return [];
  const { data } = await createSupabaseAdminClient()
    .from("replay_imports")
    .select("replay_url")
    .eq("season_id", seasonId);
  return (data ?? []).map(r => r.replay_url).filter(Boolean);
}
