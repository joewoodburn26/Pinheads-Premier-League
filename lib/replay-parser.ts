// ── Showdown battle log parser ────────────────────────────────────────────────
// Reads one replay (one game) and works out, per Pokémon: games played, KOs, deaths.
//
// Species come from Showdown's switch-in details ("p1a: Chompy|Garchomp, L50"),
// so nicknames never matter.
//
// KO credit:
//  - Direct hits → the Pokémon whose move hit last (works in doubles too)
//  - Status (poison, toxic, burn) → whoever inflicted it (Toxic Spikes → its setter)
//  - Entry hazards → their setter
//  - Sand / Hail → whoever set the weather
//  - Perish Song → its user; Destiny Bond → its user
//  - Rocky Helmet, Rough Skin, Leech Seed, etc. → the Pokémon named as the source
//  - Self-KOs (Explosion, Memento, Final Gambit, recoil, Life Orb…) → nobody, death only

export interface PokemonBattleStats {
  name: string;
  player: "p1" | "p2";
  gamesPlayed: number;
  kos: number;
  deaths: number;
}

export interface ReplayParseResult {
  p1: string;
  p2: string;
  winner: string;
  /** Which side won ("" if unknown, e.g. a tie) */
  winnerSide: "p1" | "p2" | "";
  format: string;
  /** Pokémon each side brought (team size), for the battle differential */
  teamSize: { p1: number; p2: number };
  /** Pokémon left standing at the end */
  remaining: { p1: number; p2: number };
  pokemon: PokemonBattleStats[];
  gameCount: number;
}

type Side = "p1" | "p2";
type Mon = { player: Side; name: string };

/** Showdown species → our naming for regional formes ("Ninetales-Alola" → "Alolan Ninetales"). */
export function normalizePokemonName(name: string): string {
  name = name.trim();
  const formMap: Record<string, string> = {
    "-Hisui": "Hisuian ", "-Galar": "Galarian ",
    "-Alola": "Alolan ", "-Paldea": "Paldean ",
  };
  for (const [suffix, prefix] of Object.entries(formMap)) {
    if (name.endsWith(suffix)) return `${prefix}${name.slice(0, -suffix.length)}`;
  }
  return name;
}

/** "p1a: Samurott" → { player: "p1", slot: "p1a" } */
function parseSlot(slotStr: string): { player: Side; slot: string } | null {
  const m = slotStr.trim().match(/^(p[12])([a-z])?:/);
  if (!m) return null;
  return { player: m[1] as Side, slot: m[1] + (m[2] ?? "a") };
}

const SELF_KO_MOVES = new Set([
  "Explosion", "Self-Destruct", "Misty Explosion", "Memento", "Final Gambit",
  "Healing Wish", "Lunar Dance", "Shadow End",
]);
const HAZARDS = ["Stealth Rock", "Spikes", "Toxic Spikes", "Sticky Web", "G-Max Steelsurge"];
const hazardKey = (side: Side, hazard: string) => `${side}|${hazard.toLowerCase().replace(/[^a-z]/g, "")}`;
const opp = (s: Side): Side => (s === "p1" ? "p2" : "p1");

