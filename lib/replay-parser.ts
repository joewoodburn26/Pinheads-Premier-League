// ── Showdown Battle Log Parser ─────────────────────────────────────────────
// Full indirect KO attribution:
// - Status conditions (poison, toxic, burn) → setter gets KO
// - Entry hazards (Stealth Rock, Spikes, Toxic Spikes) → setter gets KO
// - Weather (Sandstorm, Hail) → triggerer (move or ability) gets KO
// - Perish Song → user gets KO for the target only (not themselves)
// - Recoil → NO KO credit

export interface PokemonBattleStats {
  name: string;
  player: "p1" | "p2";
  gamesPlayed: number;
  kos: number;
  deaths: number;
  movesUsed: string[];
}

export interface ReplayParseResult {
  p1: string;
  p2: string;
  winner: string;
  format: string;
  pokemon: PokemonBattleStats[];
  gameCount: number;
  rawLog: string;
}

export function normalizePokemonName(name: string): string {
  name = name.trim();
  const formMap: Record<string, string> = {
    "-Hisui": "Hisuian ", "-Galar": "Galarian ",
    "-Alola": "Alolan ",  "-Paldea": "Paldean ",
  };
  for (const [suffix, prefix] of Object.entries(formMap)) {
    if (name.endsWith(suffix)) return `${prefix}${name.slice(0, -suffix.length)}`;
  }
  return name;
}

/** Extract player prefix and slot from a slot string like "p1a: Samurott" */
function parseSlot(slotStr: string): { player: "p1" | "p2"; slot: string } | null {
  const m = slotStr.match(/^(p[12])([a-z]):/);
  if (!m) return null;
  return { player: m[1] as "p1" | "p2", slot: m[1] + m[2] };
}

