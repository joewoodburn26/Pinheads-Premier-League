"use client";

import Image from "next/image";
import { useState } from "react";
import { Zap, Shield, Swords } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TypeBadge } from "@/components/type-badge";
import { pokemonTypesFor } from "@/lib/type-chart";
import {
  calculateDamage, calcHp, calcStat, applyStage, getEffectiveSpeed,
  type CalcPokemon, type Move, type FieldConditions,
  type Weather, type Terrain, type Status, type MoveCategory,
} from "@/lib/calc-engine";
import { NATURES, ITEMS, ABILITIES, type Nature } from "@/lib/calc-data";
import type { Pokemon, Team } from "@/lib/types";
import type { PokemonType } from "@/lib/types";

// ─── PokéAPI move fetching ────────────────────────────────────────────────────

interface ApiMove {
  name: string;
  power: number | null;
  type: string;
  category: MoveCategory;
  priority: number;
  makesContact: boolean;
}

const moveCache: Record<number, ApiMove[]> = {};

async function fetchMoves(dexNumber: number): Promise<ApiMove[]> {
  if (moveCache[dexNumber]) return moveCache[dexNumber];
  try {
    // Get learnset
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${dexNumber}`);
    const data = await res.json();
    const moveNames: string[] = (data.moves as { move: { name: string } }[]).map((m) => m.move.name);

    // Fetch move details in parallel (batch of 20 at a time)
    const details: ApiMove[] = [];
    const batchSize = 20;
    for (let i = 0; i < Math.min(moveNames.length, 200); i += batchSize) {
      const batch = moveNames.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (name) => {
          try {
            const r = await fetch(`https://pokeapi.co/api/v2/move/${name}`);
            const m = await r.json() as {
              name: string;
              power: number | null;
              damage_class?: { name: string };
              type?: { name: string };
              priority?: number;
              meta?: { category?: { name?: string } };
            };
            if (m.power === null || m.damage_class?.name === "status") return null;
            return {
              name: m.name.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
              power: m.power,
              type: (m.type ? m.type.name.charAt(0).toUpperCase() + m.type.name.slice(1) : "Normal") as PokemonType,
              category: m.damage_class?.name as MoveCategory,
              priority: m.priority ?? 0,
              makesContact: m.meta?.category?.name?.includes("damage") ?? false,
            } as ApiMove;
          } catch { return null; }
        })
      );
      details.push(...results.filter(Boolean) as ApiMove[]);
    }

    // Sort by name
    details.sort((a, b) => a.name.localeCompare(b.name));
    moveCache[dexNumber] = details;
    return details;
  } catch {
    return [];
  }
}

// ─── Default pokemon config ───────────────────────────────────────────────────

interface PokemonConfig {
  pokemon: Pokemon | null;
  nature: Nature;
  evHp: number; evAtk: number; evDef: number; evSpA: number; evSpD: number; evSpe: number;
  ivHp: number; ivAtk: number; ivDef: number; ivSpA: number; ivSpD: number; ivSpe: number;
  atkStage: number; defStage: number; spAStage: number; spDStage: number; speStage: number;
  status: Status;
  item: string;
  ability: string;
  reflect: boolean;
  lightScreen: boolean;
  auroraVeil: boolean;
  tailwind: boolean;
  helpingHand: boolean;
  isCrit: boolean;
  moves: ApiMove[];
  loadingMoves: boolean;
}

function defaultConfig(): PokemonConfig {
  return {
    pokemon: null,
    nature: NATURES.find(n => n.name === "Hardy")!,
    evHp:0, evAtk:0, evDef:0, evSpA:0, evSpD:0, evSpe:0,
    ivHp:31, ivAtk:31, ivDef:31, ivSpA:31, ivSpD:31, ivSpe:31,
    atkStage:0, defStage:0, spAStage:0, spDStage:0, speStage:0,
    status: "none",
    item: "None",
    ability: "None",
    moves: [],
    loadingMoves: false,
    reflect: false, lightScreen: false, auroraVeil: false,
    tailwind: false, helpingHand: false, isCrit: false,
  };
}

