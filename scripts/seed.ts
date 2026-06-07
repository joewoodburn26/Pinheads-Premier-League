import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { coaches, pokemon, schedule, seasons, teams, teamPokemon, stats } from "../lib/mock-data";

async function main() {
  const supabase = createSupabaseAdminClient();

  for (const season of seasons) {
    await supabase.from("seasons").upsert({
      id: season.id,
      name: season.name,
      draft_budget: season.draftBudget,
      active_season: season.activeSeason,
      archived: season.archived,
      created_at: season.createdAt
    });
  }

  for (const coach of coaches) {
    await supabase.from("coaches").upsert({ id: coach.id, name: coach.name, image_url: coach.imageUrl, bio: coach.bio });
  }

  for (const team of teams) {
    await supabase.from("teams").upsert({
      id: team.id,
      season_id: team.seasonId,
      coach_id: team.coachId,
      team_name: team.teamName,
      logo_url: team.logoUrl,
      wins: team.wins,
      losses: team.losses
    });
  }

  for (const mon of pokemon) {
    await supabase.from("pokemon").upsert({
      id: mon.id,
      dex_number: mon.dexNumber,
      name: mon.name,
      sprite_url: mon.spriteUrl,
      primary_type: mon.primaryType,
      secondary_type: mon.secondaryType,
      hp: mon.hp,
      attack: mon.attack,
      defense: mon.defense,
      special_attack: mon.specialAttack,
      special_defense: mon.specialDefense,
      speed: mon.speed,
      bst: mon.bst,
      point_value: mon.pointValue,
      legendary: mon.legendary,
      mythical: mon.mythical,
      paradox: mon.paradox
    });
  }

  for (const slot of teamPokemon) {
    await supabase.from("team_pokemon").upsert({
      id: slot.id,
      season_id: slot.seasonId,
      team_id: slot.teamId,
      pokemon_id: slot.pokemonId
    });
  }

  for (const match of schedule) {
    await supabase.from("schedule_matches").upsert({
      id: match.id,
      season_id: match.seasonId,
      week: match.week,
      home_team: match.homeTeam,
      away_team: match.awayTeam,
      winner: match.winner,
      replay_1: match.replay1,
      replay_2: match.replay2,
      replay_3: match.replay3
    });
  }

  for (const row of stats) {
    await supabase.from("pokemon_stats").upsert({
      id: row.id,
      season_id: row.seasonId,
      pokemon_id: row.pokemonId,
      team_id: row.teamId,
      games_played: row.gamesPlayed,
      wins: row.wins,
      losses: row.losses,
      kos: row.kos,
      deaths: row.deaths
    });
  }

  console.log("Seed complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