export function parseReplayLog(log: string, format: string): Omit<ReplayParseResult, "rawLog"> {
  const lines = log.split("\n");
  let p1 = "", p2 = "", winner = "", currentGame = 0;

  const statsMap = new Map<string, PokemonBattleStats>();
  const sentOutThisGame = new Set<string>();

  // slot -> { player, name }
  const slotToMon: Record<string, { player: "p1" | "p2"; name: string }> = {};

  // Indirect damage tracking - reset each game
  // slot -> who should get KO credit if this mon faints from indirect damage
  const statusSetter  = new Map<string, { player: "p1" | "p2"; name: string }>(); // slot -> setter
  const hazardSetter  = new Map<string, { player: "p1" | "p2"; name: string }>(); // "p1spikes" etc -> setter
  const weatherSetter = new Map<string, { player: "p1" | "p2"; name: string }>(); // "Sandstorm"|"Snow" -> setter
  const perishSong    = new Map<string, { player: "p1" | "p2"; name: string }>(); // slot -> perish song user

  // Last indirect damage source for a slot (for faint attribution)
  const lastIndirectSource = new Map<string, { player: "p1" | "p2"; name: string } | null>();

  function getKey(player: "p1" | "p2", name: string) { return `${player}|${name}`; }

  function getOrCreate(player: "p1" | "p2", name: string): PokemonBattleStats {
    const key = getKey(player, name);
    if (!statsMap.has(key)) {
      statsMap.set(key, { name, player, gamesPlayed: 0, kos: 0, deaths: 0, movesUsed: [] });
    }
    return statsMap.get(key)!;
  }

  function resetGameState() {
    sentOutThisGame.clear();
    statusSetter.clear();
    hazardSetter.clear();
    weatherSetter.clear();
    perishSong.clear();
    lastIndirectSource.clear();
    Object.keys(slotToMon).forEach(k => delete slotToMon[k]);
  }

  function getOpposingActive(player: "p1" | "p2"): { player: "p1" | "p2"; name: string } | null {
    const opp = player === "p1" ? "p2" : "p1";
    for (const [slot, mon] of Object.entries(slotToMon)) {
      if (slot.startsWith(opp)) return mon;
    }
    return null;
  }

  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length < 2) continue;
    const cmd = parts[1];

    // ── Players ──
    if (cmd === "player") {
      if (parts[2] === "p1") p1 = parts[3];
      if (parts[2] === "p2") p2 = parts[3];
    }

    // ── New game ──
    if (cmd === "clearpoke") {
      currentGame++;
      resetGameState();
    }

    // ── Switch / drag ──
    if (cmd === "switch" || cmd === "drag" || cmd === "replace") {
      const slotInfo = parseSlot(parts[2] ?? "");
      if (!slotInfo) continue;
      const species = normalizePokemonName((parts[3] ?? "").split(",")[0].trim());
      slotToMon[slotInfo.slot] = { player: slotInfo.player, name: species };
      const key = getKey(slotInfo.player, species);
      if (!sentOutThisGame.has(key)) {
        sentOutThisGame.add(key);
        getOrCreate(slotInfo.player, species).gamesPlayed++;
      }
      // Clear indirect source when switching (new mon comes in clean)
      lastIndirectSource.delete(slotInfo.slot);
    }

    // ── Move used ──
    if (cmd === "move") {
      const slotInfo = parseSlot(parts[2] ?? "");
      const moveName = parts[3];
      if (!slotInfo || !moveName) continue;
      const mon = slotToMon[slotInfo.slot];
      if (!mon) continue;
      const stats = getOrCreate(mon.player, mon.name);
      if (!stats.movesUsed.includes(moveName)) stats.movesUsed.push(moveName);

      // Track hazard setters
      const hazardMoves = ["Stealth Rock", "Spikes", "Toxic Spikes", "Sticky Web"];
      if (hazardMoves.includes(moveName)) {
        const oppPrefix = mon.player === "p1" ? "p2" : "p1";
        hazardSetter.set(`${oppPrefix}${moveName.replace(" ", "").toLowerCase()}`, mon);
      }

      // Track Perish Song
      if (moveName === "Perish Song") {
        // Will be applied to all active opponents - we'll handle in |-start|
        // Store caster for now
        perishSong.set(`caster`, mon);
      }
    }

    // ── Weather set ──
    if (cmd === "-weather") {
      const weather = parts[2]; // "Sandstorm", "Snow", "SunnyDay", "RainDance"
      const fromStr = parts[4] ?? ""; // "[from] ability: Sand Stream" or "[from] move: Sandstorm"
      const ofStr   = parts[5] ?? ""; // "[of] p1a: Tyranitar"

      if (weather && weather !== "none" && (fromStr.includes("ability") || fromStr.includes("move"))) {
        const slotInfo = parseSlot((ofStr.replace("[of] ", "") ?? "").trim() + " ");
        if (slotInfo) {
          const setter = slotToMon[slotInfo.slot];
          if (setter) weatherSetter.set(weather, setter);
        }
      }
    }

    // ── Status applied ──
    if (cmd === "-status") {
      // ||-status|p2a: Whimsicott|tox
      const targetSlotInfo = parseSlot(parts[2] ?? "");
      if (!targetSlotInfo) continue;
      // Who set it? Check [from] tags or attribute to opposing active mon
      const fromStr = parts[4] ?? "";
      const ofStr   = parts[5] ?? "";

      let setter: { player: "p1" | "p2"; name: string } | null = null;

      if (ofStr.includes("[of]")) {
        const si = parseSlot(ofStr.replace("[of] ", "").trim() + " ");
        if (si) setter = slotToMon[si.slot] ?? null;
      }
      if (!setter) {
        setter = getOpposingActive(targetSlotInfo.player);
      }

      if (setter) statusSetter.set(targetSlotInfo.slot, setter);
    }

    // ── Perish Song start on a target ──
    if (cmd === "-start") {
      // ||-start|p2a: Whimsicott|perish3
      const targetSlotInfo = parseSlot(parts[2] ?? "");
      const effect = parts[3] ?? "";
      if (targetSlotInfo && effect.startsWith("perish")) {
        const caster = perishSong.get("caster");
        if (caster) perishSong.set(targetSlotInfo.slot, caster);
      }
    }

    // ── Damage events — track indirect sources ──
    if (cmd === "-damage") {
      // ||-damage|p2a: Whimsicott|45/100 tox
      // ||-damage|p2a: Whimsicott|45/100|[from] Recoil  <- ignore
      // ||-damage|p2a: Whimsicott|45/100|[from] Stealth Rock
      // ||-damage|p2a: Whimsicott|45/100|[from] weather|[of] p1a: Tyranitar
      const targetSlotInfo = parseSlot(parts[2] ?? "");
      if (!targetSlotInfo) continue;

      const hpStr  = parts[3] ?? "";
      const fromStr = parts[4] ?? "";
      const ofStr   = parts[5] ?? "";

      // Recoil — no KO credit
      if (fromStr.includes("Recoil") || fromStr.includes("recoil")) {
        lastIndirectSource.set(targetSlotInfo.slot, null);
        continue;
      }

      // Hazard damage
      const hazardNames = ["Stealth Rock", "Spikes", "Toxic Spikes", "Sticky Web"];
      const hazardHit = hazardNames.find(h => fromStr.includes(h));
      if (hazardHit) {
        const key = `${targetSlotInfo.player}${hazardHit.replace(" ", "").toLowerCase()}`;
        const setter = hazardSetter.get(key) ?? null;
        lastIndirectSource.set(targetSlotInfo.slot, setter);
        continue;
      }

      // Weather damage
      const weatherTypes = ["Sandstorm", "Snow", "Hail"];
      const weatherHit = weatherTypes.find(w => fromStr.includes(w) || hpStr.includes(w.toLowerCase()));
      if (weatherHit || (fromStr.includes("weather"))) {
        // Check [of] tag first
        if (ofStr.includes("[of]")) {
          const si = parseSlot(ofStr.replace("[of] ", "").trim() + " ");
          if (si) {
            lastIndirectSource.set(targetSlotInfo.slot, slotToMon[si.slot] ?? null);
          }
        } else if (weatherHit) {
          lastIndirectSource.set(targetSlotInfo.slot, weatherSetter.get(weatherHit) ?? null);
        }
        continue;
      }

      // Status damage (tox, psn, brn in hp string)
      if (hpStr.match(/\b(tox|psn|brn)\b/) || fromStr.includes("poison") || fromStr.includes("burn")) {
        lastIndirectSource.set(targetSlotInfo.slot, statusSetter.get(targetSlotInfo.slot) ?? null);
        continue;
      }

      // Perish Song
      if (fromStr.includes("Perish Song") || fromStr.includes("perish")) {
        const caster = perishSong.get(targetSlotInfo.slot) ?? null;
        lastIndirectSource.set(targetSlotInfo.slot, caster);
        continue;
      }

      // Any other [from] source — indirect but unknown setter, no credit
      if (fromStr.includes("[from]")) {
        lastIndirectSource.set(targetSlotInfo.slot, null);
        continue;
      }

      // Direct damage — clear indirect source
      lastIndirectSource.delete(targetSlotInfo.slot);
    }

    // ── Faint ──
    if (cmd === "faint") {
      const slotInfo = parseSlot(parts[2] ?? "");
      if (!slotInfo) continue;
      const mon = slotToMon[slotInfo.slot];
      if (!mon) continue;

      // Death for the fainting mon
      getOrCreate(mon.player, mon.name).deaths++;

      // KO credit logic
      let koRecipient: { player: "p1" | "p2"; name: string } | null = null;

      if (lastIndirectSource.has(slotInfo.slot)) {
        // Indirect damage was last — use that setter (may be null for recoil)
        koRecipient = lastIndirectSource.get(slotInfo.slot) ?? null;

        // Perish Song: don't credit KO if the caster also fainted (same turn)
        // We just use whoever perish song caster is — they get credit even if fainted
      } else {
        // Direct damage — credit opposing active mon
        koRecipient = getOpposingActive(mon.player);
      }

      if (koRecipient) {
        getOrCreate(koRecipient.player, koRecipient.name).kos++;
      }

      // Clean up
      lastIndirectSource.delete(slotInfo.slot);
      statusSetter.delete(slotInfo.slot);
      perishSong.delete(slotInfo.slot);
    }

    // ── Winner ──
    if (cmd === "win") winner = parts[2];
  }

  if (currentGame === 0) currentGame = 1;

  return {
    p1, p2, winner, format,
    gameCount: currentGame,
    pokemon: Array.from(statsMap.values()),
  };
}

export async function fetchAndParseReplay(replayUrl: string): Promise<ReplayParseResult> {
  const jsonUrl = replayUrl.replace(/\/$/, "") + ".json";
  const res = await fetch(jsonUrl, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Failed to fetch replay: ${res.status}`);
  const data = await res.json();
  const log: string = data.log ?? "";
  const format: string = data.format ?? "";
  const parsed = parseReplayLog(log, format);
  return { ...parsed, p1: data.p1 ?? parsed.p1, p2: data.p2 ?? parsed.p2, rawLog: log };
}
