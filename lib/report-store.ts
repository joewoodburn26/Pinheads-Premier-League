// Server-only bookkeeping shared by match reports and the playoffs:
// adding/removing per-Pokémon stats, remembering what each replay added,
// team records, and keeping the playoff bracket's later rounds in sync.
// (Not a "use server" file, so none of this is callable from the browser.)

import { bracketSize, roundName } from "@/lib/bracket";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type Admin = ReturnType<typeof createSupabaseAdminClient>;
export type StatDelta = { teamId: string; pokemonId: string; games: number; kos: number; deaths: number };
export type Stage = "regular" | "playoffs";

export async function applyDeltas(supabase: Admin, seasonId: string, deltas: StatDelta[], sign: 1 | -1) {
  for (const d of deltas) {
    if (!d.teamId || !d.pokemonId) continue;
    const { data: row } = await supabase
      .from("pokemon_stats").select("id, games_played, kos, deaths")
      .eq("season_id", seasonId).eq("team_id", d.teamId).eq("pokemon_id", d.pokemonId).maybeSingle();
    if (row) {
      await supabase.from("pokemon_stats").update({
        games_played: Math.max(0, (row.games_played ?? 0) + sign * d.games),
        kos: Math.max(0, (row.kos ?? 0) + sign * d.kos),
        deaths: Math.max(0, (row.deaths ?? 0) + sign * d.deaths),
      }).eq("id", row.id);
    } else if (sign === 1) {
      await supabase.from("pokemon_stats").insert({
        season_id: seasonId, team_id: d.teamId, pokemon_id: d.pokemonId,
        games_played: d.games, wins: 0, losses: 0, kos: d.kos, deaths: d.deaths,
      });
    }
  }
}

/**
 * Record a parsed replay and what it added. Tries fewer columns on databases
 * that don't have the newer ones yet. Returns true if the undo info was saved.
 */
export async function recordImport(
  supabase: Admin,
  row: { url: string; seasonId: string; stage: Stage; matchId: string; stats: StatDelta[] },
): Promise<boolean> {
  const now = new Date().toISOString();
  const link = row.stage === "playoffs" ? { playoff_match_id: row.matchId } : { schedule_match_id: row.matchId };
  const attempts: Record<string, unknown>[] = [
    { replay_url: row.url, season_id: row.seasonId, ...link, stage: row.stage, parsed_payload: row.stats, parsed_at: now, parser_status: "parsed" },
    { replay_url: row.url, season_id: row.seasonId, ...link, stage: row.stage, parsed_payload: row.stats, parsed_at: now },
    { replay_url: row.url, season_id: row.seasonId, parsed_payload: row.stats, parsed_at: now },
    { replay_url: row.url, season_id: row.seasonId, parsed_at: now },
    { replay_url: row.url, season_id: row.seasonId },
  ];
  for (const [i, attempt] of attempts.entries()) {
    const { error } = await supabase.from("replay_imports").insert(attempt);
    if (!error) return i < 3;
  }
  return false;
}

/** Take back what a replay added (only for replays saved with undo info). */
export async function undoImport(supabase: Admin, url: string): Promise<boolean> {
  const { data: rows } = await supabase.from("replay_imports").select("*").eq("replay_url", url);
  let undone = false;
  for (const row of rows ?? []) {
    if (!Array.isArray(row.parsed_payload)) continue;
    await applyDeltas(supabase, row.season_id, row.parsed_payload as StatDelta[], -1);
    await supabase.from("replay_imports").delete().eq("id", row.id);
    undone = true;
  }
  return undone;
}

/** Was this replay counted by the old parser (no undo info)? */
export async function isLegacyImport(supabase: Admin, url: string): Promise<boolean> {
  const { data } = await supabase.from("replay_imports").select("*").eq("replay_url", url);
  return (data ?? []).some((r) => !Array.isArray(r.parsed_payload));
}

export async function recomputeRecords(supabase: Admin, seasonId: string) {
  const { data: matches } = await supabase.from("schedule_matches").select("*").eq("season_id", seasonId);
  const record: Record<string, { wins: number; losses: number }> = {};
  for (const m of matches ?? []) {
    for (const t of [m.home_team, m.away_team]) record[t] ??= { wins: 0, losses: 0 };
    if (!m.winner || m.is_bye) continue;
    const loser = m.home_team === m.winner ? m.away_team : m.home_team;
    record[m.winner].wins++;
    record[loser].losses++;
  }
  for (const [teamId, r] of Object.entries(record)) {
    if (teamId === "BYE") continue;
    await supabase.from("teams").update({ wins: r.wins, losses: r.losses }).eq("id", teamId);
  }
}

