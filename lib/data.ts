import { cache } from "react";
import { hasSupabaseEnv, createSupabaseServerClient } from "@/lib/supabase/server";
import { pokemon, rulesHtml, schedule, seasons, stats, teamPokemon, teams } from "@/lib/mock-data";
import type { Season, Team, Pokemon, TeamPokemon, ScheduleMatch, PokemonStats, Coach, PokemonType } from "@/lib/types";

// ─── Seasons ─────────────────────────────────────────────────────────────────

export const getSeasons = cache(loadSeasons);

async function loadSeasons(): Promise<Season[]> {
  if (!hasSupabaseEnv()) return seasons;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .order("created_at", { ascending: false });

  return (data ?? []).map(row => ({
    id:           row.id,
    name:         row.name,
    draftBudget:  row.draft_budget,
    rosterSize:   row.roster_size ?? undefined,
    format:       row.format ?? undefined,
    activeSeason: row.active_season,
    archived:     row.archived,
    createdAt:    row.created_at,
  }));
}

export async function getActiveSeason(): Promise<Season> {
  const all = await getSeasons();
  return all.find(s => s.activeSeason) ?? all[0];
}

// ─── Coaches ─────────────────────────────────────────────────────────────────

export async function getCoaches(): Promise<Coach[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("coaches").select("*").order("name");

  return (data ?? []).map(row => ({
    id:       row.id,
    name:     row.name,
    imageUrl: row.image_url ?? null,
    bio:      row.bio ?? null,
  }));
}

// ─── Teams ───────────────────────────────────────────────────────────────────

export async function getTeams(seasonId?: string): Promise<Team[]> {
  if (!hasSupabaseEnv()) return teams.filter(t => !seasonId || t.seasonId === seasonId);
  const supabase = await createSupabaseServerClient();
  const id = seasonId ?? (await getActiveSeason()).id;
  const { data } = await supabase
    .from("teams")
    .select("*, coach:coaches(*)")
    .eq("season_id", id)
    .order("wins", { ascending: false });

  return (data ?? []).map(row => ({
    id:         row.id,
    seasonId:   row.season_id,
    coachId:    row.coach_id,
    teamName:   row.team_name,
    logoUrl:    row.logo_url ?? null,
    wins:       row.wins,
    losses:     row.losses,
    draftOrder: row.draft_order ?? undefined,
    acePokemonId: row.ace_pokemon_id ?? null,
    coach: row.coach
      ? { id: row.coach.id, name: row.coach.name, imageUrl: row.coach.image_url ?? null, bio: row.coach.bio ?? null }
      : undefined,
  }));
}

export async function getTeam(id: string): Promise<Team | undefined> {
  const all = await getTeams();
  return all.find(t => t.id === id);
}

// ─── Pokémon ─────────────────────────────────────────────────────────────────

// ─── Season point values ──────────────────────────────────────────────────────
// A season can override any Pokémon's points (Point Restructure / CSV import /
// "Copy Points"). Everything below uses the season's value when one exists.

const getSeasonPoints = cache(async (seasonId: string): Promise<Map<string, number>> => {
  if (!hasSupabaseEnv() || !seasonId) return new Map();
  const supabase = await createSupabaseServerClient();
  const map = new Map<string, number>();
  // Page through in case a season overrides every Pokémon
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("season_point_values")
      .select("pokemon_id, point_value")
      .eq("season_id", seasonId)
      .range(from, from + 999);
    if (error || !data) break;
    for (const row of data) map.set(row.pokemon_id as string, row.point_value as number);
    if (data.length < 1000) break;
  }
  return map;
});

function applyPoints<T extends { id: string; pointValue: number }>(mon: T, points: Map<string, number>): T {
  const override = points.get(mon.id);
  return override === undefined ? mon : { ...mon, pointValue: override };
}

async function applySlotPoints(slots: TeamPokemon[]): Promise<TeamPokemon[]> {
  const seasonId = slots[0]?.seasonId;
  if (!seasonId) return slots;
  const points = await getSeasonPoints(seasonId);
  if (points.size === 0) return slots;
  return slots.map((s) => (s.pokemon ? { ...s, pokemon: applyPoints(s.pokemon, points) } : s));
}

/** Pokémon with points for a season (default: the active season). */
export async function getPokemon(seasonId?: string): Promise<Pokemon[]> {
  const base = await getBasePokemon();
  const id = seasonId ?? (await getActiveSeason())?.id;
  const points = id ? await getSeasonPoints(id) : new Map<string, number>();
  return points.size === 0 ? base : base.map((p) => applyPoints(p, points));
}

/** Pokémon with their base (Pokédex) points, ignoring season overrides. */
export async function getBasePokemon(): Promise<Pokemon[]> {
  if (!hasSupabaseEnv()) return pokemon;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("pokemon")
    .select("*")
    .order("point_value", { ascending: false });

  return (data ?? []).map(row => ({
    id:             row.id,
    dexNumber:      row.dex_number,
    name:           row.name,
    spriteUrl:      row.sprite_url,
    primaryType:    row.primary_type,
    secondaryType:  row.secondary_type ?? null,
    hp:             row.hp,
    attack:         row.attack,
    defense:        row.defense,
    specialAttack:  row.special_attack,
    specialDefense: row.special_defense,
    speed:          row.speed,
    bst:            row.bst,
    pointValue:     row.point_value,
    legendary:      row.legendary,
    mythical:       row.mythical,
    paradox:        row.paradox,
    ultraBeast:     row.ultra_beast ?? false,
    banned:         row.banned ?? undefined,
  }));
}

export const getAllPokemon = getPokemon;

