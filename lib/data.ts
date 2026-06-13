import { hasSupabaseEnv, createSupabaseServerClient } from "@/lib/supabase/server";
import { pokemon, rulesHtml, schedule, seasons, stats, teamPokemon, teams } from "@/lib/mock-data";

export async function getSeasons() {
  if (!hasSupabaseEnv()) return seasons;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("seasons").select("*").order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id, name: row.name, draftBudget: row.draft_budget,
    activeSeason: row.active_season, archived: row.archived, createdAt: row.created_at
  }));
}

export async function getActiveSeason() {
  const all = await getSeasons();
  return all.find((season) => season.activeSeason) ?? all[0];
}

export async function getTeams(seasonId?: string) {
  if (!hasSupabaseEnv()) return teams.filter((team) => !seasonId || team.seasonId === seasonId);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("teams").select("*, coach:coaches(*)")
    .eq("season_id", seasonId ?? (await getActiveSeason()).id)
    .order("wins", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id, seasonId: row.season_id, coachId: row.coach_id,
    teamName: row.team_name, logoUrl: row.logo_url, wins: row.wins, losses: row.losses,
    coach: row.coach
      ? { id: row.coach.id, name: row.coach.name, imageUrl: row.coach.image_url, bio: row.coach.bio }
      : undefined
  }));
}

export async function getTeam(id: string) {
  const all = await getTeams();
  return all.find((team) => team.id === id) ?? teams.find((team) => team.id === id);
}

export async function getPokemon() {
  if (!hasSupabaseEnv()) return pokemon;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("pokemon").select("*").order("point_value", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id, dexNumber: row.dex_number, name: row.name, spriteUrl: row.sprite_url,
    primaryType: row.primary_type, secondaryType: row.secondary_type,
    hp: row.hp, attack: row.attack, defense: row.defense,
    specialAttack: row.special_attack, specialDefense: row.special_defense,
    speed: row.speed, bst: row.bst, pointValue: row.point_value,
    legendary: row.legendary, mythical: row.mythical, paradox: row.paradox
  }));
}

export async function getRoster(teamId: string) {
  if (!hasSupabaseEnv()) return teamPokemon.filter((slot) => slot.teamId === teamId);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("team_pokemon").select("*, pokemon(*)")
    .eq("team_id", teamId)
    .order("slot_order", { ascending: true });
  return (data ?? []).map((row) => ({
    id: row.id, seasonId: row.season_id, teamId: row.team_id, pokemonId: row.pokemon_id,
    pokemon: row.pokemon ? {
      id: row.pokemon.id, dexNumber: row.pokemon.dex_number, name: row.pokemon.name,
      spriteUrl: row.pokemon.sprite_url, primaryType: row.pokemon.primary_type,
      secondaryType: row.pokemon.secondary_type, hp: row.pokemon.hp,
      attack: row.pokemon.attack, defense: row.pokemon.defense,
      specialAttack: row.pokemon.special_attack, specialDefense: row.pokemon.special_defense,
      speed: row.pokemon.speed, bst: row.pokemon.bst, pointValue: row.pokemon.point_value,
      legendary: row.pokemon.legendary, mythical: row.pokemon.mythical, paradox: row.pokemon.paradox
    } : undefined
  }));
}

export async function getSchedule(seasonId: string) {
  if (!hasSupabaseEnv()) return schedule.filter((match) => match.seasonId === seasonId).map((match) => ({
    ...match, bo3Score: match.bo3Score ?? null, homeDiff: match.homeDiff ?? 0,
    awayDiff: match.awayDiff ?? 0, isBye: false,
  }));
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("schedule_matches").select("*").eq("season_id", seasonId).order("week");
  return (data ?? []).map((row) => ({
    id: row.id, seasonId: row.season_id, week: row.week,
    homeTeam: row.home_team, awayTeam: row.away_team,
    winner: row.winner, bo3Score: row.bo3_score ?? null,
    homeDiff: row.home_diff ?? 0, awayDiff: row.away_diff ?? 0,
    isBye: row.is_bye ?? false,
    replay1: row.replay_1, replay2: row.replay_2, replay3: row.replay_3
  }));
}

export async function getStats(seasonId?: string) {
  if (!hasSupabaseEnv()) return stats.filter((row) => !seasonId || row.seasonId === seasonId);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("pokemon_stats").select("*, pokemon(*), team:teams(*)")
    .eq("season_id", seasonId ?? (await getActiveSeason()).id);
  return (data ?? []).map((row) => ({
    id: row.id, seasonId: row.season_id, pokemonId: row.pokemon_id, teamId: row.team_id,
    gamesPlayed: row.games_played, wins: row.wins, losses: row.losses, kos: row.kos, deaths: row.deaths,
    pokemon: row.pokemon ? {
      id: row.pokemon.id, dexNumber: row.pokemon.dex_number, name: row.pokemon.name,
      spriteUrl: row.pokemon.sprite_url, primaryType: row.pokemon.primary_type,
      secondaryType: row.pokemon.secondary_type, hp: row.pokemon.hp,
      attack: row.pokemon.attack, defense: row.pokemon.defense,
      specialAttack: row.pokemon.special_attack, specialDefense: row.pokemon.special_defense,
      speed: row.pokemon.speed, bst: row.pokemon.bst, pointValue: row.pokemon.point_value,
      legendary: row.pokemon.legendary, mythical: row.pokemon.mythical, paradox: row.pokemon.paradox
    } : undefined
  }));
}

export async function getRules() {
  const fallback = rulesHtml;
  if (!hasSupabaseEnv()) return fallback;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("league_rules").select("content").eq("id", "default").single();
  return data?.content ?? fallback;
}
