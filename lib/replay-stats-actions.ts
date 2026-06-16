"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { fetchAndParseReplay } from "@/lib/replay-parser";

export interface ParseReplayResult {
  ok: boolean;
  error?: string;
  parsed?: {
    p1: string;
    p2: string;
    winner: string;
    gameCount: number;
    pokemonStats: {
      name: string;
      player: string;
      gamesPlayed: number;
      kos: number;
      deaths: number;
      movesUsed: string[];
      matched: boolean; // whether we found this pokemon in our DB
    }[];
  };
}

export async function parseAndSaveReplayStats(
  replayUrl: string,
  seasonId: string,
  homeTeamId: string,
  awayTeamId: string,
): Promise<ParseReplayResult> {
  if (!replayUrl?.trim()) return { ok: false, error: "No replay URL provided" };
  if (!hasSupabaseEnv()) return { ok: false, error: "Supabase not configured" };

  try {
    // 1. Fetch and parse the replay
    const replay = await fetchAndParseReplay(replayUrl);
    const supabase = createSupabaseAdminClient();

    // 2. Get rosters for both teams so we can match pokemon names to IDs
    const { data: homeSlots } = await supabase
      .from("team_pokemon")
      .select("id, pokemon_id, pokemon:pokemon(id, name)")
      .eq("team_id", homeTeamId)
      .eq("season_id", seasonId);

    const { data: awaySlots } = await supabase
      .from("team_pokemon")
      .select("id, pokemon_id, pokemon:pokemon(id, name)")
      .eq("team_id", awayTeamId)
      .eq("season_id", seasonId);

    // Build lookup: normalized name -> { pokemonId, teamId }
    const rosterLookup = new Map<string, { pokemonId: string; teamId: string }>();

    for (const slot of homeSlots ?? []) {
      const mon = Array.isArray(slot.pokemon) ? slot.pokemon[0] : slot.pokemon as { id: string; name: string } | null;
      if (mon) rosterLookup.set(mon.name.toLowerCase(), { pokemonId: mon.id, teamId: homeTeamId });
    }
    for (const slot of awaySlots ?? []) {
      const mon = Array.isArray(slot.pokemon) ? slot.pokemon[0] : slot.pokemon as { id: string; name: string } | null;
      if (mon) rosterLookup.set(mon.name.toLowerCase(), { pokemonId: mon.id, teamId: awayTeamId });
    }

    // 3. Determine which team is p1 and p2 based on match winner
    // We match by checking which coach name appears in p1/p2
    // (Showdown usernames may differ from coach names, so we do fuzzy match)
    // For now, we save stats against the team that owned the pokemon

    const resultStats = [];

    for (const monStats of replay.pokemon) {
      const normalizedName = monStats.name.toLowerCase();
      const roster = rosterLookup.get(normalizedName);

      // Try partial match if exact fails
      let rosterEntry = roster;
      if (!rosterEntry) {
        for (const [key, val] of rosterLookup.entries()) {
          if (key.includes(normalizedName) || normalizedName.includes(key)) {
            rosterEntry = val;
            break;
          }
        }
      }

      resultStats.push({
        name: monStats.name,
        player: monStats.player,
        gamesPlayed: monStats.gamesPlayed,
        kos: monStats.kos,
        deaths: monStats.deaths,
        movesUsed: monStats.movesUsed,
        matched: !!rosterEntry,
      });

      if (!rosterEntry) continue;

      // 4. Upsert into pokemon_stats
      // Check if a record already exists for this pokemon/team/season/match
      const { data: existing } = await supabase
        .from("pokemon_stats")
        .select("id, games_played, wins, losses, kos, deaths")
        .eq("season_id", seasonId)
        .eq("team_id", rosterEntry.teamId)
        .eq("pokemon_id", rosterEntry.pokemonId)
        .maybeSingle();

      if (existing) {
        // Update existing record (accumulate stats)
        await supabase
          .from("pokemon_stats")
          .update({
            games_played: (existing.games_played ?? 0) + monStats.gamesPlayed,
            kos: (existing.kos ?? 0) + monStats.kos,
            deaths: (existing.deaths ?? 0) + monStats.deaths,
          })
          .eq("id", existing.id);
      } else {
        // Insert new record
        await supabase.from("pokemon_stats").insert({
          season_id: seasonId,
          team_id: rosterEntry.teamId,
          pokemon_id: rosterEntry.pokemonId,
          games_played: monStats.gamesPlayed,
          wins: 0,
          losses: 0,
          kos: monStats.kos,
          deaths: monStats.deaths,
        });
      }
    }

    revalidatePath("/stats");
    revalidatePath("/schedule");

    return {
      ok: true,
      parsed: {
        p1: replay.p1,
        p2: replay.p2,
        winner: replay.winner,
        gameCount: replay.gameCount,
        pokemonStats: resultStats,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
