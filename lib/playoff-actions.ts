"use server";

// Playoff bracket: seeding from the standings, admin adjustments, and reading it.
// Results are reported through lib/match-report.ts (kind: "playoff"), which keeps
// later rounds in sync via syncBracket.

import { revalidatePath } from "next/cache";
import { denied, requireAdmin } from "@/lib/auth";
import { firstRound } from "@/lib/bracket";
import { getSchedule, getTeams } from "@/lib/data";
import { BYE_SCORE, bracketRows, syncBracket, undoImport } from "@/lib/report-store";
import { computeStandings } from "@/components/schedule/standings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export type PlayoffMatch = {
  id: string;
  seasonId: string;
  round: number;
  roundName: string;
  slotIndex: number;
  team1Id: string | null;
  team2Id: string | null;
  team1Seed: number | null;
  team2Seed: number | null;
  winner: string | null;
  bo3Score: string | null;
  team1Diff: number;
  team2Diff: number;
  replay1: string | null;
  replay2: string | null;
  replay3: string | null;
  /** First-round bye: team 1 goes straight through */
  isBye: boolean;
};

export async function getPlayoffMatches(seasonId: string): Promise<PlayoffMatch[]> {
  if (!hasSupabaseEnv()) return [];
  const { data } = await createSupabaseAdminClient()
    .from("playoff_matches")
    .select("*")
    .eq("season_id", seasonId)
    .order("round", { ascending: true })
    .order("slot_index", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    seasonId: row.season_id,
    round: row.round,
    roundName: row.round_name,
    slotIndex: row.slot_index,
    team1Id: row.team1_id,
    team2Id: row.team2_id,
    team1Seed: row.team1_seed ?? null,
    team2Seed: row.team2_seed ?? null,
    winner: row.winner,
    bo3Score: row.bo3_score,
    team1Diff: row.team1_diff ?? 0,
    team2Diff: row.team2_diff ?? 0,
    replay1: row.replay_1,
    replay2: row.replay_2,
    replay3: row.replay_3,
    isBye: row.bo3_score === BYE_SCORE,
  }));
}

type Result = { error?: string; needsConfirm?: boolean };

/**
 * Build the bracket from the current standings. If any playoff results exist,
 * returns needsConfirm unless `reset` is true (then those results and their stats are removed).
 */
export async function seedPlayoffs(seasonId: string, reset = false): Promise<Result> {
  const blocked = await denied(requireAdmin);
  if (blocked) return { error: blocked };
  if (!hasSupabaseEnv()) return { error: "Supabase isn't configured." };
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: readErr } = await supabase.from("playoff_matches").select("*").eq("season_id", seasonId);
  if (readErr) return { error: `Couldn't read the bracket: ${readErr.message}. Run supabase/playoffs.sql first.` };
  const played = (existing ?? []).filter((m) => m.winner && m.bo3_score !== BYE_SCORE);
  if (played.length && !reset) return { needsConfirm: true };

  // Standings decide the seeds
  const [{ data: season }, teams, matches] = await Promise.all([
    supabase.from("seasons").select("*").eq("id", seasonId).single(),
    getTeams(seasonId),
    getSchedule(seasonId),
  ]);
  const standings = computeStandings(teams, matches);
  const size = Math.min(standings.length, Math.max(2, Number(season?.playoff_teams) || standings.length));
  if (size < 2) return { error: "Playoffs need at least two teams." };
  const qualifiers = standings.slice(0, size);

  // Out with the old bracket (and any stats its replays added)
  for (const m of existing ?? []) {
    for (const url of [m.replay_1, m.replay_2, m.replay_3]) if (url) await undoImport(supabase, url);
  }
  if (existing?.length) await supabase.from("playoff_matches").delete().eq("season_id", seasonId);

  const pairs = firstRound(size);
  const rows = bracketRows(seasonId, size).map((row) => {
    if (row.round !== 1) return row;
    const p = pairs[row.slot_index];
    return {
      ...row,
      team1_id: qualifiers[p.seed1 - 1].teamId,
      team2_id: p.seed2 ? qualifiers[p.seed2 - 1].teamId : null,
      team1_seed: p.seed1,
      team2_seed: p.seed2,
    };
  });
  let { error } = await supabase.from("playoff_matches").insert(rows);
  if (error) {
    // Database without the seed columns
    const plain = rows.map(({ team1_seed: _a, team2_seed: _b, ...rest }: Record<string, unknown>) => (void _a, void _b, rest));
    ({ error } = await supabase.from("playoff_matches").insert(plain));
  }
  if (error) return { error: `Couldn't create the bracket: ${error.message}` };

  await syncBracket(supabase, seasonId);
  revalidatePath("/schedule");
  return {};
}

