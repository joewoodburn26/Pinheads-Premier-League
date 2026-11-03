// Server-only: per-Pokémon totals from playoff replays, so the Stats page can
// show Regular season / Playoffs / All separately.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import type { StatDelta } from "@/lib/report-store";

export type StatTotals = { games: number; kos: number; deaths: number };

/** "teamId|pokemonId" → totals from playoff replays (empty if not tracked yet) */
export async function getPlayoffTotals(seasonId: string): Promise<Map<string, StatTotals>> {
  const out = new Map<string, StatTotals>();
  if (!hasSupabaseEnv()) return out;
  const { data, error } = await createSupabaseAdminClient()
    .from("replay_imports")
    .select("parsed_payload")
    .eq("season_id", seasonId)
    .eq("stage", "playoffs");
  if (error) return out; // older database without the stage column
  for (const row of data ?? []) {
    for (const d of (Array.isArray(row.parsed_payload) ? row.parsed_payload : []) as StatDelta[]) {
      const key = `${d.teamId}|${d.pokemonId}`;
      const t = out.get(key) ?? { games: 0, kos: 0, deaths: 0 };
      out.set(key, { games: t.games + d.games, kos: t.kos + d.kos, deaths: t.deaths + d.deaths });
    }
  }
  return out;
}
