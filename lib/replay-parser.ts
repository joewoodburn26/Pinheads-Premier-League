// ── Showdown Battle Log Parser ─────────────────────────────────────────────
// Parses the raw log text from a Showdown replay .json file
// Log format reference: https://github.com/smogon/pokemon-showdown/blob/master/sim/SIM-PROTOCOL.md

export interface PokemonBattleStats {
  name: string;          // Pokemon name as it appears in the log
  player: "p1" | "p2";  // Which player owns this pokemon
  gamesPlayed: number;   // Number of games this pokemon was sent out
  kos: number;           // Number of KOs scored
  deaths: number;        // Number of times this pokemon fainted
  movesUsed: string[];   // List of unique moves used
}

export interface ReplayParseResult {
  p1: string;            // Player 1 username
  p2: string;            // Player 2 username
  winner: string;        // Winner username
  format: string;        // Battle format
  pokemon: PokemonBattleStats[];
  gameCount: number;     // Total games played (for Bo3)
  rawLog: string;
}

/**
 * Normalize a pokemon name from the battle log to match our database names.
 * Showdown uses formats like "Samurott-Hisui", we store as "Hisuian Samurott"
 */
export function normalizePokemonName(name: string): string {
  // Remove nickname if present (format: "Nickname|Species" or just species)
  // Showdown log uses the species name directly in most protocol messages
  name = name.trim();

  // Handle forme suffixes: "Samurott-Hisui" -> "Hisuian Samurott"
  const formMap: Record<string, string> = {
    "-Hisui": "Hisuian ",
    "-Galar": "Galarian ",
    "-Alola": "Alolan ",
    "-Paldea": "Paldean ",
  };

  for (const [suffix, prefix] of Object.entries(formMap)) {
    if (name.endsWith(suffix)) {
      const base = name.slice(0, -suffix.length);
      return `${prefix}${base}`;
    }
  }

  return name;
}

/**
 * Parse a Showdown battle log into structured stats per Pokémon.
 * Handles Bo3 series (multiple games in one log separated by |clearpoke|)
 */
export function parseReplayLog(log: string, format: string): Omit<ReplayParseResult, "rawLog"> {
  const lines = log.split("\n");

  let p1 = "";
  let p2 = "";
  let winner = "";
  let currentGame = 0;

  // Track per-pokemon stats across all games
  const statsMap = new Map<string, PokemonBattleStats>();

  // Track which pokemon are currently active/sent out in current game
  const sentOutThisGame = new Set<string>(); // to avoid double counting

  function getKey(player: "p1" | "p2", name: string) {
    return `${player}|${name}`;
  }

  function getOrCreate(player: "p1" | "p2", name: string): PokemonBattleStats {
    const key = getKey(player, name);
    if (!statsMap.has(key)) {
      statsMap.set(key, {
        name,
        player,
        gamesPlayed: 0,
        kos: 0,
        deaths: 0,
        movesUsed: [],
      });
    }
    return statsMap.get(key)!;
  }

  // Current active pokemon per slot (p1a, p1b, p2a, p2b)
  const slotToMon: Record<string, { player: "p1" | "p2"; name: string }> = {};

  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length < 2) continue;
    const cmd = parts[1];

    // ── Player names ──
    if (cmd === "player") {
      const playerNum = parts[2]; // p1 or p2
      const username = parts[3];
      if (playerNum === "p1") p1 = username;
      if (playerNum === "p2") p2 = username;
    }

    // ── Game boundary — new game starts ──
    if (cmd === "clearpoke" || cmd === "gametype") {
      if (cmd === "clearpoke") {
        currentGame++;
        sentOutThisGame.clear();
        Object.keys(slotToMon).forEach(k => delete slotToMon[k]);
      }
    }

    // ── Pokemon sent out / switched in ──
    if (cmd === "switch" || cmd === "drag" || cmd === "replace") {
      // |switch|p1a: Samurott|Samurott-Hisui, L50, M|100/100
      const slotStr = parts[2]; // e.g. "p1a: Samurott"
      const speciesStr = parts[3]; // e.g. "Samurott-Hisui, L50, M"

      if (!slotStr || !speciesStr) continue;

      const playerMatch = slotStr.match(/^(p[12])[a-z]/);
      if (!playerMatch) continue;
      const player = playerMatch[1] as "p1" | "p2";
      const slot = slotStr.split(":")[0]; // "p1a"

      // Species is before the first comma
      const species = normalizePokemonName(speciesStr.split(",")[0].trim());

      slotToMon[slot] = { player, name: species };

      const key = getKey(player, species);
      if (!sentOutThisGame.has(key)) {
        sentOutThisGame.add(key);
        const stats = getOrCreate(player, species);
        stats.gamesPlayed++;
      }
    }

    // ── Move used ──
    if (cmd === "move") {
      // |move|p1a: Samurott|Ceaseless Edge|p2a: Garchomp
      const slotStr = parts[2];
      const moveName = parts[3];

      if (!slotStr || !moveName) continue;
      const slot = slotStr.split(":")[0];
      const mon = slotToMon[slot];
      if (!mon) continue;

      const stats = getOrCreate(mon.player, mon.name);
      if (!stats.movesUsed.includes(moveName)) {
        stats.movesUsed.push(moveName);
      }
    }

    // ── Faint ──
    if (cmd === "faint") {
      // |faint|p2a: Garchomp
      const slotStr = parts[2];
      if (!slotStr) continue;
      const slot = slotStr.split(":")[0];
      const mon = slotToMon[slot];
      if (!mon) continue;

      // The fainting pokemon gets a death
      const faintStats = getOrCreate(mon.player, mon.name);
      faintStats.deaths++;

      // The OTHER player's active pokemon gets a KO
      // Find who is responsible (last pokemon that used a move against this slot)
      // Simple heuristic: the opposing active mon gets credit
      const opposingPrefix = mon.player === "p1" ? "p2" : "p1";
      for (const [slot2, mon2] of Object.entries(slotToMon)) {
        if (slot2.startsWith(opposingPrefix) && slot2 !== slot) {
          const koStats = getOrCreate(mon2.player, mon2.name);
          koStats.kos++;
          break;
        }
      }
    }

    // ── Winner ──
    if (cmd === "win") {
      winner = parts[2];
    }
  }

  // If currentGame is 0, it was a single game (no clearpoke boundary)
  if (currentGame === 0) currentGame = 1;

  return {
    p1,
    p2,
    winner,
    format,
    gameCount: currentGame,
    pokemon: Array.from(statsMap.values()),
  };
}

/**
 * Fetch a Showdown replay and parse it.
 * replayUrl: full URL like https://replay.pokemonshowdown.com/gen9nationaldex-2521472800
 */
export async function fetchAndParseReplay(replayUrl: string): Promise<ReplayParseResult> {
  // Strip trailing slash, add .json
  const jsonUrl = replayUrl.replace(/\/$/, "") + ".json";

  const res = await fetch(jsonUrl, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Failed to fetch replay: ${res.status}`);

  const data = await res.json();
  // Showdown JSON has: { id, p1, p2, format, log, uploadtime, ... }
  const log: string = data.log ?? "";
  const format: string = data.format ?? "";

  const parsed = parseReplayLog(log, format);

  // Showdown JSON also gives us p1/p2 directly
  return {
    ...parsed,
    p1: data.p1 ?? parsed.p1,
    p2: data.p2 ?? parsed.p2,
    rawLog: log,
  };
}