/**
 * Put a team into a first-round spot. If that team is already in round 1 the two swap places;
 * otherwise it replaces whoever was there. Only before any playoff game is reported.
 */
export async function setFirstRoundTeam(matchId: string, side: 1 | 2, teamId: string): Promise<Result> {
  const blocked = await denied(requireAdmin);
  if (blocked) return { error: blocked };
  if (!hasSupabaseEnv()) return { error: "Supabase isn't configured." };
  const supabase = createSupabaseAdminClient();

  const { data: target } = await supabase.from("playoff_matches").select("*").eq("id", matchId).single();
  if (!target || target.round !== 1) return { error: "Only first-round spots can be changed." };
  const seasonId = target.season_id as string;
  const { data: all } = await supabase.from("playoff_matches").select("*").eq("season_id", seasonId);
  if ((all ?? []).some((m) => m.winner && m.bo3_score !== BYE_SCORE)) {
    return { error: "A playoff game has already been reported. Re-seed the bracket to start over." };
  }

  const key = side === 1 ? "team1" : "team2";
  const outgoing = { id: target[`${key}_id`] as string | null, seed: (target[`${key}_seed`] as number | null) ?? null };
  const round1 = (all ?? []).filter((m) => m.round === 1);
  const from = round1.flatMap((m) => ([1, 2] as const).filter((s) => m[`team${s}_id`] === teamId).map((s) => ({ m, s })))[0];

  // Seed travels with the team
  const teams = await getTeams(seasonId);
  const standings = computeStandings(teams, await getSchedule(seasonId));
  const seedOf = (id: string) => standings.find((r) => r.teamId === id)?.seed ?? null;

  const set = async (id: string, s: 1 | 2, team: string | null, seed: number | null) => {
    const patch = { [`team${s}_id`]: team, [`team${s}_seed`]: seed, winner: null, bo3_score: null };
    const { error } = await supabase.from("playoff_matches").update(patch).eq("id", id);
    if (error) await supabase.from("playoff_matches").update({ [`team${s}_id`]: team, winner: null, bo3_score: null }).eq("id", id);
  };
  await set(matchId, side, teamId, from ? ((from.m[`team${from.s}_seed`] as number | null) ?? seedOf(teamId)) : seedOf(teamId));
  if (from && !(from.m.id === matchId && from.s === side)) await set(from.m.id, from.s, outgoing.id, outgoing.seed);

  await syncBracket(supabase, seasonId);
  revalidatePath("/schedule");
  return {};
}

/** Remove the bracket entirely (and any stats its replays added). */
export async function clearPlayoffs(seasonId: string): Promise<Result> {
  const blocked = await denied(requireAdmin);
  if (blocked) return { error: blocked };
  if (!hasSupabaseEnv()) return { error: "Supabase isn't configured." };
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("playoff_matches").select("*").eq("season_id", seasonId);
  for (const m of existing ?? []) {
    for (const url of [m.replay_1, m.replay_2, m.replay_3]) if (url) await undoImport(supabase, url);
  }
  await supabase.from("playoff_matches").delete().eq("season_id", seasonId);
  revalidatePath("/schedule");
  revalidatePath("/stats");
  return {};
}
