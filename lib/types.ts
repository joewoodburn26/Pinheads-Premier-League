export type Season = {
  id: string;
  name: string;
  draftBudget: number;
  activeSeason: boolean;
  archived: boolean;
  createdAt: string;
};

export type Coach = {
  id: string;
  name: string;
  imageUrl: string | null;
  bio: string | null;
};

export type Team = {
  id: string;
  seasonId: string;
  coachId: string;
  teamName: string;
  logoUrl: string | null;
  wins: number;
  losses: number;
  coach?: Coach;
};

export type Pokemon = {
  id: string;
  dexNumber: number;
  name: string;
  spriteUrl: string;
  primaryType: PokemonType;
  secondaryType: PokemonType | null;
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
  bst: number;
  pointValue: number;
  legendary: boolean;
  mythical: boolean;
  paradox: boolean;
};

export type TeamPokemon = {
  id: string;
  seasonId: string;
  teamId: string;
  pokemonId: string;
  pokemon?: Pokemon;
};

export type ScheduleMatch = {
  id: string;
  seasonId: string;
  week: number;
  homeTeam: string;
  awayTeam: string;
  winner: string | null;
  replay1: string | null;
  replay2: string | null;
  replay3: string | null;
};

export type PokemonStats = {
  id: string;
  seasonId: string;
  pokemonId: string;
  teamId: string | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  kos: number;
  deaths: number;
  pokemon?: Pokemon;
  team?: Team;
};

export type PokemonType =
  | "Normal"
  | "Fire"
  | "Water"
  | "Electric"
  | "Grass"
  | "Ice"
  | "Fighting"
  | "Poison"
  | "Ground"
  | "Flying"
  | "Psychic"
  | "Bug"
  | "Rock"
  | "Ghost"
  | "Dragon"
  | "Dark"
  | "Steel"
  | "Fairy";
