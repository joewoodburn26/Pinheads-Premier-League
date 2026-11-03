"use server";

// Reporting a schedule match from its Showdown replays:
//  1. readMatchReplays → parses each replay and matches Pokémon to the two rosters (nothing saved)
//  2. saveMatchReport  → saves the result + per-Pokémon stats, remembering what each replay added
//  3. clearMatchReport → removes the result and takes those stats back out

import { revalidatePath } from "next/cache";
import { denied, requireSignedIn } from "@/lib/auth";
import { getRoster } from "@/lib/data";
import { showdownName } from "@/lib/dex";
import { fetchAndParseReplay } from "@/lib/replay-parser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import type { Pokemon } from "@/lib/types";

type Side = "p1" | "p2";
const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type RosterMon = { id: string; name: string; sprite: string };

export type ReportMon = {
  /** Showdown's species name, as it appeared in the replay */
  species: string;
  side: Side;
  /** Roster Pokémon this species matches on each team (null = not on that roster) */
  homeMatch: string | null;
  awayMatch: string | null;
  games: number;
  kos: number;
  deaths: number;
};

export type ReportGame = {
  url: string;
  error?: string;
  p1: string;
  p2: string;
  winnerSide: Side | "";
  /** Which Showdown side is the home team (null = couldn't tell) */
  homeSide: Side | null;
  remaining: { p1: number; p2: number };
  mons: ReportMon[];
  /** Stats from this replay were saved before by the old parser, so they can't be swapped out */
  legacy?: boolean;
};

export type ReportPreview = {
  games: ReportGame[];
  home: RosterMon[];
  away: RosterMon[];
};

export type StatDelta = { teamId: string; pokemonId: string; games: number; kos: number; deaths: number };

// ── Roster matching ──────────────────────────────────────────────────────────

async function rosterOf(teamId: string): Promise<Pokemon[]> {
  const slots = await getRoster(teamId);
  return slots.map((s) => s.pokemon).filter((p): p is Pokemon => !!p);
}

/** Match a Showdown species to a roster Pokémon: exact species first, then its base Pokémon (Megas, formes). */
function matcher(roster: Pokemon[]) {
  const exact = new Map<string, Pokemon>();
  for (const p of roster) {
    for (const n of [showdownName(p), p.name]) if (n) exact.set(toId(n), p);
  }
  return (species: string): Pokemon | undefined => {
    const hit = exact.get(toId(species));
    if (hit) return hit;
    const base = species.split("-")[0];
    const sameBase = roster.filter((p) => (showdownName(p) ?? p.name).split("-")[0] === base);
    return sameBase.length === 1 ? sameBase[0] : undefined;
  };
}

// ── 1. Read replays ──────────────────────────────────────────────────────────

export async function readMatchReplays(
  homeTeamId: string,
  awayTeamId: string,
  urls: string[],
): Promise<{ error?: string; preview?: ReportPreview }> {
  const blocked = await denied(requireSignedIn);
  if (blocked) return { error: blocked };
  const links = urls.map((u) => u.trim()).filter(Boolean).slice(0, 3);
  if (!links.length) return { error: "Paste at least one replay link." };

  const [homeRoster, awayRoster] = await Promise.all([rosterOf(homeTeamId), rosterOf(awayTeamId)]);
  const matchHome = matcher(homeRoster);
  const matchAway = matcher(awayRoster);

  const legacy = new Set<string>();
  if (hasSupabaseEnv()) {
    const { data } = await createSupabaseAdminClient().from("replay_imports").select("*").in("replay_url", links);
    for (const row of data ?? []) if (!Array.isArray(row.parsed_payload)) legacy.add(row.replay_url);
  }

  const games: ReportGame[] = [];
  for (const url of links) {
    try {
      const r = await fetchAndParseReplay(url);
      // Which side is which team: count Pokémon found on each roster
      const score = { p1: 0, p2: 0 };
      for (const m of r.pokemon) {
        if (matchHome(m.name)) score[m.player]++;
        if (matchAway(m.name)) score[m.player === "p1" ? "p2" : "p1"]++;
      }
      const homeSide: Side | null = score.p1 > score.p2 ? "p1" : score.p2 > score.p1 ? "p2" : null;

      const mons: ReportMon[] = r.pokemon.map((m) => ({
        species: m.name,
        side: m.player,
        homeMatch: matchHome(m.name)?.id ?? null,
        awayMatch: matchAway(m.name)?.id ?? null,
        games: m.gamesPlayed,
        kos: m.kos,
        deaths: m.deaths,
      }));
      games.push({
        url, p1: r.p1, p2: r.p2, winnerSide: r.winnerSide, homeSide, remaining: r.remaining, mons,
        legacy: legacy.has(url) || undefined,
      });
    } catch (err) {
      games.push({
        url, error: err instanceof Error ? err.message : "Couldn't read this replay.",
        p1: "", p2: "", winnerSide: "", homeSide: null, remaining: { p1: 0, p2: 0 }, mons: [],
      });
    }
  }

  const toRoster = (list: Pokemon[]): RosterMon[] => list.map((p) => ({ id: p.id, name: p.name, sprite: p.spriteUrl }));
  return { preview: { games, home: toRoster(homeRoster), away: toRoster(awayRoster) } };
}

