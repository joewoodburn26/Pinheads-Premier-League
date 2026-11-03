"use server";

// Reporting a schedule match from its Showdown replays:
//  1. readMatchReplays → parses each replay and matches Pokémon to the two rosters (nothing saved)
//  2. saveMatchReport  → saves the result + per-Pokémon stats, remembering what each replay added
//  3. clearMatchReport → removes the result and takes those stats back out

import { revalidatePath } from "next/cache";
import { denied, requireSignedIn } from "@/lib/auth";
import { getPokemon, getRoster } from "@/lib/data";
import { showdownName } from "@/lib/dex";
import { fetchAndParseReplay } from "@/lib/replay-parser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import {
  applyDeltas, isLegacyImport, recomputeRecords, recordImport, syncBracket, undoImport,
  type StatDelta,
} from "@/lib/report-store";
import type { Pokemon } from "@/lib/types";

type Side = "p1" | "p2";
const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type RosterMon = { id: string; name: string; sprite: string };

export type ReportMon = {
  /** Showdown's species name, as it appeared in the replay */
  species: string;
  side: Side;
  /**
   * Pokémon this species counts as for each team: its roster Pokémon, or (for Pokémon
   * swapped in or out during the season) the Pokédex entry. null = not found at all.
   */
  homeMatch: string | null;
  awayMatch: string | null;
  /** Whether that match is on the team's current roster */
  homeOnRoster: boolean;
  awayOnRoster: boolean;
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
  /** Pokédex entries for Pokémon in the replays that aren't on either roster */
  others: RosterMon[];
};

export type { StatDelta } from "@/lib/report-store";

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

  const [homeRoster, awayRoster, dex] = await Promise.all([rosterOf(homeTeamId), rosterOf(awayTeamId), getPokemon()]);
  const matchHome = matcher(homeRoster);
  const matchAway = matcher(awayRoster);
  // Coaches can swap Pokémon early in the season, so anything in the Pokédex counts too
  const matchDex = matcher(dex);
  const others = new Map<string, Pokemon>();

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

      const mons: ReportMon[] = r.pokemon.map((m) => {
        const home = matchHome(m.name);
        const away = matchAway(m.name);
        const fromDex = home && away ? undefined : matchDex(m.name);
        if (fromDex && (!home || !away)) others.set(fromDex.id, fromDex);
        return {
          species: m.name,
          side: m.player,
          homeMatch: (home ?? fromDex)?.id ?? null,
          awayMatch: (away ?? fromDex)?.id ?? null,
          homeOnRoster: !!home,
          awayOnRoster: !!away,
          games: m.gamesPlayed,
          kos: m.kos,
          deaths: m.deaths,
        };
      });
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
  return { preview: { games, home: toRoster(homeRoster), away: toRoster(awayRoster), others: toRoster([...others.values()]) } };
}

// ── 2. Save ──────────────────────────────────────────────────────────────────

export type MatchKind = "regular" | "playoff";

export type MatchReport = {
  kind: MatchKind;
  matchId: string;
  winner: string | null;
  bo3Score: string | null;
  /** Home = team 1 for playoff matches */
  homeDiff: number;
  awayDiff: number;
  replays: [string, string, string];
  /** Stats per replay; omit a replay to leave its stats alone */
  games: { url: string; stats: StatDelta[] }[];
};

const table = (kind: MatchKind) => (kind === "playoff" ? "playoff_matches" : "schedule_matches");

function revalidate() {
  revalidatePath("/schedule");
  revalidatePath("/stats");
  revalidatePath("/");
}

export async function saveMatchReport(report: MatchReport): Promise<{ error?: string; notes?: string[] }> {
  const blocked = await denied(requireSignedIn);
  if (blocked) return { error: blocked };
  if (!hasSupabaseEnv()) return { error: "Supabase isn't configured, so results can't be saved." };
  const supabase = createSupabaseAdminClient();
  const playoff = report.kind === "playoff";

  const { data: match, error: findErr } = await supabase.from(table(report.kind)).select("*").eq("id", report.matchId).single();
  if (findErr || !match) return { error: "Couldn't find that match." };
  const seasonId = match.season_id as string;
  const notes: string[] = [];

  const diffs = playoff
    ? { team1_diff: Math.round(report.homeDiff) || 0, team2_diff: Math.round(report.awayDiff) || 0 }
    : { home_diff: Math.round(report.homeDiff) || 0, away_diff: Math.round(report.awayDiff) || 0 };
  const { error: updErr } = await supabase.from(table(report.kind)).update({
    winner: report.winner || null,
    bo3_score: report.bo3Score || null,
    ...diffs,
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
    if (await isLegacyImport(supabase, game.url)) {
      notes.push(`${game.url.split("/").pop()} was already counted by the old parser, so its stats were left as they were.`);
      continue;
    }
    await undoImport(supabase, game.url);
    const stats = game.stats.filter((s) => s.teamId && s.pokemonId);
    await applyDeltas(supabase, seasonId, stats, 1);
    const undoable = await recordImport(supabase, {
      url: game.url, seasonId, stage: playoff ? "playoffs" : "regular", matchId: report.matchId, stats,
    });
    if (!undoable) notes.push("Run supabase/replay-imports.sql so saved stats can be edited or removed later.");
  }

  if (playoff) await syncBracket(supabase, seasonId);
  else await recomputeRecords(supabase, seasonId);
  revalidate();
  return { notes: [...new Set(notes)] };
}

// ── 3. Clear ─────────────────────────────────────────────────────────────────

export async function clearMatchReport(kind: MatchKind, matchId: string): Promise<{ error?: string; notes?: string[] }> {
  const blocked = await denied(requireSignedIn);
  if (blocked) return { error: blocked };
  if (!hasSupabaseEnv()) return { error: "Supabase isn't configured." };
  const supabase = createSupabaseAdminClient();
  const { data: match } = await supabase.from(table(kind)).select("*").eq("id", matchId).single();
  if (!match) return { error: "Couldn't find that match." };

  const notes: string[] = [];
  for (const url of [match.replay_1, match.replay_2, match.replay_3]) {
    if (url && !(await undoImport(supabase, url)) && (await isLegacyImport(supabase, url))) {
      notes.push("Some stats were saved by the old parser and couldn't be removed automatically; fix them on the Stats page.");
    }
  }
  const diffs = kind === "playoff" ? { team1_diff: 0, team2_diff: 0 } : { home_diff: 0, away_diff: 0 };
  const { error } = await supabase.from(table(kind)).update({
    winner: null, bo3_score: null, ...diffs, replay_1: null, replay_2: null, replay_3: null,
  }).eq("id", matchId);
  if (error) return { error: error.message };

  if (kind === "playoff") await syncBracket(supabase, match.season_id);
  else await recomputeRecords(supabase, match.season_id);
  revalidate();
  return { notes: [...new Set(notes)] };
}