export function parseReplayLog(log: string, format: string): Omit<ReplayParseResult, "rawLog"> {
  const lines = log.split("\n");
  let p1 = "", p2 = "", winner = "", games = 0;
  const teamSize = { p1: 0, p2: 0 };
  const fainted = { p1: 0, p2: 0 };

  const stats = new Map<string, PokemonBattleStats>();
  const sentOut = new Set<string>();
  const slotToMon: Record<string, Mon> = {};
  /** Mega / forme changes: "p1|Charizard-Mega-X" → "Charizard" so it stays one Pokémon */
  const alias = new Map<string, string>();

  const statusSetter = new Map<string, Mon>();   // slot → who statused it
  const hazardSetter = new Map<string, Mon>();   // side|hazard → setter
  const weatherSetter = new Map<string, Mon>();  // weather → setter
  const perishCaster = new Map<string, Mon>();   // slot → Perish Song user
  /** Who should get the KO if this slot faints next: a Mon, or null for "nobody" */
  const lastHit = new Map<string, Mon | null>();
  let mover: { slot: string; mon: Mon; move: string } | null = null;
  let destinyBond: Mon | null = null;

  const key = (m: Mon) => `${m.player}|${m.name}`;
  const get = (m: Mon) => {
    let s = stats.get(key(m));
    if (!s) stats.set(key(m), (s = { name: m.name, player: m.player, gamesPlayed: 0, kos: 0, deaths: 0 }));
    return s;
  };
  const monAt = (slotStr: string): Mon | null => {
    const si = parseSlot(slotStr);
    return si ? slotToMon[si.slot] ?? null : null;
  };
  /** "[of] p2a: Ferrothorn" in any part of the line */
  const ofMon = (parts: string[]) => {
    const of = parts.find((p) => p.startsWith("[of]"));
    return of ? monAt(of.slice(4)) : null;
  };
  const firstActive = (side: Side): Mon | null => {
    for (const [slot, mon] of Object.entries(slotToMon)) if (slot.startsWith(side)) return mon;
    return null;
  };

  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length < 2) continue;
    const cmd = parts[1];

    switch (cmd) {
      case "player":
        if (parts[2] === "p1" && parts[3]) p1 = parts[3];
        if (parts[2] === "p2" && parts[3]) p2 = parts[3];
        break;

      case "teamsize":
        if (parts[2] === "p1" || parts[2] === "p2") teamSize[parts[2]] = Number(parts[3]) || 0;
        break;

      case "start":
        games++;
        break;

      case "turn":
      case "upkeep":
        mover = null;
        break;

      case "switch":
      case "drag":
      case "replace": {
        const si = parseSlot(parts[2] ?? "");
        if (!si) break;
        const raw = (parts[3] ?? "").split(",")[0].trim();
        const name = alias.get(`${si.player}|${raw}`) ?? raw;
        const mon = { player: si.player, name };
        slotToMon[si.slot] = mon;
        if (!sentOut.has(key(mon))) {
          sentOut.add(key(mon));
          get(mon).gamesPlayed = 1;
        }
        lastHit.delete(si.slot);
        statusSetter.delete(si.slot);
        perishCaster.delete(si.slot);
        mover = null; // anything that happens now is from entering the field (e.g. Toxic Spikes)
        break;
      }

      case "detailschange":
      case "-formechange": {
        // Mega Evolution / forme change: remember the new name maps to the same Pokémon
        const si = parseSlot(parts[2] ?? "");
        const mon = si ? slotToMon[si.slot] : undefined;
        if (si && mon) {
          const raw = (parts[3] ?? "").split(",")[0].trim();
          if (raw && raw !== mon.name) alias.set(`${si.player}|${raw}`, mon.name);
        }
        break;
      }

      case "move": {
        const si = parseSlot(parts[2] ?? "");
        const mon = si ? slotToMon[si.slot] : undefined;
        const move = parts[3] ?? "";
        if (!si || !mon) break;
        mover = { slot: si.slot, mon, move };
        if (HAZARDS.includes(move)) hazardSetter.set(hazardKey(opp(mon.player), move), mon);
        if (SELF_KO_MOVES.has(move)) lastHit.set(si.slot, null);
        break;
      }

      case "-weather": {
        const weather = parts[2];
        if (!weather || weather === "none") break;
        if (parts.some((p) => p === "[upkeep]")) break;
        const setter = ofMon(parts) ?? mover?.mon ?? null;
        if (setter) weatherSetter.set(weather, setter);
        break;
      }

      case "-status": {
        const si = parseSlot(parts[2] ?? "");
        if (!si) break;
        const status = parts[3] ?? "";
        let setter = ofMon(parts);
        if (!setter && mover && mover.mon.player !== si.player) setter = mover.mon;
        if (!setter && !mover && (status === "psn" || status === "tox")) {
          setter = hazardSetter.get(hazardKey(si.player, "Toxic Spikes")) ?? null;
        }
        if (!setter) setter = firstActive(opp(si.player));
        if (setter && setter.player !== si.player) statusSetter.set(si.slot, setter);
        break;
      }

      case "-start": {
        const si = parseSlot(parts[2] ?? "");
        if (si && (parts[3] ?? "").startsWith("perish") && mover) perishCaster.set(si.slot, mover.mon);
        break;
      }

      case "-activate": {
        if ((parts[3] ?? "").includes("Destiny Bond")) destinyBond = monAt(parts[2] ?? "");
        break;
      }

      case "-damage": {
        const si = parseSlot(parts[2] ?? "");
        if (!si) break;
        const target = slotToMon[si.slot];
        const from = parts.find((p) => p.startsWith("[from]")) ?? "";
        const hp = parts[3] ?? "";

        if (!from) {
          // Direct hit from the current move
          if (mover && mover.mon.player !== si.player) lastHit.set(si.slot, mover.mon);
          else if (mover && mover.slot === si.slot) lastHit.set(si.slot, null); // hurt itself (e.g. confusion)
          else if (mover) lastHit.set(si.slot, null); // hit by an ally
          break;
        }
        if (/recoil|life orb|mind blown|steel beam|struggle/i.test(from) || /recoil/i.test(hp)) {
          lastHit.set(si.slot, null);
          break;
        }
        const hazard = HAZARDS.find((h) => from.includes(h));
        if (hazard) {
          lastHit.set(si.slot, hazardSetter.get(hazardKey(si.player, hazard)) ?? null);
          break;
        }
        if (/Sandstorm|Hail/.test(from)) {
          const w = from.includes("Sandstorm") ? "Sandstorm" : "Hail";
          const setter = weatherSetter.get(w) ?? null;
          lastHit.set(si.slot, setter && setter.player !== si.player ? setter : null);
          break;
        }
        if (/psn|tox|brn/.test(from) || /\b(psn|tox|brn)\b/.test(hp)) {
          lastHit.set(si.slot, statusSetter.get(si.slot) ?? null);
          break;
        }
        if (/perish/i.test(from)) {
          const caster = perishCaster.get(si.slot) ?? null;
          lastHit.set(si.slot, caster && caster.player !== si.player ? caster : null);
          break;
        }
        // Rocky Helmet, Rough Skin, Leech Seed, Salt Cure, etc.: credit the named source
        const source = ofMon(parts);
        lastHit.set(si.slot, source && target && source.player !== target.player ? source : null);
        break;
      }

      case "faint": {
        const si = parseSlot(parts[2] ?? "");
        const mon = si ? slotToMon[si.slot] : undefined;
        if (!si || !mon) break;
        get(mon).deaths++;
        fainted[mon.player]++;

        let credit: Mon | null;
        if (destinyBond && destinyBond.player !== mon.player && !(mover && mover.slot === si.slot && SELF_KO_MOVES.has(mover.move))) {
          // The Pokémon that used Destiny Bond takes this one down with it
          credit = destinyBond.name === mon.name ? null : destinyBond;
          destinyBond = null;
        } else if (lastHit.has(si.slot)) {
          credit = lastHit.get(si.slot) ?? null;
        } else {
          credit = null;
        }
        if (credit && credit.player !== mon.player) get(credit).kos++;

        lastHit.delete(si.slot);
        statusSetter.delete(si.slot);
        perishCaster.delete(si.slot);
        break;
      }

      case "win":
        winner = parts[2] ?? "";
        break;
    }
  }

  // Teams that never sent everyone out (or old logs without |teamsize|)
  const brought = (side: Side) => Math.max(teamSize[side], [...stats.values()].filter((s) => s.player === side).length);
  const size = { p1: brought("p1"), p2: brought("p2") };

  return {
    p1, p2, winner, format,
    winnerSide: winner && winner === p1 ? "p1" : winner && winner === p2 ? "p2" : "",
    teamSize: size,
    remaining: { p1: Math.max(0, size.p1 - fainted.p1), p2: Math.max(0, size.p2 - fainted.p2) },
    gameCount: Math.max(1, games),
    pokemon: [...stats.values()],
  };
}