// ── Stat bookkeeping ─────────────────────────────────────────────────────────

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function applyDeltas(supabase: Admin, seasonId: string, deltas: StatDelta[], sign: 1 | -1) {
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

/** Record a parsed replay. Falls back to fewer columns on databases without the newer ones. */
async function recordImport(supabase: Admin, row: { url: string; seasonId: string; matchId: string; stats: StatDelta[] }) {
  const now = new Date().toISOString();
  const attempts: Record<string, unknown>[] = [
    { replay_url: row.url, season_id: row.seasonId, schedule_match_id: row.matchId, parsed_payload: row.stats, parsed_at: now, parser_status: "parsed" },
    { replay_url: row.url, season_id: row.seasonId, schedule_match_id: row.matchId, parsed_payload: row.stats, parsed_at: now },
    { replay_url: row.url, season_id: row.seasonId, parsed_at: now },
    { replay_url: row.url, season_id: row.seasonId },
  ];
  for (const [i, attempt] of attempts.entries()) {
    const { error } = await supabase.from("replay_imports").insert(attempt);
    if (!error) return i < 2; // true = saved with undo info
  }
  return false;
}

async function recomputeRecords(supabase: Admin, seasonId: string) {
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

/** Take back the stats a replay added (only possible for replays saved with undo info). */
async function undoImport(supabase: Admin, url: string): Promise<boolean> {
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

function revalidate() {
  revalidatePath("/schedule");
  revalidatePath("/stats");
  revalidatePath("/");
}

// ── 2. Save ──────────────────────────────────────────────────────────────────

export type MatchReport = {
  matchId: string;
  winner: string | null;
  bo3Score: string | null;
  homeDiff: number;
  awayDiff: number;
  replays: [string, string, string];
  /** Stats per replay; omit a replay to leave its stats alone */
  games: { url: string; stats: StatDelta[] }[];
};

export async function saveMatchReport(report: MatchReport): Promise<{ error?: string; notes?: string[] }> {
  const blocked = await denied(requireSignedIn);
  if (blocked) return { error: blocked };
  if (!hasSupabaseEnv()) return { error: "Supabase isn't configured, so results can't be saved." };
  const supabase = createSupabaseAdminClient();

  const { data: match, error: findErr } = await supabase.from("schedule_matches").select("*").eq("id", report.matchId).single();
  if (findErr || !match) return { error: "Couldn't find that match." };
  const seasonId = match.season_id as string;
  const notes: string[] = [];

  const { error: updErr } = await supabase.from("schedule_matches").update({
    winner: report.winner || null,
    bo3_score: report.bo3Score || null,
    home_diff: Math.round(report.homeDiff) || 0,
    away_diff: Math.round(report.awayDiff) || 0,
    replay_1: report.replays[0] || null,
    replay_2: report.replays[1] || null,
    replay_3: report.replays[2] || null,
  }).eq("id", report.matchId);
  if (updErr) return { error: `Couldn't save the result: ${updErr.message}` };

  // Replays taken off this match: remove what they added
  const kept = new Set(report.replays.filter(Boolean));
  for (const old of [match.replay_1, match.replay_2, match.replay_3]) {
    if (old && !kept.has(old)) await undoImport(supabase, old);
  }

  // Stats for each replay (replacing whatever that replay added before)
  for (const game of report.games) {
    if (!game.url) continue;
    const { data: prior } = await supabase.from("replay_imports").select("*").eq("replay_url", game.url);
    if ((prior ?? []).some((r) => !Array.isArray(r.parsed_payload))) {
      notes.push(`${game.url.split("/").pop()} was already counted by the old parser, so its stats were left as they were.`);
      continue;
    }
    await undoImport(supabase, game.url);
    const stats = game.stats.filter((s) => s.teamId && s.pokemonId);
    await applyDeltas(supabase, seasonId, stats, 1);
    const undoable = await recordImport(supabase, { url: game.url, seasonId, matchId: report.matchId, stats });
    if (!undoable) notes.push("Run supabase/replay-imports.sql so saved stats can be edited or removed later.");
  }

  await recomputeRecords(supabase, seasonId);
  revalidate();
  return { notes: [...new Set(notes)] };
}

// ── 3. Clear ─────────────────────────────────────────────────────────────────

export async function clearMatchReport(matchId: string): Promise<{ error?: string; notes?: string[] }> {
  const blocked = await denied(requireSignedIn);
  if (blocked) return { error: blocked };
  if (!hasSupabaseEnv()) return { error: "Supabase isn't configured." };
  const supabase = createSupabaseAdminClient();
  const { data: match } = await supabase.from("schedule_matches").select("*").eq("id", matchId).single();
  if (!match) return { error: "Couldn't find that match." };

  const notes: string[] = [];
  for (const url of [match.replay_1, match.replay_2, match.replay_3]) {
    if (url && !(await undoImport(supabase, url))) {
      const { data: rows } = await supabase.from("replay_imports").select("id").eq("replay_url", url);
      if (rows?.length) notes.push("Some stats were saved by the old parser and couldn't be removed automatically; fix them on the Stats page.");
    }
  }
  const { error } = await supabase.from("schedule_matches").update({
    winner: null, bo3_score: null, home_diff: 0, away_diff: 0, replay_1: null, replay_2: null, replay_3: null,
  }).eq("id", matchId);
  if (error) return { error: error.message };

  await recomputeRecords(supabase, match.season_id);
  revalidate();
  return { notes: [...new Set(notes)] };
}