function buildCalcPokemon(config: PokemonConfig, level: number): CalcPokemon | null {
  const p = config.pokemon;
  if (!p) return null;
  const n = config.nature;
  const hp  = calcHp(p.hp,  config.ivHp,  config.evHp,  level);
  const atk = calcStat(p.attack,         config.ivAtk, config.evAtk, level, n.atk);
  const def = calcStat(p.defense,        config.ivDef, config.evDef, level, n.def);
  const spA = calcStat(p.specialAttack,  config.ivSpA, config.evSpA, level, n.spA);
  const spD = calcStat(p.specialDefense, config.ivSpD, config.evSpD, level, n.spD);
  const spe = calcStat(p.speed,          config.ivSpe, config.evSpe, level, n.spe);

  return {
    name: p.name,
    types: pokemonTypesFor(p),
    baseHp: p.hp, baseAtk: p.attack, baseDef: p.defense,
    baseSpA: p.specialAttack, baseSpD: p.specialDefense, baseSpe: p.speed,
    hp, atk, def, spA, spD, spe,
    atkStage: config.atkStage, defStage: config.defStage,
    spAStage: config.spAStage, spDStage: config.spDStage, speStage: config.speStage,
    status: config.status,
    item: config.item,
    ability: config.ability,
    reflect: config.reflect, lightScreen: config.lightScreen, auroraVeil: config.auroraVeil,
    tailwind: config.tailwind, helpingHand: config.helpingHand,
    isCrit: config.isCrit,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const STAGES = [-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6];

function StageSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="h-7 rounded border bg-background text-xs px-1 w-16"
    >
      {STAGES.map(s => (
        <option key={s} value={s}>{s > 0 ? `+${s}` : s === 0 ? "0" : s}</option>
      ))}
    </select>
  );
}

function StatRow({
  label, base, iv, ev, onIv, onEv, calc, stage, onStage, showStage,
  natureEffect,
}: {
  label: string; base: number; iv: number; ev: number;
  onIv: (v: number) => void; onEv: (v: number) => void;
  calc: number; stage?: number; onStage?: (v: number) => void;
  showStage?: boolean; natureEffect?: number;
}) {
  const color = natureEffect === 1.1 ? "text-green-400" : natureEffect === 0.9 ? "text-red-400" : "";
  return (
    <div className="grid grid-cols-[44px_40px_48px_52px_48px_72px] gap-1 items-center text-xs">
      <span className={`font-semibold text-right ${color}`}>{label}</span>
      <span className="text-center font-mono text-muted-foreground">{base}</span>
      <Input type="number" min={0} max={31} value={iv}
        onChange={e => onIv(Math.min(31,Math.max(0,Number(e.target.value))))}
        className="h-7 px-1 text-center text-xs" />
      <Input type="number" min={0} max={252} step={4} value={ev}
        onChange={e => onEv(Math.min(252,Math.max(0,Number(e.target.value))))}
        className="h-7 px-1 text-center text-xs" />
      <span className={`text-center font-mono font-bold ${color}`}>{calc}</span>
      {showStage && onStage ? <StageSelect value={stage ?? 0} onChange={onStage} /> : <span />}
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="rounded" />
      {label}
    </label>
  );
}

