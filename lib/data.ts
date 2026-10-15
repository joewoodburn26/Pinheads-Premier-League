import { createClient } from "@/lib/supabase/server";
import type { Season, Team, Pokemon, TeamPokemon, ScheduleMatch, PokemonStats, Coach } from "@/lib/types";

// ─── Seasons ─────────────────────────────────────────────────────────────────

export async function getSeasons(): Promise<Season[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

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

export async function getActiveSeason(): Promise<Season | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("active_season", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id:           data.id,
    name:         data.name,
    draftBudget:  data.draft_budget,
    rosterSize:   data.roster_size ?? undefined,
    format:       data.format ?? undefined,
    activeSeason: data.active_season,
    archived:     data.archived,
    createdAt:    data.created_at,
  };
}

// ─── Coaches ─────────────────────────────────────────────────────────────────

export async function getCoaches(): Promise<Coach[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaches")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    id:       row.id,
    name:     row.name,
    imageUrl: row.image_url ?? null,
    bio:      row.bio ?? null,
  }));
}

// ─── Teams ───────────────────────────────────────────────────────────────────

export async function getTeamsBySeason(seasonId: string): Promise<Team[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("*, coach:coaches(*)")
    .eq("season_id", seasonId)
    .order("wins", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    id:         row.id,
    seasonId:   row.season_id,
    coachId:    row.coach_id,
    teamName:   row.team_name,
    logoUrl:    row.logo_url ?? null,
    wins:       row.wins,
    losses:     row.losses,
    draftOrder: row.draft_order ?? undefined,
    coach: row.coach
      ? { id: row.coach.id, name: row.coach.name, imageUrl: row.coach.image_url ?? null, bio: row.coach.bio ?? null }
      : undefined,
  }));
}

// ─── Pokémon ─────────────────────────────────────────────────────────────────

export async function getAllPokemon(): Promise<Pokemon[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pokemon")
    .select("*")
    .order("dex_number");

  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    id:              row.id,
    dexNumber:       row.dex_number,
    name:            row.name,
    spriteUrl:       row.sprite_url,
    primaryType:     row.primary_type,
    secondaryType:   row.secondary_type ?? null,
    hp:              row.hp,
    attack:          row.attack,
    defense:         row.defense,
    specialAttack:   row.special_attack,
    specialDefense:  row.special_defense,
    speed:           row.speed,
    bst:             row.bst,
    pointValue:      row.point_value,
    legendary:       row.legendary,
    mythical:        row.mythical,
    paradox:         row.paradox,
    banned:          row.banned ?? undefined,
  }));
}

// ─── Team Pokémon ─────────────────────────────────────────────────────────────

export async function getTeamPokemon(seasonId: string): Promise<TeamPokemon[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_pokemon")
    .select("*, pokemon:pokemon(*)")
    .eq("season_id", seasonId);

  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    id:        row.id,
    seasonId:  row.season_id,
    teamId:    row.team_id,
    pokemonId: row.pokemon_id,
    pokemon: row.pokemon
      ? {
          id:              row.pokemon.id,
          dexNumber:       row.pokemon.dex_number,
          name:            row.pokemon.name,
          spriteUrl:       row.pokemon.sprite_url,
          primaryType:     row.pokemon.primary_type,
          secondaryType:   row.pokemon.secondary_type ?? null,
          hp:              row.pokemon.hp,
          attack:          row.pokemon.attack,
          defense:         row.pokemon.defense,
          specialAttack:   row.pokemon.special_attack,
          specialDefense:  row.pokemon.special_defense,
          speed:           row.pokemon.speed,
          bst:             row.pokemon.bst,
          pointValue:      row.pokemon.point_value,
          legendary:       row.pokemon.legendary,
          mythical:        row.pokemon.mythical,
          paradox:         row.pokemon.paradox,
          banned:          row.pokemon.banned ?? undefined,
        }
      : undefined,
  }));
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export async function getSchedule(seasonId: string): Promise<ScheduleMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_matches")
    .select("*")
    .eq("season_id", seasonId)
    .order("week");

  if (error) throw new Error(error.message);

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
    replay1:  row.replay1 ?? null,
    replay2:  row.replay2 ?? null,
    replay3:  row.replay3 ?? null,
  }));
}

// ─── Roster (Pokémon on a specific team) ─────────────────────────────────────

export async function getRoster(teamId: string): Promise<TeamPokemon[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_pokemon")
    .select("*, pokemon:pokemon(*)")
    .eq("team_id", teamId);

  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    id:        row.id,
    seasonId:  row.season_id,
    teamId:    row.team_id,
    pokemonId: row.pokemon_id,
    pokemon: row.pokemon
      ? {
          id:              row.pokemon.id,
          dexNumber:       row.pokemon.dex_number,
          name:            row.pokemon.name,
          spriteUrl:       row.pokemon.sprite_url,
          primaryType:     row.pokemon.primary_type,
          secondaryType:   row.pokemon.secondary_type ?? null,
          hp:              row.pokemon.hp,
          attack:          row.pokemon.attack,
          defense:         row.pokemon.defense,
          specialAttack:   row.pokemon.special_attack,
          specialDefense:  row.pokemon.special_defense,
          speed:           row.pokemon.speed,
          bst:             row.pokemon.bst,
          pointValue:      row.pokemon.point_value,
          legendary:       row.pokemon.legendary,
          mythical:        row.pokemon.mythical,
          paradox:         row.pokemon.paradox,
          banned:          row.pokemon.banned ?? undefined,
        }
      : undefined,
  }));
}

// ─── Pokémon Stats ────────────────────────────────────────────────────────────

export async function getPokemonStatsBySeason(seasonId: string): Promise<PokemonStats[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pokemon_stats")
    .select("*, pokemon:pokemon(*), team:teams(*)")
    .eq("season_id", seasonId);

  if (error) throw new Error(error.message);

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
    pokemon: row.pokemon
      ? {
          id:              row.pokemon.id,
          dexNumber:       row.pokemon.dex_number,
          name:            row.pokemon.name,
          spriteUrl:       row.pokemon.sprite_url,
          primaryType:     row.pokemon.primary_type,
          secondaryType:   row.pokemon.secondary_type ?? null,
          hp:              row.pokemon.hp,
          attack:          row.pokemon.attack,
          defense:         row.pokemon.defense,
          specialAttack:   row.pokemon.special_attack,
          specialDefense:  row.pokemon.special_defense,
          speed:           row.pokemon.speed,
          bst:             row.pokemon.bst,
          pointValue:      row.pokemon.point_value,
          legendary:       row.pokemon.legendary,
          mythical:        row.pokemon.mythical,
          paradox:         row.pokemon.paradox,
          banned:          row.pokemon.banned ?? undefined,
        }
      : undefined,
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

// ─── Aliases for backwards compatibility ─────────────────────────────────────
// Some pages import these names — keep them in sync with the canonical versions.

/** @deprecated Use getAllPokemon() */
export const getPokemon = getAllPokemon;

/** @deprecated Use getTeamsBySeason(seasonId) */
export const getTeams = getTeamsBySeason;
