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
import { NATURES, ITEMS, type Nature } from "@/lib/calc-data";
import type { Pokemon, Team } from "@/lib/types";
import type { PokemonType } from "@/lib/types";

// ─── PokéAPI fetching ─────────────────────────────────────────────────────────

interface ApiMove {
  name: string;
  power: number | null;
  type: string;
  category: MoveCategory;
  priority: number;
  makesContact: boolean;
}

interface PokemonApiData {
  moves: ApiMove[];
  abilities: string[];
}

const pokemonDataCache: Record<number, PokemonApiData> = {};

async function fetchPokemonData(dexNumber: number): Promise<PokemonApiData> {
  if (pokemonDataCache[dexNumber]) return pokemonDataCache[dexNumber];
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${dexNumber}`);
    const data = await res.json() as {
      moves: { move: { name: string } }[];
      abilities: { ability: { name: string }; is_hidden: boolean }[];
    };

    const abilities = ["None", ...data.abilities.map(a =>
      a.ability.name.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    )];

    const moveNames = data.moves.map(m => m.move.name);
    const details: ApiMove[] = [];
    const batchSize = 20;
    for (let i = 0; i < Math.min(moveNames.length, 200); i += batchSize) {
      const batch = moveNames.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (name) => {
          try {
            const r = await fetch(`https://pokeapi.co/api/v2/move/${name}`);
            const m = await r.json() as {
              name: string; power: number | null;
              damage_class?: { name: string }; type?: { name: string };
              priority?: number; meta?: { category?: { name?: string } };
            };
            if (m.power === null || m.damage_class?.name === "status") return null;
            return {
              name: m.name.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
              power: m.power,
              type: (m.type ? m.type.name.charAt(0).toUpperCase() + m.type.name.slice(1) : "Normal"),
              category: m.damage_class?.name as MoveCategory,
              priority: m.priority ?? 0,
              makesContact: m.meta?.category?.name?.includes("damage") ?? false,
            } as ApiMove;
          } catch { return null; }
        })
      );
      details.push(...results.filter(Boolean) as ApiMove[]);
    }
    details.sort((a, b) => a.name.localeCompare(b.name));
    const result: PokemonApiData = { moves: details, abilities };
    pokemonDataCache[dexNumber] = result;
    return result;
  } catch {
    return { moves: [], abilities: ["None"] };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

// A move slot: the selected move name + override fields
interface MoveSlot {
  moveName: string; // "" = empty slot
}

interface PokemonConfig {
  pokemon: Pokemon | null;
  nature: Nature;
  evHp: number; evAtk: number; evDef: number; evSpA: number; evSpD: number; evSpe: number;
  ivHp: number; ivAtk: number; ivDef: number; ivSpA: number; ivSpD: number; ivSpe: number;
  atkStage: number; defStage: number; spAStage: number; spDStage: number; speStage: number;
  status: Status;
  item: string;
  ability: string;
  reflect: boolean; lightScreen: boolean; auroraVeil: boolean;
  tailwind: boolean; helpingHand: boolean; isCrit: boolean;
  currentHpPct: number; // 0-100, default 100 (full HP)
  moveSlots: [MoveSlot, MoveSlot, MoveSlot, MoveSlot];
  allMoves: ApiMove[];
  legalAbilities: string[];
  loadingMoves: boolean;
}

function defaultConfig(): PokemonConfig {
  return {
    pokemon: null,
    nature: NATURES.find(n => n.name === "Hardy")!,
    evHp:0, evAtk:0, evDef:0, evSpA:0, evSpD:0, evSpe:0,
    ivHp:31, ivAtk:31, ivDef:31, ivSpA:31, ivSpD:31, ivSpe:31,
    atkStage:0, defStage:0, spAStage:0, spDStage:0, speStage:0,
    status: "none", item: "None", ability: "None",
    reflect: false, lightScreen: false, auroraVeil: false,
    tailwind: false, helpingHand: false, isCrit: false,
    currentHpPct: 100,
    moveSlots: [
      { moveName: "" }, { moveName: "" },
      { moveName: "" }, { moveName: "" },
    ],
    allMoves: [], legalAbilities: ["None"], loadingMoves: false,
  };
}

function buildCalcPokemon(config: PokemonConfig, level: number): CalcPokemon | null {
  const p = config.pokemon;
  if (!p) return null;
  const n = config.nature;
  const maxHp = calcHp(p.hp, config.ivHp, config.evHp, level);
  const currentHp = Math.max(1, Math.floor(maxHp * config.currentHpPct / 100));
  return {
    name: p.name, types: pokemonTypesFor(p),
    baseHp: p.hp, baseAtk: p.attack, baseDef: p.defense,
    baseSpA: p.specialAttack, baseSpD: p.specialDefense, baseSpe: p.speed,
    hp: maxHp, currentHp,
    atk: calcStat(p.attack,         config.ivAtk, config.evAtk, level, n.atk),
    def: calcStat(p.defense,        config.ivDef, config.evDef, level, n.def),
    spA: calcStat(p.specialAttack,  config.ivSpA, config.evSpA, level, n.spA),
    spD: calcStat(p.specialDefense, config.ivSpD, config.evSpD, level, n.spD),
    spe: calcStat(p.speed,          config.ivSpe, config.evSpe, level, n.spe),
    atkStage: config.atkStage, defStage: config.defStage,
    spAStage: config.spAStage, spDStage: config.spDStage, speStage: config.speStage,
    status: config.status, item: config.item, ability: config.ability,
    reflect: config.reflect, lightScreen: config.lightScreen, auroraVeil: config.auroraVeil,
    tailwind: config.tailwind, helpingHand: config.helpingHand, isCrit: config.isCrit,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGES = [-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6];

function StageSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select value={value} onChange={e => onChange(Number(e.target.value))}
      className="h-7 rounded border bg-background text-xs px-1 w-14">
      {STAGES.map(s => <option key={s} value={s}>{s > 0 ? `+${s}` : s}</option>)}
    </select>
  );
}

function StatRow({
  label, base, iv, ev, onIv, onEv, calc, stage, onStage, showStage, natureEffect,
}: {
  label: string; base: number; iv: number; ev: number;
  onIv: (v: number) => void; onEv: (v: number) => void;
  calc: number; stage?: number; onStage?: (v: number) => void;
  showStage?: boolean; natureEffect?: number;
}) {
  const color = natureEffect === 1.1 ? "text-green-400" : natureEffect === 0.9 ? "text-red-400" : "";
  const modified = showStage && stage && stage !== 0 ? applyStage(calc, stage) : null;
  return (
    <div className="grid grid-cols-[44px_40px_48px_52px_48px_60px_70px] gap-1 items-center text-xs">
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
      {modified !== null
        ? <span className={`text-xs font-bold tabular-nums ${modified > calc ? "text-green-400" : "text-red-400"}`}>→ {modified}</span>
        : <span />}
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded" />
      {label}
    </label>
  );
}

// ─── Move slot row ─────────────────────────────────────────────────────────────

function MoveSlotRow({
  slotIndex, slot, allMoves, onSelect,
}: {
  slotIndex: number; slot: MoveSlot; allMoves: ApiMove[];
  onSelect: (moveName: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-4">{slotIndex + 1}</span>
      <select
        value={slot.moveName}
        onChange={e => onSelect(e.target.value)}
        className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
      >
        <option value="">— Empty —</option>
        {allMoves.map(m => (
          <option key={m.name} value={m.name}>
            {m.name} ({m.power}BP · {m.type} · {m.category})
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Pokémon panel ─────────────────────────────────────────────────────────────

function PokemonPanel({
  label, config, onChange, allPokemon, teams, rosters, level, isAttacker,
}: {
  label: string; config: PokemonConfig; onChange: (c: Partial<PokemonConfig>) => void;
  allPokemon: Pokemon[]; teams: Team[]; rosters: Record<string, Pokemon[]>;
  level: number; isAttacker: boolean;
}) {
  const [teamFilter, setTeamFilter] = useState("all");
  const available = teamFilter === "all" ? allPokemon : (rosters[teamFilter] ?? []);
  const p = config.pokemon;
  const n = config.nature;

  const calcedHp  = p ? calcHp(p.hp,              config.ivHp,  config.evHp,  level) : 0;
  const calcedAtk = p ? calcStat(p.attack,         config.ivAtk, config.evAtk, level, n.atk) : 0;
  const calcedDef = p ? calcStat(p.defense,        config.ivDef, config.evDef, level, n.def) : 0;
  const calcedSpA = p ? calcStat(p.specialAttack,  config.ivSpA, config.evSpA, level, n.spA) : 0;
  const calcedSpD = p ? calcStat(p.specialDefense, config.ivSpD, config.evSpD, level, n.spD) : 0;
  const calcedSpe = p ? calcStat(p.speed,          config.ivSpe, config.evSpe, level, n.spe) : 0;

  const effSpe = p ? Math.floor(
    applyStage(calcedSpe, config.speStage) *
    (config.status === "paralysis" ? 0.5 : 1) *
    (config.tailwind ? 2 : 1) *
    (config.item.toLowerCase() === "choice scarf" ? 1.5 : 1)
  ) : 0;

  const totalEv = config.evHp + config.evAtk + config.evDef + config.evSpA + config.evSpD + config.evSpe;

  async function handlePokemonChange(pokemonId: string) {
    const found = allPokemon.find(pk => pk.id === pokemonId) ?? null;
    onChange({
      pokemon: found, allMoves: [], legalAbilities: ["None"],
      loadingMoves: !!found, ability: "None",
      moveSlots: [{ moveName:"" },{ moveName:"" },{ moveName:"" },{ moveName:"" }],
    });
    if (found) {
      const data = await fetchPokemonData(found.dexNumber);
      onChange({ allMoves: data.moves, legalAbilities: data.abilities, loadingMoves: false });
    }
  }

  function updateMoveSlot(slotIndex: number, moveName: string) {
    const newSlots = [...config.moveSlots] as [MoveSlot, MoveSlot, MoveSlot, MoveSlot];
    newSlots[slotIndex] = { moveName };
    onChange({ moveSlots: newSlots });
  }

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

      {/* Team + Pokémon */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team</label>
          <select value={teamFilter} onChange={e => { setTeamFilter(e.target.value); onChange({ pokemon: null, allMoves: [], legalAbilities: ["None"] }); }}
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
                Ability {config.loadingMoves && <span className="text-muted-foreground text-xs">(loading…)</span>}
              </label>
              <select value={config.ability} onChange={e => onChange({ ability: e.target.value })}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs">
                {config.legalAbilities.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Status + Current HP */}
          <div className="grid gap-2 sm:grid-cols-2">
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
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Current HP: <span className={`font-bold ${config.currentHpPct <= 33 ? "text-red-400" : config.currentHpPct <= 50 ? "text-yellow-400" : "text-green-400"}`}>{config.currentHpPct}%</span>
              </label>
              <input type="range" min={1} max={100} value={config.currentHpPct}
                onChange={e => onChange({ currentHpPct: Number(e.target.value) })}
                className="w-full accent-primary" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1%</span>
                <span>⅓ HP</span>
                <span>Full</span>
              </div>
            </div>
          </div>

          {/* Stat table */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-[44px_40px_48px_52px_48px_60px_70px] gap-1 text-xs font-semibold text-muted-foreground">
              <span className="text-right">Stat</span>
              <span className="text-center">Base</span>
              <span className="text-center">IV</span>
              <span className="text-center">EV</span>
              <span className="text-center">Final</span>
              <span className="text-center">Stage</span>
              <span className="text-center">Modified</span>
            </div>
            <StatRow label="HP"  base={p.hp}             iv={config.ivHp}  ev={config.evHp}  onIv={v=>onChange({ivHp:v})}  onEv={v=>onChange({evHp:v})}  calc={calcedHp}  showStage={false} />
            <StatRow label="Atk" base={p.attack}         iv={config.ivAtk} ev={config.evAtk} onIv={v=>onChange({ivAtk:v})} onEv={v=>onChange({evAtk:v})} calc={calcedAtk} stage={config.atkStage} onStage={v=>onChange({atkStage:v})} showStage natureEffect={n.atk} />
            <StatRow label="Def" base={p.defense}        iv={config.ivDef} ev={config.evDef} onIv={v=>onChange({ivDef:v})} onEv={v=>onChange({evDef:v})} calc={calcedDef} stage={config.defStage} onStage={v=>onChange({defStage:v})} showStage natureEffect={n.def} />
            <StatRow label="SpA" base={p.specialAttack}  iv={config.ivSpA} ev={config.evSpA} onIv={v=>onChange({ivSpA:v})} onEv={v=>onChange({evSpA:v})} calc={calcedSpA} stage={config.spAStage} onStage={v=>onChange({spAStage:v})} showStage natureEffect={n.spA} />
            <StatRow label="SpD" base={p.specialDefense} iv={config.ivSpD} ev={config.evSpD} onIv={v=>onChange({ivSpD:v})} onEv={v=>onChange({evSpD:v})} calc={calcedSpD} stage={config.spDStage} onStage={v=>onChange({spDStage:v})} showStage natureEffect={n.spD} />
            <StatRow label="Spe" base={p.speed}          iv={config.ivSpe} ev={config.evSpe} onIv={v=>onChange({ivSpe:v})} onEv={v=>onChange({evSpe:v})} calc={calcedSpe} stage={config.speStage} onStage={v=>onChange({speStage:v})} showStage natureEffect={n.spe} />
            <div className="flex justify-between border-t pt-1 text-xs text-muted-foreground">
              <span>EVs: <span className={totalEv > 508 ? "text-red-400 font-bold" : "font-semibold"}>{totalEv}</span>/508</span>
              <span>Eff. Speed: <span className="font-bold text-foreground">{effSpe}</span></span>
            </div>
          </div>

          {/* Move slots */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Moves {config.loadingMoves && <span className="text-muted-foreground">(loading…)</span>}
            </label>
            {config.moveSlots.map((slot, i) => (
              <MoveSlotRow
                key={i}
                slotIndex={i}
                slot={slot}
                allMoves={config.allMoves}
                onSelect={name => updateMoveSlot(i, name)}
              />
            ))}
          </div>

          {/* Side conditions */}
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Side Conditions</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              <Checkbox label="Reflect"      checked={config.reflect}     onChange={v=>onChange({reflect:v})} />
              <Checkbox label="Light Screen" checked={config.lightScreen} onChange={v=>onChange({lightScreen:v})} />
              <Checkbox label="Aurora Veil"  checked={config.auroraVeil}  onChange={v=>onChange({auroraVeil:v})} />
              <Checkbox label="Tailwind"     checked={config.tailwind}    onChange={v=>onChange({tailwind:v})} />
              <Checkbox label="Helping Hand" checked={config.helpingHand} onChange={v=>onChange({helpingHand:v})} />
              {isAttacker && <Checkbox label="Crit" checked={config.isCrit} onChange={v=>onChange({isCrit:v})} />}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Result panel ──────────────────────────────────────────────────────────────

function MoveList({
  heading, calcAttacker, calcDefender, moveSlots, allMoves, field, level, icon,
}: {
  heading: string;
  calcAttacker: CalcPokemon;
  calcDefender: CalcPokemon;
  moveSlots: [MoveSlot, MoveSlot, MoveSlot, MoveSlot];
  allMoves: ApiMove[];
  field: FieldConditions;
  level: number;
  icon: React.ReactNode;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Build results for each filled slot
  const slotResults = moveSlots.map((slot) => {
    if (!slot.moveName) return null;
    const apiMove = allMoves.find(m => m.name === slot.moveName);
    if (!apiMove) return null;
    const m: Move = {
      name: apiMove.name, power: apiMove.power ?? 0,
      type: apiMove.type as PokemonType, category: apiMove.category,
      priority: apiMove.priority, makesContact: apiMove.makesContact,
    };
    return { apiMove, result: calculateDamage(calcAttacker, calcDefender, m, field, level) };
  });

  const selected = selectedIndex !== null ? slotResults[selectedIndex] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-bold">{heading}</span>
      </div>

      {/* Move rows */}
      <div className="rounded-lg border overflow-hidden">
        {moveSlots.map((slot, i) => {
          const res = slotResults[i];
          const isSelected = selectedIndex === i;

          if (!slot.moveName || !res) {
            return (
              <div key={i} className="flex items-center gap-3 border-b last:border-b-0 px-3 py-2 bg-muted/20">
                <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                <span className="text-xs text-muted-foreground italic">— empty —</span>
              </div>
            );
          }

          const { apiMove, result } = res;
          const pctColor =
            result.maxPercent >= 100 ? "text-green-400" :
            result.maxPercent >= 50  ? "text-yellow-400" :
            result.maxPercent >= 25  ? "text-orange-400" : "text-muted-foreground";

          return (
            <button
              key={i}
              onClick={() => setSelectedIndex(isSelected ? null : i)}
              className={`w-full flex items-center gap-3 border-b last:border-b-0 px-3 py-2 text-left transition-colors hover:bg-muted/50 ${isSelected ? "bg-primary/15 border-l-2 border-l-primary" : ""}`}
            >
              <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
              <TypeBadge type={apiMove.type as PokemonType} />
              <span className="flex-1 text-sm font-semibold">{apiMove.name}</span>
              <span className="text-xs text-muted-foreground">{apiMove.power}BP</span>
              <span className={`text-sm font-black tabular-nums min-w-[90px] text-right ${pctColor}`}>
                {result.minPercent}–{result.maxPercent}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Expanded result — Showdown style description */}
      {selected && (() => {
        const { apiMove, result } = selected;
        const koText =
          result.koChance.includes("Guaranteed OHKO") ? "guaranteed OHKO" :
          result.koChance.includes("OHKO") ? result.koChance.toLowerCase() :
          result.twoHkoChance.includes("Guaranteed 2HKO") ? "guaranteed 2HKO" :
          result.twoHkoChance.includes("2HKO") ? result.twoHkoChance.toLowerCase() : "";

        return (
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            {/* Showdown-style description line */}
            <p className="text-sm font-bold leading-snug">
              {calcAttacker.name} {apiMove.name} vs. {calcDefender.name}:{" "}
              <span className="text-primary">{result.min}–{result.max}</span>{" "}
              <span className="text-muted-foreground">({result.minPercent}–{result.maxPercent}%)</span>
              {result.hits > 1 && <span className="text-yellow-400"> · {result.hits} hits</span>}
              {koText && <span className="text-green-400"> — {koText}</span>}
            </p>

            {/* HP bar */}
            <div className="space-y-1">
              <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                <div className="absolute h-full rounded-full bg-primary/30"
                  style={{ width: `${Math.min(100, result.maxPercent)}%` }} />
                <div className="absolute h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, result.minPercent)}%` }} />
              </div>
            </div>

            {/* All 16 rolls */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Possible damage amounts (16 rolls):</p>
              <div className="flex flex-wrap gap-1">
                {result.rolls.map((r, ri) => (
                  <span key={ri}
                    className={`rounded px-1.5 py-0.5 text-xs font-mono ${r >= result.defenderHp ? "bg-green-500/20 text-green-400 font-bold" : "bg-muted"}`}>
                    {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Modifier tags */}
            <p className="text-xs text-muted-foreground">{result.description}</p>
          </div>
        );
      })()}
    </div>
  );
}

function ResultPanel({
  attacker, defender, field, level,
}: {
  attacker: PokemonConfig; defender: PokemonConfig;
  field: FieldConditions; level: number;
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

  const atkSpe = getEffectiveSpeed(calcAtk);
  const defSpe = getEffectiveSpeed(calcDef);

  return (
    <div className="space-y-4">
      {/* Speed */}
      <Card className="p-4 flex items-center gap-4">
        <Zap size={20} className="text-yellow-400 shrink-0" />
        <div className="flex-1 grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <p className="font-bold truncate">{attacker.pokemon?.name}</p>
            <p className={`text-lg font-black ${atkSpe > defSpe ? "text-green-400" : "text-muted-foreground"}`}>{atkSpe}</p>
          </div>
          <div className="flex items-center justify-center text-xs text-muted-foreground">
            {atkSpe > defSpe ? "⚡ Goes first" : atkSpe < defSpe ? "Goes second" : "Speed tie"}
          </div>
          <div>
            <p className="font-bold truncate">{defender.pokemon?.name}</p>
            <p className={`text-lg font-black ${defSpe > atkSpe ? "text-green-400" : "text-muted-foreground"}`}>{defSpe}</p>
          </div>
        </div>
      </Card>

      {/* Side by side move lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <MoveList
            heading={`${attacker.pokemon?.name}'s Moves`}
            calcAttacker={calcAtk} calcDefender={calcDef}
            moveSlots={attacker.moveSlots} allMoves={attacker.allMoves}
            field={field} level={level}
            icon={<Swords size={14} className="text-red-400" />}
          />
        </Card>
        <Card className="p-4">
          <MoveList
            heading={`${defender.pokemon?.name}'s Moves`}
            calcAttacker={calcDef} calcDefender={calcAtk}
            moveSlots={defender.moveSlots} allMoves={defender.allMoves}
            field={field} level={level}
            icon={<Shield size={14} className="text-blue-400" />}
          />
        </Card>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DamageCalculator({
  pokemon, teams, rosters,
}: {
  pokemon: Pokemon[]; teams: Team[]; rosters: Record<string, Pokemon[]>;
}) {
  const [level,     setLevel]    = useState(100);
  const [weather,   setWeather]  = useState<Weather>("none");
  const [terrain,   setTerrain]  = useState<Terrain>("none");
  const [isDoubles, setIsDoubles] = useState(false);
  const [attacker,  setAttackerState] = useState<PokemonConfig>(defaultConfig());
  const [defender,  setDefenderState] = useState<PokemonConfig>(defaultConfig());

  const field: FieldConditions = { weather, terrain, isDoublesFormat: isDoubles };

  return (
    <div className="space-y-6">
      <ResultPanel attacker={attacker} defender={defender} field={field} level={level} />

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

      <div className="grid gap-6 lg:grid-cols-2">
        <PokemonPanel label="⚔️ Attacker" config={attacker}
          onChange={u => setAttackerState(p => ({ ...p, ...u }))}
          allPokemon={pokemon} teams={teams} rosters={rosters} level={level} isAttacker />
        <PokemonPanel label="🛡️ Defender" config={defender}
          onChange={u => setDefenderState(p => ({ ...p, ...u }))}
          allPokemon={pokemon} teams={teams} rosters={rosters} level={level} isAttacker={false} />
      </div>
    </div>
  );
}