/** Showdown replay page → its JSON. Accepts "replay.pokemonshowdown.com/<id>" with or without https or ?p2 etc. */
export function replayJsonUrl(url: string): string | null {
  const m = /(?:https?:\/\/)?replay\.pokemonshowdown\.com\/([a-z0-9-]+)/i.exec(url.trim());
  return m ? `https://replay.pokemonshowdown.com/${m[1]}.json` : null;
}

export async function fetchAndParseReplay(replayUrl: string): Promise<ReplayParseResult & { rawLog: string }> {
  const jsonUrl = replayJsonUrl(replayUrl);
  if (!jsonUrl) throw new Error("That isn't a Showdown replay link.");
  const res = await fetch(jsonUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 404 ? "Showdown couldn't find that replay." : `Couldn't load the replay (${res.status}).`);
  const data = await res.json();
  const log: string = data.log ?? "";
  const parsed = parseReplayLog(log, data.format ?? data.formatid ?? "");
  const winnerSide = parsed.winnerSide || (parsed.winner && parsed.winner === data.p1 ? "p1" : parsed.winner && parsed.winner === data.p2 ? "p2" : "");
  return { ...parsed, p1: data.p1 ?? parsed.p1, p2: data.p2 ?? parsed.p2, winnerSide, rawLog: log };
}
