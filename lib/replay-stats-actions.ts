"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { fetchAndParseReplay } from "@/lib/replay-parser";

export interface ParseReplayResult {
  ok: boolean;
  error?: string;
  alreadyParsed?: boolean;
  parsed?: {
    p1: string; p2: string; winner: string; gameCount: number;
    pokemonStats: {
      name: string; player: string; gamesPlayed: number;
      kos: number; deaths: number; movesUsed: string[]; matched: boolean;
    }[];
  };
}

// ── Parse and save a replay ───────────────────────────────────────────────────

export async function parseAndSaveReplayStats(
  replayUrl: string,
  seasonId: string,
  homeTeamId: string,
  awayTeamId: string,
): Promise<ParseReplayResult> {
  if (!replayUrl?.trim()) return { ok: false, error: "No replay URL provided" };
  if (!hasSupabaseEnv()) return { ok: false, error: "Supabase not configured" };

  const supabase = createSupabaseAdminClient();

  // Check if already parsed
  const { data: existing } = await supabase
    .from("replay_imports")
    .select("id")
    .eq("replay_url", replayUrl)
    .maybeSingle();

  if (existing) return { ok: false, alreadyParsed: true, error: "This replay has already been parsed." };

  try {
    const replay = await fetchAndParseReplay(replayUrl);

    // Build roster lookup
    const { data: homeSlots } = await supabase
      .from("team_pokemon").select("id, pokemon_id, pokemon:pokemon(id, name)")
      .eq("team_id", homeTeamId).eq("season_id", seasonId);
    const { data: awaySlots } = await supabase
      .from("team_pokemon").select("id, pokemon_id, pokemon:pokemon(id, name)")
      .eq("team_id", awayTeamId).eq("season_id", seasonId);

    const rosterLookup = new Map<string, { pokemonId: string; teamId: string }>();
    for (const slot of homeSlots ?? []) {
      const mon = Array.isArray(slot.pokemon) ? slot.pokemon[0] : slot.pokemon as { id: string; name: string } | null;
      if (mon) rosterLookup.set(mon.name.toLowerCase(), { pokemonId: mon.id, teamId: homeTeamId });
    }
    for (const slot of awaySlots ?? []) {
      const mon = Array.isArray(slot.pokemon) ? slot.pokemon[0] : slot.pokemon as { id: string; name: string } | null;
      if (mon) rosterLookup.set(mon.name.toLowerCase(), { pokemonId: mon.id, teamId: awayTeamId });
    }

    const resultStats = [];

    for (const monStats of replay.pokemon) {
      const normalizedName = monStats.name.toLowerCase();
      let rosterEntry = rosterLookup.get(normalizedName);
      if (!rosterEntry) {
        for (const [key, val] of rosterLookup.entries()) {
          if (key.includes(normalizedName) || normalizedName.includes(key)) { rosterEntry = val; break; }
        }
      }

      resultStats.push({
        name: monStats.name, player: monStats.player,
        gamesPlayed: monStats.gamesPlayed, kos: monStats.kos,
        deaths: monStats.deaths, movesUsed: monStats.movesUsed,
        matched: !!rosterEntry,
      });

      if (!rosterEntry) continue;

      const { data: existingStats } = await supabase
        .from("pokemon_stats").select("id, games_played, kos, deaths")
        .eq("season_id", seasonId).eq("team_id", rosterEntry.teamId)
        .eq("pokemon_id", rosterEntry.pokemonId).maybeSingle();

      if (existingStats) {
        await supabase.from("pokemon_stats").update({
          games_played: (existingStats.games_played ?? 0) + monStats.gamesPlayed,
          kos:          (existingStats.kos ?? 0)          + monStats.kos,
          deaths:       (existingStats.deaths ?? 0)       + monStats.deaths,
        }).eq("id", existingStats.id);
      } else {
        await supabase.from("pokemon_stats").insert({
          season_id: seasonId, team_id: rosterEntry.teamId,
          pokemon_id: rosterEntry.pokemonId,
          games_played: monStats.gamesPlayed, wins: 0, losses: 0,
          kos: monStats.kos, deaths: monStats.deaths,
        });
      }
    }

    // Record that this replay was parsed
    await supabase.from("replay_imports").insert({
      replay_url: replayUrl,
      season_id:  seasonId,
      parsed_at:  new Date().toISOString(),
    });

    revalidatePath("/stats");
    return {
      ok: true,
      parsed: { p1: replay.p1, p2: replay.p2, winner: replay.winner, gameCount: replay.gameCount, pokemonStats: resultStats },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Reset a single replay's stats ─────────────────────────────────────────────

export async function resetReplayStats(
  replayUrl: string,
  seasonId: string,
  homeTeamId: string,
  awayTeamId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabaseEnv()) return { ok: false, error: "Supabase not configured" };
  const supabase = createSupabaseAdminClient();

  try {
    // Re-fetch and parse the replay to know what to subtract
    const replay = await fetchAndParseReplay(replayUrl);

    const { data: homeSlots } = await supabase
      .from("team_pokemon").select("id, pokemon_id, pokemon:pokemon(id, name)")
      .eq("team_id", homeTeamId).eq("season_id", seasonId);
    const { data: awaySlots } = await supabase
      .from("team_pokemon").select("id, pokemon_id, pokemon:pokemon(id, name)")
      .eq("team_id", awayTeamId).eq("season_id", seasonId);

    const rosterLookup = new Map<string, { pokemonId: string; teamId: string }>();
    for (const slot of homeSlots ?? []) {
      const mon = Array.isArray(slot.pokemon) ? slot.pokemon[0] : slot.pokemon as { id: string; name: string } | null;
      if (mon) rosterLookup.set(mon.name.toLowerCase(), { pokemonId: mon.id, teamId: homeTeamId });
    }
    for (const slot of awaySlots ?? []) {
      const mon = Array.isArray(slot.pokemon) ? slot.pokemon[0] : slot.pokemon as { id: string; name: string } | null;
      if (mon) rosterLookup.set(mon.name.toLowerCase(), { pokemonId: mon.id, teamId: awayTeamId });
    }

    for (const monStats of replay.pokemon) {
      const normalizedName = monStats.name.toLowerCase();
      let rosterEntry = rosterLookup.get(normalizedName);
      if (!rosterEntry) {
        for (const [key, val] of rosterLookup.entries()) {
          if (key.includes(normalizedName) || normalizedName.includes(key)) { rosterEntry = val; break; }
        }
      }
      if (!rosterEntry) continue;

      const { data: existing } = await supabase
        .from("pokemon_stats").select("id, games_played, kos, deaths")
        .eq("season_id", seasonId).eq("team_id", rosterEntry.teamId)
        .eq("pokemon_id", rosterEntry.pokemonId).maybeSingle();

      if (existing) {
        await supabase.from("pokemon_stats").update({
          games_played: Math.max(0, (existing.games_played ?? 0) - monStats.gamesPlayed),
          kos:          Math.max(0, (existing.kos ?? 0)          - monStats.kos),
          deaths:       Math.max(0, (existing.deaths ?? 0)       - monStats.deaths),
        }).eq("id", existing.id);
      }
    }

    // Remove the import record so it can be re-parsed
    await supabase.from("replay_imports").delete().eq("replay_url", replayUrl);

    revalidatePath("/stats");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Reset ALL stats for a season ──────────────────────────────────────────────

export async function resetAllStats(seasonId: string): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabaseEnv()) return { ok: false, error: "Supabase not configured" };
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