// ─── Team Pokémon ─────────────────────────────────────────────────────────────

export async function getTeamPokemon(seasonId: string): Promise<TeamPokemon[]> {
  if (!hasSupabaseEnv()) return teamPokemon.filter(s => s.seasonId === seasonId);
  const supabase = await createSupabaseServerClient();
  const data = await selectSlotsInOrder(supabase, "season_id", seasonId);

  return applySlotPoints((data ?? []).map(row => ({
    id:        row.id,
    seasonId:  row.season_id,
    teamId:    row.team_id,
    pokemonId: row.pokemon_id,
    pokemon: row.pokemon ? mapPokemon(row.pokemon) : undefined,
  })));
}

export async function getRoster(teamId: string): Promise<TeamPokemon[]> {
  if (!hasSupabaseEnv()) return teamPokemon.filter(s => s.teamId === teamId);
  const supabase = await createSupabaseServerClient();
  const data = await selectSlotsInOrder(supabase, "team_id", teamId);

  return applySlotPoints((data ?? []).map(row => ({
    id:        row.id,
    seasonId:  row.season_id,
    teamId:    row.team_id,
    pokemonId: row.pokemon_id,
    pokemon: row.pokemon ? mapPokemon(row.pokemon) : undefined,
  })));
}

/**
 * Roster slots in their saved drag-and-drop order (slot_order).
 * Falls back to an unordered query if the slot_order column is missing.
 */
async function selectSlotsInOrder(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  column: "team_id" | "season_id",
  value: string,
) {
  const ordered = await supabase
    .from("team_pokemon")
    .select("*, pokemon(*)")
    .eq(column, value)
    .order("slot_order", { ascending: true, nullsFirst: false });
  if (!ordered.error) return ordered.data ?? [];

  const { data } = await supabase.from("team_pokemon").select("*, pokemon(*)").eq(column, value);
  return data ?? [];
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export async function getSchedule(seasonId: string): Promise<ScheduleMatch[]> {
  if (!hasSupabaseEnv()) return schedule.filter(m => m.seasonId === seasonId);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("schedule_matches")
    .select("*")
    .eq("season_id", seasonId)
    .order("week");

  return (data ?? []).map(row => ({
    id:       row.id,
    seasonId: row.season_id,
    week:     row.week,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    winner:   row.winner ?? null,
    bo3Score: row.bo3_score ?? null,
    homeDiff: row.home_diff ?? undefined,
    awayDiff: row.away_diff ?? undefined,
    isBye:    row.is_bye ?? false,
    replay1:  row.replay_1 ?? null,
    replay2:  row.replay_2 ?? null,
    replay3:  row.replay_3 ?? null,
  }));
}

// ─── Pokémon Stats ────────────────────────────────────────────────────────────

export async function getStats(seasonId?: string): Promise<PokemonStats[]> {
  if (!hasSupabaseEnv()) return stats.filter(r => !seasonId || r.seasonId === seasonId);
  const supabase = await createSupabaseServerClient();
  const id = seasonId ?? (await getActiveSeason()).id;
  const { data } = await supabase
    .from("pokemon_stats")
    .select("*, pokemon(*), team:teams(*)")
    .eq("season_id", id);
  const points = await getSeasonPoints(id);

  return (data ?? []).map(row => ({
    id:          row.id,
    seasonId:    row.season_id,
    pokemonId:   row.pokemon_id,
    teamId:      row.team_id ?? null,
    gamesPlayed: row.games_played,
    wins:        row.wins,
    losses:      row.losses,
    kos:         row.kos,
    deaths:      row.deaths,
    pokemon: row.pokemon ? applyPoints(mapPokemon(row.pokemon), points) : undefined,
    team: row.team
      ? {
          id:       row.team.id,
          seasonId: row.team.season_id,
          coachId:  row.team.coach_id,
          teamName: row.team.team_name,
          logoUrl:  row.team.logo_url ?? null,
          wins:     row.team.wins,
          losses:   row.team.losses,
        }
      : undefined,
  }));
}

// ─── Rules ────────────────────────────────────────────────────────────────────

export async function getRules(): Promise<string> {
  if (!hasSupabaseEnv()) return rulesHtml;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("league_rules").select("content").eq("id", "default").single();
  return data?.content ?? rulesHtml;
}

/** Rules content plus when it was last saved. */
export async function getRulesDoc(): Promise<{ content: string; updatedAt: string | null }> {
  if (!hasSupabaseEnv()) return { content: rulesHtml, updatedAt: null };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("league_rules")
    .select("content, updated_at")
    .eq("id", "default")
    .single();
  return { content: data?.content ?? rulesHtml, updatedAt: data?.updated_at ?? null };
}

// ─── Internal helper ─────────────────────────────────────────────────────────

function mapPokemon(p: Record<string, unknown>): Pokemon {
  return {
    id:             p.id as string,
    dexNumber:      p.dex_number as number,
    name:           p.name as string,
    spriteUrl:      p.sprite_url as string,
    primaryType:    p.primary_type as PokemonType,
    secondaryType:  (p.secondary_type as PokemonType) ?? null,
    hp:             p.hp as number,
    attack:         p.attack as number,
    defense:        p.defense as number,
    specialAttack:  p.special_attack as number,
    specialDefense: p.special_defense as number,
    speed:          p.speed as number,
    bst:            p.bst as number,
    pointValue:     p.point_value as number,
    legendary:      p.legendary as boolean,
    mythical:       p.mythical as boolean,
    paradox:        p.paradox as boolean,
    ultraBeast:     (p.ultra_beast as boolean) ?? false,
    banned:         (p.banned as boolean) ?? undefined,
  };
}
