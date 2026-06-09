"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TypeBadge } from "@/components/type-badge";
import { multiplier, pokemonTypesFor } from "@/lib/type-chart";
import type { Pokemon, PokemonType, Team, TeamPokemon } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Nature = { name: string; plus: keyof StatBlock | null; minus: keyof StatBlock | null };
type StatBlock = { hp: number; attack: number; defense: number; specialAttack: number; specialDefense: number; speed: number };
type MoveCategory = "physical" | "special";
type Weather = "none" | "sun" | "rain" | "sand" | "snow";
type Terrain = "none" | "electric" | "grassy" | "misty" | "psychic";

// ─── Constants ────────────────────────────────────────────────────────────────

const NATURES: Nature[] = [
  { name: "Hardy",   plus: null,            minus: null            },
  { name: "Lonely",  plus: "attack",        minus: "defense"       },
  { name: "Brave",   plus: "attack",        minus: "speed"         },
  { name: "Adamant", plus: "attack",        minus: "specialAttack" },
  { name: "Naughty", plus: "attack",        minus: "specialDefense"},
  { name: "Bold",    plus: "defense",       minus: "attack"        },
  { name: "Docile",  plus: null,            minus: null            },
  { name: "Relaxed", plus: "defense",       minus: "speed"         },
  { name: "Impish",  plus: "defense",       minus: "specialAttack" },
  { name: "Lax",     plus: "defense",       minus: "specialDefense"},
  { name: "Timid",   plus: "speed",         minus: "attack"        },
  { name: "Hasty",   plus: "speed",         minus: "defense"       },
  { name: "Serious", plus: null,            minus: null            },
  { name: "Jolly",   plus: "speed",         minus: "specialAttack" },
  { name: "Naive",   plus: "speed",         minus: "specialDefense"},
  { name: "Modest",  plus: "specialAttack", minus: "attack"        },
  { name: "Mild",    plus: "specialAttack", minus: "defense"       },
  { name: "Quiet",   plus: "specialAttack", minus: "speed"         },
  { name: "Bashful", plus: null,            minus: null            },
  { name: "Rash",    plus: "specialAttack", minus: "specialDefense"},
  { name: "Calm",    plus: "specialDefense",minus: "attack"        },
  { name: "Gentle",  plus: "specialDefense",minus: "defense"       },
  { name: "Sassy",   plus: "specialDefense",minus: "speed"         },
  { name: "Careful", plus: "specialDefense",minus: "specialAttack" },
  { name: "Quirky",  plus: null,            minus: null            },
];

const STAT_STAGES = [-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6];
const STAGE_MULT: Record<number, [number,number]> = {
  "-6":[2,8],"-5":[2,7],"-4":[2,6],"-3":[2,5],"-2":[2,4],"-1":[2,3],
  "0":[2,2],
  "1":[3,2],"2":[4,2],"3":[5,2],"4":[6,2],"5":[7,2],"6":[8,2],
};

// ─── Stat calculation (Gen 8/9 formula) ──────────────────────────────────────

function calcStat(
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: Nature,
  statKey: keyof StatBlock
): number {
  if (statKey === "hp") {
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
  }
  const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  const natMult = nature.plus === statKey ? 1.1 : nature.minus === statKey ? 0.9 : 1.0;
  return Math.floor(raw * natMult);
}

function applyStage(stat: number, stage: number): number {
  const [num, den] = STAGE_MULT[stage];
  return Math.floor(stat * num / den);
}

// ─── Damage formula (Gen 8/9) ────────────────────────────────────────────────

interface CalcInput {
  attackerPokemon: Pokemon;
  defenderPokemon: Pokemon;
  attackerEvs: StatBlock;
  attackerIvs: StatBlock;
  defenderEvs: StatBlock;
  defenderIvs: StatBlock;
  attackerNature: Nature;
  defenderNature: Nature;
  attackerStage: number;
  defenderStage: number;
  level: number;
  movePower: number;
  moveCategory: MoveCategory;
  moveType: PokemonType;
  isCrit: boolean;
  weather: Weather;
  terrain: Terrain;
  isBurned: boolean;
  hasStab: boolean;
  screens: boolean; // reflect/light screen
}