// ── Playoff bracket sync ─────────────────────────────────────────────────────

export const BYE_SCORE = "BYE";
const CLEARED = { winner: null, bo3_score: null, team1_diff: 0, team2_diff: 0, replay_1: null, replay_2: null, replay_3: null };

type PlayoffRow = {
  id: string; round: number; slot_index: number;
  team1_id: string | null; team2_id: string | null;
  team1_seed?: number | null; team2_seed?: number | null;
  winner: string | null; bo3_score: string | null;
  replay_1: string | null; replay_2: string | null; replay_3: string | null;
};

/**
 * Make every round follow from the one before:
 *  - first-round byes advance automatically
 *  - each winner moves into the next round's slot
 *  - if a slot's team changes, that match's result (and its replay stats) are cleared,
 *    which then ripples on to later rounds
 */
export async function syncBracket(supabase: Admin, seasonId: string) {
  const { data } = await supabase.from("playoff_matches").select("*").eq("season_id", seasonId);
  const rows = (data ?? []) as PlayoffRow[];
  if (!rows.length) return;
  const at = (r: number, s: number) => rows.find((m) => m.round === r && m.slot_index === s);
  const maxRound = Math.max(...rows.map((m) => m.round));

  // Byes in round 1: a team with no opponent goes straight through
  for (const m of rows.filter((x) => x.round === 1)) {
    const lone = m.team1_id && !m.team2_id ? m.team1_id : !m.team1_id && m.team2_id ? m.team2_id : null;
    if (lone && (m.winner !== lone || m.bo3_score !== BYE_SCORE)) {
      Object.assign(m, { winner: lone, bo3_score: BYE_SCORE });
      await supabase.from("playoff_matches").update({ winner: lone, bo3_score: BYE_SCORE }).eq("id", m.id);
    } else if (!lone && m.bo3_score === BYE_SCORE) {
      Object.assign(m, { winner: null, bo3_score: null });
      await supabase.from("playoff_matches").update({ winner: null, bo3_score: null }).eq("id", m.id);
    }
  }

  const seedOf = (m: PlayoffRow | undefined) =>
    !m?.winner ? null : m.winner === m.team1_id ? m.team1_seed ?? null : m.team2_seed ?? null;

  for (let r = 1; r < maxRound; r++) {
    const nextCount = rows.filter((m) => m.round === r + 1).length;
    for (let j = 0; j < nextCount; j++) {
      const next = at(r + 1, j);
      if (!next) continue;
      const a = at(r, j * 2);
      const b = at(r, j * 2 + 1);
      const want = { team1_id: a?.winner ?? null, team2_id: b?.winner ?? null };
      if (next.team1_id === want.team1_id && next.team2_id === want.team2_id) continue;

      const hadResult = !!next.winner || !!next.replay_1 || !!next.replay_2 || !!next.replay_3;
      if (hadResult) {
        for (const url of [next.replay_1, next.replay_2, next.replay_3]) if (url) await undoImport(supabase, url);
      }
      const update = { ...want, ...(hadResult ? CLEARED : {}) };
      Object.assign(next, update);
      const { error } = await supabase
        .from("playoff_matches")
        .update({ ...update, team1_seed: seedOf(a), team2_seed: seedOf(b) })
        .eq("id", next.id);
      if (error) await supabase.from("playoff_matches").update(update).eq("id", next.id); // no seed columns
      Object.assign(next, { team1_seed: seedOf(a), team2_seed: seedOf(b) });
    }
  }
}

/** Empty bracket rows for `teams` qualifiers: every round, every slot. */
export function bracketRows(seasonId: string, teams: number) {
  const size = bracketSize(teams);
  const rows: { season_id: string; round: number; round_name: string; slot_index: number }[] = [];
  for (let r = 1, slots = size / 2; slots >= 1; r++, slots /= 2) {
    for (let s = 0; s < slots; s++) rows.push({ season_id: seasonId, round: r, round_name: roundName(r, teams), slot_index: s });
  }
  return rows;
}