function PokemonPanel({
  label, config, onChange, allPokemon, teams, rosters, level, isAttacker,
}: {
  label: string;
  config: PokemonConfig;
  onChange: (c: Partial<PokemonConfig>) => void;
  allPokemon: Pokemon[];
  teams: Team[];
  rosters: Record<string, Pokemon[]>;
  level: number;
  isAttacker: boolean;
}) {
  const [teamFilter, setTeamFilter] = useState("all");

  const available = teamFilter === "all" ? allPokemon : (rosters[teamFilter] ?? []);
  const p = config.pokemon;
  const n = config.nature;

  const calcedHp  = p ? calcHp(p.hp, config.ivHp, config.evHp, level) : 0;
  const calcedAtk = p ? calcStat(p.attack, config.ivAtk, config.evAtk, level, n.atk) : 0;
  const calcedDef = p ? calcStat(p.defense, config.ivDef, config.evDef, level, n.def) : 0;
  const calcedSpA = p ? calcStat(p.specialAttack, config.ivSpA, config.evSpA, level, n.spA) : 0;
  const calcedSpD = p ? calcStat(p.specialDefense, config.ivSpD, config.evSpD, level, n.spD) : 0;
  const calcedSpe = p ? calcStat(p.speed, config.ivSpe, config.evSpe, level, n.spe) : 0;

  const effSpe = p ? applyStage(calcedSpe, config.speStage) *
    (config.status === "paralysis" ? 0.5 : 1) *
    (config.tailwind ? 2 : 1) *
    (config.item.toLowerCase() === "choice scarf" ? 1.5 : 1) : 0;

  async function handlePokemonChange(pokemonId: string) {
    const found = allPokemon.find(pk => pk.id === pokemonId) ?? null;
    onChange({ pokemon: found, moves: [], loadingMoves: !!found, ability: "None" });
    if (found) {
      const moves = await fetchMoves(found.dexNumber);
      onChange({ moves, loadingMoves: false });
    }
  }

  const totalEv = config.evHp + config.evAtk + config.evDef + config.evSpA + config.evSpD + config.evSpe;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-base">{label}</h3>
        {p && (
          <div className="flex items-center gap-2">
            <Image src={p.spriteUrl} alt={p.name} width={48} height={48} className="size-10 object-contain" />
            <div className="flex gap-1">{pokemonTypesFor(p).map(t => <TypeBadge key={t} type={t} />)}</div>
          </div>
        )}
      </div>

      {/* Team filter + Pokémon selector */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team</label>
          <select value={teamFilter} onChange={e => { setTeamFilter(e.target.value); onChange({ pokemon: null, moves: [] }); }}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
            <option value="all">All Pokémon</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.teamName}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pokémon</label>
          <select value={p?.id ?? ""} onChange={e => handlePokemonChange(e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
            <option value="">— Select —</option>
            {available.map(pk => <option key={pk.id} value={pk.id}>{pk.name}</option>)}
          </select>
        </div>
      </div>

      {p && (
        <>
          {/* Nature + Item + Ability */}
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nature</label>
              <select value={n.name} onChange={e => onChange({ nature: NATURES.find(x => x.name === e.target.value)! })}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs">
                {NATURES.map(nat => <option key={nat.name} value={nat.name}>{nat.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</label>
              <select value={config.item} onChange={e => onChange({ item: e.target.value })}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs">
                {ITEMS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ability {config.loadingMoves && <span className="text-muted-foreground">(loading...)</span>}
              </label>
              <select value={config.ability} onChange={e => onChange({ ability: e.target.value })}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs">
                {ABILITIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
            <select value={config.status} onChange={e => onChange({ status: e.target.value as Status })}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
              <option value="none">Healthy</option>
              <option value="burn">Burned</option>
              <option value="paralysis">Paralyzed</option>
              <option value="poison">Poisoned</option>
              <option value="badPoison">Badly Poisoned</option>
              <option value="sleep">Asleep</option>
              <option value="freeze">Frozen</option>
            </select>
          </div>

          {/* Stat table */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-[44px_40px_48px_52px_48px_72px] gap-1 text-xs font-semibold text-muted-foreground">
              <span className="text-right">Stat</span>
              <span className="text-center">Base</span>
              <span className="text-center">IV</span>
              <span className="text-center">EV</span>
              <span className="text-center">Final</span>
              <span className="text-center">Stage</span>
            </div>
            <StatRow label="HP"     base={p.hp}             iv={config.ivHp}  ev={config.evHp}  onIv={v=>onChange({ivHp:v})}  onEv={v=>onChange({evHp:v})}  calc={calcedHp}  showStage={false} />
            <StatRow label="Atk"    base={p.attack}         iv={config.ivAtk} ev={config.evAtk} onIv={v=>onChange({ivAtk:v})} onEv={v=>onChange({evAtk:v})} calc={calcedAtk} stage={config.atkStage} onStage={v=>onChange({atkStage:v})} showStage natureEffect={n.atk} />
            <StatRow label="Def"    base={p.defense}        iv={config.ivDef} ev={config.evDef} onIv={v=>onChange({ivDef:v})} onEv={v=>onChange({evDef:v})} calc={calcedDef} stage={config.defStage} onStage={v=>onChange({defStage:v})} showStage natureEffect={n.def} />
            <StatRow label="SpA"    base={p.specialAttack}  iv={config.ivSpA} ev={config.evSpA} onIv={v=>onChange({ivSpA:v})} onEv={v=>onChange({evSpA:v})} calc={calcedSpA} stage={config.spAStage} onStage={v=>onChange({spAStage:v})} showStage natureEffect={n.spA} />
            <StatRow label="SpD"    base={p.specialDefense} iv={config.ivSpD} ev={config.evSpD} onIv={v=>onChange({ivSpD:v})} onEv={v=>onChange({evSpD:v})} calc={calcedSpD} stage={config.spDStage} onStage={v=>onChange({spDStage:v})} showStage natureEffect={n.spD} />
            <StatRow label="Spe"    base={p.speed}          iv={config.ivSpe} ev={config.evSpe} onIv={v=>onChange({ivSpe:v})} onEv={v=>onChange({evSpe:v})} calc={calcedSpe} stage={config.speStage} onStage={v=>onChange({speStage:v})} showStage natureEffect={n.spe} />
            <div className="flex items-center justify-between border-t pt-1 text-xs text-muted-foreground">
              <span>Total EVs: <span className={totalEv > 508 ? "text-red-400 font-bold" : "font-semibold"}>{totalEv}</span>/508</span>
              <span>Eff. Speed: <span className="font-bold text-foreground">{Math.floor(effSpe)}</span></span>
            </div>
          </div>

          {/* Side conditions */}
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Side Conditions</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              <Checkbox label="Reflect"      checked={config.reflect}      onChange={v=>onChange({reflect:v})} />
              <Checkbox label="Light Screen" checked={config.lightScreen}  onChange={v=>onChange({lightScreen:v})} />
              <Checkbox label="Aurora Veil"  checked={config.auroraVeil}   onChange={v=>onChange({auroraVeil:v})} />
              <Checkbox label="Tailwind"     checked={config.tailwind}     onChange={v=>onChange({tailwind:v})} />
              <Checkbox label="Helping Hand" checked={config.helpingHand}  onChange={v=>onChange({helpingHand:v})} />
              {isAttacker && (
                <Checkbox label="Crit" checked={config.isCrit} onChange={v=>onChange({isCrit:v})} />
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Result panel ─────────────────────────────────────────────────────────────

function ResultPanel({
  attacker, defender, field, level,
}: {
  attacker: PokemonConfig;
  defender: PokemonConfig;
  field: FieldConditions;
  level: number;
}) {
  const calcAtk = buildCalcPokemon(attacker, level);
  const calcDef = buildCalcPokemon(defender, level);

  if (!calcAtk || !calcDef) {
    return (
      <Card className="p-5 space-y-2 text-center text-muted-foreground">
        <Swords size={32} className="mx-auto opacity-30" />
        <p>Select both Pokémon to see damage results</p>
      </Card>
    );
  }

  function renderMoveResults(moves: ApiMove[], attackerCfg: CalcPokemon, defenderCfg: CalcPokemon, label: string) {
    const damageMoves = moves.filter(m => m.category !== "status" && (m.power ?? 0) > 0);
    if (damageMoves.length === 0) return (
      <div className="text-xs text-muted-foreground italic">No moves loaded yet</div>
    );
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        {damageMoves.slice(0, 20).map(move => {
          const m: Move = {
            name: move.name,
            power: move.power ?? 0,
            type: move.type as PokemonType,
            category: move.category,
            priority: move.priority,
            makesContact: move.makesContact,
          };
          const result = calculateDamage(attackerCfg, defenderCfg, m, field, level);
          const pctColor =
            result.minPercent >= 100 ? "text-green-400" :
            result.minPercent >= 50  ? "text-yellow-400" :
            result.minPercent >= 25  ? "text-orange-400" : "text-muted-foreground";
          const badge =
            result.typeMultiplier >= 4 ? <span className="text-green-400 font-black">4×</span> :
            result.typeMultiplier >= 2 ? <span className="text-green-500 font-bold">2×</span> :
            result.typeMultiplier === 0 ? <span className="text-gray-500">0×</span> :
            result.typeMultiplier <= 0.25 ? <span className="text-red-500 font-bold">¼×</span> :
            result.typeMultiplier <= 0.5 ? <span className="text-red-400">½×</span> : null;
          return (
            <div key={move.name} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-1.5">
              <TypeBadge type={move.type as PokemonType} />
              <span className="text-xs font-semibold flex-1 truncate">{move.name}</span>
              <span className="text-xs text-muted-foreground">{move.power}BP</span>
              {badge}
              <span className={`text-sm font-black tabular-nums ${pctColor}`}>
                {result.minPercent}–{result.maxPercent}%
              </span>
              <span className="text-xs text-muted-foreground hidden sm:block">
                ({result.min}–{result.max})
              </span>
              {result.koChance !== "No OHKO" && (
                <span className="text-xs font-bold text-green-400">{result.koChance}</span>
              )}
              {result.isStab && <span className="text-xs text-yellow-400">STAB</span>}
            </div>
          );
        })}
      </div>
    );
  }

  // Speed comparison
  const atkSpe = getEffectiveSpeed(calcAtk);
  const defSpe = getEffectiveSpeed(calcDef);

  return (
    <div className="space-y-4">
      {/* Speed comparison */}
      <Card className="p-4 flex items-center gap-4">
        <Zap size={20} className="text-yellow-400 shrink-0" />
        <div className="flex-1 grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <p className="font-bold truncate">{attacker.pokemon?.name}</p>
            <p className={`text-lg font-black ${atkSpe > defSpe ? "text-green-400" : "text-muted-foreground"}`}>{atkSpe}</p>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-xs text-muted-foreground">
              {atkSpe > defSpe ? "⚡ Goes first" : atkSpe < defSpe ? "Goes second" : "Speed tie"}
            </span>
          </div>
          <div>
            <p className="font-bold truncate">{defender.pokemon?.name}</p>
            <p className={`text-lg font-black ${defSpe > atkSpe ? "text-green-400" : "text-muted-foreground"}`}>{defSpe}</p>
          </div>
        </div>
      </Card>

      {/* Attacker moves → Defender */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Swords size={16} className="text-red-400" />
          <span className="font-bold text-sm">{attacker.pokemon?.name} attacking {defender.pokemon?.name}</span>
        </div>
        {renderMoveResults(attacker.moves, calcAtk, calcDef, "Move → Damage")}
      </Card>

      {/* Defender moves → Attacker */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-blue-400" />
          <span className="font-bold text-sm">{defender.pokemon?.name} attacking {attacker.pokemon?.name}</span>
        </div>
        {renderMoveResults(defender.moves, calcDef, calcAtk, "Move → Damage")}
      </Card>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DamageCalculator({
  pokemon, teams, rosters,
}: {
  pokemon: Pokemon[];
  teams: Team[];
  rosters: Record<string, Pokemon[]>;
}) {
  const [level, setLevel]     = useState(100);
  const [weather, setWeather] = useState<Weather>("none");
  const [terrain, setTerrain] = useState<Terrain>("none");
  const [isDoubles, setIsDoubles] = useState(false);

  const [attacker, setAttackerState] = useState<PokemonConfig>(defaultConfig());
  const [defender, setDefenderState] = useState<PokemonConfig>(defaultConfig());

  function updateAttacker(updates: Partial<PokemonConfig>) {
    setAttackerState(prev => ({ ...prev, ...updates }));
  }
  function updateDefender(updates: Partial<PokemonConfig>) {
    setDefenderState(prev => ({ ...prev, ...updates }));
  }

  const field: FieldConditions = { weather, terrain, isDoublesFormat: isDoubles };

  return (
    <div className="space-y-6">
      {/* Result at top */}
      <ResultPanel attacker={attacker} defender={defender} field={field} level={level} />

      {/* Field conditions */}
      <Card className="p-4 space-y-4">
        <h3 className="font-bold">Field Conditions</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Level</label>
            <Input type="number" min={1} max={100} value={level} onChange={e => setLevel(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Format</label>
            <select value={isDoubles ? "doubles" : "singles"} onChange={e => setIsDoubles(e.target.value === "doubles")}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="singles">Singles</option>
              <option value="doubles">Doubles</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weather</label>
            <select value={weather} onChange={e => setWeather(e.target.value as Weather)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="none">None</option>
              <option value="sun">Sun</option>
              <option value="rain">Rain</option>
              <option value="sand">Sand</option>
              <option value="snow">Snow</option>
              <option value="harshSun">Harsh Sunshine</option>
              <option value="heavyRain">Heavy Rain</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Terrain</label>
            <select value={terrain} onChange={e => setTerrain(e.target.value as Terrain)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="none">None</option>
              <option value="electric">Electric Terrain</option>
              <option value="grassy">Grassy Terrain</option>
              <option value="misty">Misty Terrain</option>
              <option value="psychic">Psychic Terrain</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Pokémon panels side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PokemonPanel
          label="⚔️ Attacker"
          config={attacker}
          onChange={updateAttacker}
          allPokemon={pokemon}
          teams={teams}
          rosters={rosters}
          level={level}
          isAttacker
        />
        <PokemonPanel
          label="🛡️ Defender"
          config={defender}
          onChange={updateDefender}
          allPokemon={pokemon}
          teams={teams}
          rosters={rosters}
          level={level}
          isAttacker={false}
        />
      </div>
    </div>
  );
}