function calcDamage(input: CalcInput): { min: number; max: number; hpStat: number } {
  const {
    attackerPokemon, defenderPokemon,
    attackerEvs, attackerIvs, defenderEvs, defenderIvs,
    attackerNature, defenderNature,
    attackerStage, defenderStage,
    level, movePower, moveCategory, moveType,
    isCrit, weather, terrain, isBurned, hasStab, screens,
  } = input;

  const atkStat = moveCategory === "physical" ? "attack" : "specialAttack";
  const defStat = moveCategory === "physical" ? "defense" : "specialDefense";

  const rawAtk = calcStat(attackerPokemon[atkStat], attackerIvs[atkStat], attackerEvs[atkStat], level, attackerNature, atkStat);
  const rawDef = calcStat(defenderPokemon[defStat], defenderIvs[defStat], defenderEvs[defStat], level, defenderNature, defStat);
  const hpStat = calcStat(defenderPokemon.hp, defenderIvs.hp, defenderEvs.hp, level, defenderNature, "hp");

  // Apply stat stages (crits ignore negative atk / positive def stages)
  const effAtk = applyStage(rawAtk, isCrit ? Math.max(0, attackerStage) : attackerStage);
  const effDef = applyStage(rawDef, isCrit ? Math.min(0, defenderStage) : defenderStage);

  // Base damage
  let base = Math.floor(Math.floor((Math.floor(2 * level / 5 + 2) * movePower * effAtk) / effDef) / 50) + 2;

  // Weather modifier
  if (weather === "sun")  base = moveType === "Fire" ? Math.floor(base * 1.5) : moveType === "Water" ? Math.floor(base * 0.5) : base;
  if (weather === "rain") base = moveType === "Water" ? Math.floor(base * 1.5) : moveType === "Fire" ? Math.floor(base * 0.5) : base;

  // Crit
  if (isCrit) base = Math.floor(base * 1.5);

  // Screens (halved, unless crit)
  if (screens && !isCrit) base = Math.floor(base * 0.5);

  // Burn (physical only, unless Guts ability — we skip ability here)
  if (isBurned && moveCategory === "physical") base = Math.floor(base * 0.5);

  // STAB
  if (hasStab) base = Math.floor(base * 1.5);

  // Terrain
  if (terrain === "electric" && moveType === "Electric") base = Math.floor(base * 1.3);
  if (terrain === "grassy"   && moveType === "Grass")    base = Math.floor(base * 1.3);
  if (terrain === "psychic"  && moveType === "Psychic")  base = Math.floor(base * 1.3);
  if (terrain === "misty"    && moveType === "Dragon")   base = Math.floor(base * 0.5);

  // Type effectiveness
  const defenderTypes = pokemonTypesFor(defenderPokemon);
  const typeMult = multiplier(moveType, defenderTypes);
  base = Math.floor(base * typeMult);

  // Random roll: 0.85–1.00
  const min = Math.floor(base * 0.85);
  const max = base;

  return { min, max, hpStat };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatRow({
  label,
  base,
  ev, setEv,
  iv, setIv,
  calculated,
  stage, setStage,
  showStage,
}: {
  label: string;
  base: number;
  ev: number; setEv: (v: number) => void;
  iv: number; setIv: (v: number) => void;
  calculated: number;
  stage?: number; setStage?: (v: number) => void;
  showStage?: boolean;
}) {
  return (
    <div className="grid grid-cols-[60px_50px_50px_50px_60px_80px] gap-1 items-center text-xs">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="text-center font-mono">{base}</span>
      <Input
        type="number" min={0} max={31} value={iv}
        onChange={(e) => setIv(Math.min(31, Math.max(0, Number(e.target.value))))}
        className="h-7 px-1 text-center text-xs"
      />
      <Input
        type="number" min={0} max={252} step={4} value={ev}
        onChange={(e) => setEv(Math.min(252, Math.max(0, Number(e.target.value))))}
        className="h-7 px-1 text-center text-xs"
      />
      <span className="text-center font-mono font-bold">{calculated}</span>
      {showStage && setStage ? (
        <select
          value={stage ?? 0}
          onChange={(e) => setStage(Number(e.target.value))}
          className="h-7 rounded border bg-background text-xs px-1"
        >
          {STAT_STAGES.map((s) => (
            <option key={s} value={s}>{s > 0 ? `+${s}` : s}</option>
          ))}
        </select>
      ) : <span />}
    </div>
  );
}

// ─── Pokemon selector panel ───────────────────────────────────────────────────

interface PokemonConfig {
  pokemon: Pokemon | null;
  evs: StatBlock;
  ivs: StatBlock;
  nature: Nature;
  atkStage: number;
  defStage: number;
  isBurned: boolean;
  screens: boolean;
}

const DEFAULT_EVS: StatBlock = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
const DEFAULT_IVS: StatBlock = { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 };

function defaultConfig(): PokemonConfig {
  return { pokemon: null, evs: { ...DEFAULT_EVS }, ivs: { ...DEFAULT_IVS }, nature: NATURES[0], atkStage: 0, defStage: 0, isBurned: false, screens: false };
}

function PokemonPanel({
  label,
  config,
  onChange,
  allPokemon,
  teams,
  rosters,
  level,
  isAttacker,
}: {
  label: string;
  config: PokemonConfig;
  onChange: (c: PokemonConfig) => void;
  allPokemon: Pokemon[];
  teams: Team[];
  rosters: Record<string, Pokemon[]>;
  level: number;
  isAttacker: boolean;
}) {
  const [teamFilter, setTeamFilter] = useState<string>("all");

  const availablePokemon = teamFilter === "all"
    ? allPokemon
    : (rosters[teamFilter] ?? []);

  const mon = config.pokemon;
  const nat = config.nature;

  function setEv(key: keyof StatBlock, v: number) {
    onChange({ ...config, evs: { ...config.evs, [key]: v } });
  }
  function setIv(key: keyof StatBlock, v: number) {
    onChange({ ...config, ivs: { ...config.ivs, [key]: v } });
  }

  const statKeys: (keyof StatBlock)[] = ["hp","attack","defense","specialAttack","specialDefense","speed"];
  const statLabels: Record<keyof StatBlock, string> = {
    hp: "HP", attack: "Atk", defense: "Def",
    specialAttack: "Sp.Atk", specialDefense: "Sp.Def", speed: "Spe"
  };

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-black text-lg">{label}</h3>

      {/* Team filter */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter by Team</label>
        <select
          value={teamFilter}
          onChange={(e) => {
            setTeamFilter(e.target.value);
            onChange({ ...config, pokemon: null });
          }}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Pokémon</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.teamName}</option>
          ))}
        </select>
      </div>

      {/* Pokémon selector */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pokémon</label>
        <select
          value={mon?.id ?? ""}
          onChange={(e) => {
            const found = allPokemon.find((p) => p.id === e.target.value) ?? null;
            onChange({ ...config, pokemon: found });
          }}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— Select —</option>
          {availablePokemon.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {mon && (
        <>
          {/* Sprite + types */}
          <div className="flex items-center gap-3">
            <Image src={mon.spriteUrl} alt={mon.name} width={64} height={64} className="size-14 object-contain" />
            <div>
              <p className="font-bold">{mon.name}</p>
              <div className="flex gap-1 mt-1">
                {pokemonTypesFor(mon).map((t) => <TypeBadge key={t} type={t} />)}
              </div>
            </div>
          </div>

          {/* Nature */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nature</label>
            <select
              value={nat.name}
              onChange={(e) => {
                const found = NATURES.find((n) => n.name === e.target.value) ?? NATURES[0];
                onChange({ ...config, nature: found });
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {NATURES.map((n) => (
                <option key={n.name} value={n.name}>
                  {n.name}{n.plus ? ` (+${statLabels[n.plus]}, -${statLabels[n.minus!]})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Stat table */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-[60px_50px_50px_50px_60px_80px] gap-1 text-xs font-semibold text-muted-foreground">
              <span>Stat</span>
              <span className="text-center">Base</span>
              <span className="text-center">IV</span>
              <span className="text-center">EV</span>
              <span className="text-center">Final</span>
              <span className="text-center">Stage</span>
            </div>
            {statKeys.map((key) => {
              const calc = calcStat(mon[key], config.ivs[key], config.evs[key], level, nat, key);
              return (
                <StatRow
                  key={key}
                  label={statLabels[key]}
                  base={mon[key]}
                  iv={config.ivs[key]} setIv={(v) => setIv(key, v)}
                  ev={config.evs[key]} setEv={(v) => setEv(key, v)}
                  calculated={calc}
                  stage={key === "attack" || key === "specialAttack" ? config.atkStage : config.defStage}
                  setStage={key === "attack" || key === "specialAttack"
                    ? (v) => onChange({ ...config, atkStage: v })
                    : (v) => onChange({ ...config, defStage: v })
                  }
                  showStage={key !== "hp" && key !== "speed"}
                />
              );
            })}
          </div>

          {/* Status */}
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={config.isBurned}
                onChange={(e) => onChange({ ...config, isBurned: e.target.checked })}
              />
              Burned
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={config.screens}
                onChange={(e) => onChange({ ...config, screens: e.target.checked })}
              />
              {isAttacker ? "Helping Hand" : "Reflect / Light Screen"}
            </label>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DamageCalculator({
  pokemon,
  teams,
  rosters,
}: {
  pokemon: Pokemon[];
  teams: Team[];
  rosters: Record<string, Pokemon[]>;
}) {
  const [attacker, setAttacker] = useState<PokemonConfig>(defaultConfig());
  const [defender, setDefender] = useState<PokemonConfig>(defaultConfig());

  // Move settings
  const [movePower, setMovePower]       = useState(80);
  const [moveCategory, setMoveCategory] = useState<MoveCategory>("physical");
  const [moveType, setMoveType]         = useState<PokemonType>("Normal");
  const [isCrit, setIsCrit]             = useState(false);
  const [level, setLevel]               = useState(50);

  // Field
  const [weather, setWeather]   = useState<Weather>("none");
  const [terrain, setTerrain]   = useState<Terrain>("none");

  // Auto-detect STAB
  const hasStab = attacker.pokemon
    ? pokemonTypesFor(attacker.pokemon).includes(moveType)
    : false;

  const result = useMemo(() => {
    if (!attacker.pokemon || !defender.pokemon) return null;
    return calcDamage({
      attackerPokemon: attacker.pokemon,
      defenderPokemon: defender.pokemon,
      attackerEvs: attacker.evs,
      attackerIvs: attacker.ivs,
      defenderEvs: defender.evs,
      defenderIvs: defender.ivs,
      attackerNature: attacker.nature,
      defenderNature: defender.nature,
      attackerStage: attacker.atkStage,
      defenderStage: defender.defStage,
      level,
      movePower,
      moveCategory,
      moveType,
      isCrit,
      weather,
      terrain,
      isBurned: attacker.isBurned,
      hasStab,
      screens: defender.screens,
    });
  }, [attacker, defender, level, movePower, moveCategory, moveType, isCrit, weather, terrain, hasStab]);

  const typeMult = attacker.pokemon && defender.pokemon
    ? multiplier(moveType, pokemonTypesFor(defender.pokemon))
    : 1;

  const typeLabel = typeMult === 0 ? "No effect (0×)" :
    typeMult === 4 ? "Super effective (4×)" :
    typeMult === 2 ? "Super effective (2×)" :
    typeMult === 0.5 ? "Not very effective (½×)" :
    typeMult === 0.25 ? "Not very effective (¼×)" : "Normal (1×)";

  const typeColor = typeMult > 1 ? "text-green-400" : typeMult === 0 ? "text-gray-400" : typeMult < 1 ? "text-red-400" : "text-foreground";

  return (
    <div className="space-y-6">

      {/* Field conditions */}
      <Card className="p-4">
        <h3 className="mb-3 font-bold">Field Conditions</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Level</span>
            <Input type="number" min={1} max={100} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weather</span>
            <select
              value={weather}
              onChange={(e) => setWeather(e.target.value as Weather)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="none">None</option>
              <option value="sun">Sun</option>
              <option value="rain">Rain</option>
              <option value="sand">Sand</option>
              <option value="snow">Snow</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Terrain</span>
            <select
              value={terrain}
              onChange={(e) => setTerrain(e.target.value as Terrain)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="none">None</option>
              <option value="electric">Electric</option>
              <option value="grassy">Grassy</option>
              <option value="misty">Misty</option>
              <option value="psychic">Psychic</option>
            </select>
          </label>
        </div>
      </Card>

      {/* Pokémon panels */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PokemonPanel
          label="⚔️ Attacker"
          config={attacker}
          onChange={setAttacker}
          allPokemon={pokemon}
          teams={teams}
          rosters={rosters}
          level={level}
          isAttacker
        />
        <PokemonPanel
          label="🛡️ Defender"
          config={defender}
          onChange={setDefender}
          allPokemon={pokemon}
          teams={teams}
          rosters={rosters}
          level={level}
          isAttacker={false}
        />
      </div>

      {/* Move settings */}
      <Card className="p-4">
        <h3 className="mb-3 font-bold">Move</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base Power</span>
            <Input type="number" min={1} max={250} value={movePower} onChange={(e) => setMovePower(Number(e.target.value))} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</span>
            <select
              value={moveCategory}
              onChange={(e) => setMoveCategory(e.target.value as MoveCategory)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="physical">Physical</option>
              <option value="special">Special</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Move Type {hasStab && <span className="text-yellow-400 ml-1">(STAB)</span>}
            </span>
            <select
              value={moveType}
              onChange={(e) => setMoveType(e.target.value as PokemonType)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              {(["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"] as PokemonType[]).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={isCrit} onChange={(e) => setIsCrit(e.target.checked)} />
              Critical Hit (1.5×)
            </label>
          </div>
        </div>
      </Card>

      {/* Result */}
      <Card className="p-5 space-y-4">
        <h2 className="text-xl font-black">Result</h2>
        {!result ? (
          <p className="text-muted-foreground">Select both a Pokémon to see damage output.</p>
        ) : (
          <>
            {/* Type effectiveness */}
            <p className={`text-sm font-semibold ${typeColor}`}>{typeLabel}</p>

            {/* Damage range */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Min Damage</p>
                <p className="text-2xl font-black">{result.min}</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Max Damage</p>
                <p className="text-2xl font-black">{result.max}</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Defender HP</p>
                <p className="text-2xl font-black">{result.hpStat}</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">% Range</p>
                <p className="text-2xl font-black">
                  {Math.floor(result.min / result.hpStat * 100)}–{Math.floor(result.max / result.hpStat * 100)}%
                </p>
              </div>
            </div>

            {/* KO chances */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-lg p-3 text-center ${result.max >= result.hpStat ? "bg-green-500/20 border border-green-500/40" : "bg-muted"}`}>
                <p className="text-xs text-muted-foreground">OHKO</p>
                <p className="text-lg font-black">
                  {result.max >= result.hpStat
                    ? result.min >= result.hpStat ? "Guaranteed" : "Possible"
                    : "No"}
                </p>
              </div>
              <div className={`rounded-lg p-3 text-center ${result.max * 2 >= result.hpStat ? "bg-yellow-500/20 border border-yellow-500/40" : "bg-muted"}`}>
                <p className="text-xs text-muted-foreground">2HKO</p>
                <p className="text-lg font-black">
                  {result.min * 2 >= result.hpStat ? "Guaranteed"
                    : result.max * 2 >= result.hpStat ? "Possible"
                    : "No"}
                </p>
              </div>
            </div>

            {/* Context */}
            <p className="text-xs text-muted-foreground">
              {attacker.pokemon?.name} → {defender.pokemon?.name} ·
              {` ${movePower} BP ${moveType} ${moveCategory}`}
              {hasStab ? " · STAB" : ""}
              {isCrit ? " · Crit" : ""}
              {weather !== "none" ? ` · ${weather}` : ""}
              {terrain !== "none" ? ` · ${terrain} terrain` : ""}
              {" · Level "}{level}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}