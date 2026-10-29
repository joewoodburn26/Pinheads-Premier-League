"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, ClipboardCopy, Pencil, Trash2, Upload, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TypeBadge } from "@/components/type-badge";
import { STAT_KEYS, STAT_LABEL, type StatKey } from "@/lib/showdown-text";
import {
  STATUS_OPTIONS, TOGGLE_ABILITIES, calcSpeciesName, statsOf,
  type Gen, type SideState, type StatusId,
} from "@/components/calculator/calc-utils";
import { toID } from "@smogon/calc";

export type PickOption = { key: string; name: string; sprite?: string; species: string };

const sel = "w-full rounded-md border bg-background px-2 py-1.5 text-sm";
const num = "w-full rounded-md border bg-background px-1.5 py-1 text-center text-sm tabular-nums";

export function PokemonPanel({
  title,
  accent,
  gen,
  side,
  onChange,
  // picking
  teamOptions,
  teamFilter,
  onTeamFilter,
  picks,
  onPick,
  sprite,
  // sets
  setGroups,
  onLoadSet,
  savedSetName,
  onRenameSet,
  onDeleteSet,
  onImport,
  onExport,
  // data
  legalMoves,
  movesLoading,
  abilities,
  items,
  natures,
  teraTypes,
}: {
  title: string;
  accent: string;
  gen: Gen;
  side: SideState;
  onChange: (s: SideState) => void;
  teamOptions: { value: string; label: string }[];
  teamFilter: string;
  onTeamFilter: (v: string) => void;
  picks: PickOption[];
  onPick: (key: string) => void;
  sprite?: string;
  setGroups: { label: string; options: { value: string; text: string }[] }[];
  onLoadSet: (key: string) => void;
  /** Name of the imported set that's loaded, if any (enables rename/delete) */
  savedSetName?: string;
  onRenameSet?: (name: string) => void;
  onDeleteSet?: () => void;
  onImport: () => void;
  onExport: () => Promise<boolean>;
  legalMoves: string[];
  movesLoading: boolean;
  abilities: string[];
  items: string[];
  natures: { name: string; plus?: string; minus?: string }[];
  teraTypes: string[];
}) {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const champions = gen.num === 0;
  const evMax = champions ? 32 : 252;
  const evTotalMax = champions ? 66 : 510;
  const calcName = calcSpeciesName(gen, side.set.species);
  const species = calcName ? gen.species.get(toID(calcName)) : undefined;
  const stats = statsOf(gen, side);
  const set = side.set;
  const evTotal = STAT_KEYS.reduce((n, k) => n + (set.evs[k] || 0), 0);
  const nature = natures.find((n) => n.name === set.nature);
  const showRoster = picks.length > 0 && picks.length <= 16;

  const patch = (p: Partial<SideState>) => onChange({ ...side, ...p });
  const patchSet = (p: Partial<SideState["set"]>) => onChange({ ...side, set: { ...set, ...p }, setLabel: side.setLabel });
  const setStat = (which: "evs" | "ivs", k: StatKey, v: number) => patchSet({ [which]: { ...set[which], [k]: v } });
  const setMove = (i: number, name: string) => {
    const moves = [...set.moves];
    while (moves.length < 4) moves.push("");
    moves[i] = name;
    patchSet({ moves });
  };
  const legal = new Set(legalMoves);
  const abilityList = [...new Set([...abilities, ...(set.ability ? [set.ability] : [])])];

  function pickFromSearch(value: string) {
    setSearch(value);
    const hit = picks.find((p) => p.name.toLowerCase() === value.trim().toLowerCase());
    if (hit) {
      onPick(hit.key);
      setSearch("");
    }
  }

  return (
    <Card className="space-y-4 p-4" style={{ borderTop: `3px solid ${accent}` }}>
      {/* ── Header / picker ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black" style={{ color: accent }}>{title}</h2>
        <div className="flex gap-1.5">
          <button onClick={onImport} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted">
            <Upload size={12} /> Import
          </button>
          <button
            onClick={async () => {
              if (await onExport()) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
          >
            <ClipboardCopy size={12} /> {copied ? "Copied!" : "Export"}
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Team
          <select value={teamFilter} onChange={(e) => onTeamFilter(e.target.value)} className={sel}>
            {teamOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Pokémon
          <input
            value={search}
            onChange={(e) => pickFromSearch(e.target.value)}
            list={`${title}-mons`}
            placeholder={`Search ${picks.length} Pokémon…`}
            className={sel}
          />
          <datalist id={`${title}-mons`}>
            {picks.map((p) => <option key={p.key} value={p.name} />)}
          </datalist>
        </label>
      </div>

      {showRoster && (
        <div className="flex flex-wrap gap-1">
          {picks.map((p) => {
            const active = toID(p.species) === toID(set.species);
            return (
              <button
                key={p.key}
                onClick={() => onPick(p.key)}
                title={p.name}
                className={`rounded-md border p-0.5 transition ${active ? "bg-white/10" : "border-transparent opacity-70 hover:opacity-100"}`}
                style={active ? { borderColor: accent } : undefined}
              >
                {p.sprite ? (
                  <Image src={p.sprite} alt={p.name} width={40} height={40} className="size-10 object-contain" />
                ) : (
                  <span className="grid size-10 place-items-center text-[9px] leading-tight">{p.name}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Identity + set picker ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 p-2">
        {sprite ? (
          <Image src={sprite} alt="" width={64} height={64} className="size-16 object-contain" />
        ) : (
          <div className="size-16" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black">{set.species}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {species?.types.map((t) => <TypeBadge key={t} type={t} />)}
            {!species && <span className="text-xs text-red-400">Not in this generation&apos;s calc</span>}
          </div>
        </div>
        <div className="w-full space-y-1 sm:w-56">
          <p className="text-[10px] uppercase text-muted-foreground">Set</p>
          {renaming !== null ? (
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                onRenameSet?.(renaming);
                setRenaming(null);
              }}
            >
              <input value={renaming} onChange={(e) => setRenaming(e.target.value)} maxLength={40} autoFocus className={sel} />
              <button type="submit" title="Save name" className="rounded-md border px-1.5 hover:bg-muted"><Check size={14} /></button>
              <button type="button" title="Cancel" onClick={() => setRenaming(null)} className="rounded-md border px-1.5 hover:bg-muted"><X size={14} /></button>
            </form>
          ) : (
            <div className="flex gap-1">
              <select
                value={side.setLabel}
                onChange={(e) => {
                  setConfirmDelete(false);
                  onLoadSet(e.target.value);
                }}
                className={`${sel} min-w-0 flex-1`}
              >
                {!setGroups.some((g) => g.options.some((o) => o.value === side.setLabel)) && (
                  <option value={side.setLabel}>{side.setLabel ? "Custom" : "Loading…"}</option>
                )}
                {setGroups.map((g) =>
                  g.label ? (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map((o) => <option key={o.value} value={o.value}>{o.text}</option>)}
                    </optgroup>
                  ) : (
                    g.options.map((o) => <option key={o.value} value={o.value}>{o.text}</option>)
                  ),
                )}
              </select>
              {savedSetName !== undefined && !confirmDelete && (
                <>
                  <button title="Rename set" onClick={() => setRenaming(savedSetName)} className="rounded-md border px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Pencil size={13} />
                  </button>
                  <button title="Delete set" onClick={() => setConfirmDelete(true)} className="rounded-md border px-1.5 text-muted-foreground hover:bg-muted hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          )}
          {confirmDelete && savedSetName !== undefined && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Delete &quot;{savedSetName}&quot;?</span>
              <button
                onClick={() => {
                  onDeleteSet?.();
                  setConfirmDelete(false);
                }}
                className="rounded bg-red-600 px-2 py-0.5 font-semibold text-white hover:bg-red-500"
              >
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          )}
        </div>
        {!champions && (
          <label className="w-16 text-center text-[10px] uppercase text-muted-foreground">
            Level
            <input type="number" min={1} max={100} value={set.level} onChange={(e) => patchSet({ level: Number(e.target.value) })} className={num} />
          </label>
        )}
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-1 text-left" />
              <th className="py-1">Base</th>
              {!champions && <th className="py-1">IVs</th>}
              <th className="py-1">{champions ? "SP" : "EVs"}</th>
              <th className="py-1">Stat</th>
              <th className="py-1">Boost</th>
            </tr>
          </thead>
          <tbody>
            {STAT_KEYS.map((k) => {
              const plus = nature?.plus === k && nature?.minus !== k;
              const minus = nature?.minus === k && nature?.plus !== k;
              const boosted = stats && k !== "hp" && side.boosts[k] ? stats.boosted[k] : null;
              return (
                <tr key={k}>
                  <td className={`pr-1 text-xs font-semibold ${plus ? "text-red-400" : minus ? "text-blue-400" : ""}`}>
                    {STAT_LABEL[k]}{plus ? "+" : minus ? "−" : ""}
                  </td>
                  <td className="px-1 text-center tabular-nums text-muted-foreground">{stats?.base[k] ?? "—"}</td>
                  {!champions && (
                    <td className="w-14 px-0.5">
                      <input type="number" min={0} max={31} value={set.ivs[k]} onChange={(e) => setStat("ivs", k, Number(e.target.value))} className={num} />
                    </td>
                  )}
                  <td className="w-16 px-0.5">
                    <input type="number" min={0} max={evMax} step={champions ? 1 : 4} value={set.evs[k]} onChange={(e) => setStat("evs", k, Number(e.target.value))} className={num} />
                  </td>
                  <td className="px-1 text-center font-bold tabular-nums">
                    {stats?.raw[k] ?? "—"}
                    {boosted !== null && <span className="ml-1 text-xs font-normal text-yellow-400">→{boosted}</span>}
                  </td>
                  <td className="w-16 px-0.5">
                    {k !== "hp" && (
                      <select
                        value={side.boosts[k]}
                        onChange={(e) => patch({ boosts: { ...side.boosts, [k]: Number(e.target.value) } })}
                        className={`${num} ${side.boosts[k] > 0 ? "text-green-400" : side.boosts[k] < 0 ? "text-red-400" : ""}`}
                      >
                        {[6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6].map((b) => (
                          <option key={b} value={b}>{b > 0 ? `+${b}` : b}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className={`mt-1 text-right text-xs ${evTotal > evTotalMax ? "text-red-400" : "text-muted-foreground"}`}>
          {champions ? "SP" : "EVs"} left: {evTotalMax - evTotal}
        </p>
      </div>

      {/* ── Nature / ability / item ──────────────────────────────────── */}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Nature
          <select value={set.nature} onChange={(e) => patchSet({ nature: e.target.value })} className={sel}>
            {natures.map((n) => (
              <option key={n.name} value={n.name}>
                {n.name}{n.plus && n.minus && n.plus !== n.minus ? ` (+${STAT_LABEL[n.plus as StatKey]}, −${STAT_LABEL[n.minus as StatKey]})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Ability
          <select value={set.ability} onChange={(e) => patchSet({ ability: e.target.value })} className={sel}>
            <option value="">(none)</option>
            {abilityList.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Item
          {/* A full list (not a type-to-search box), so a set's item can always be swapped */}
          <select value={set.item} onChange={(e) => patchSet({ item: e.target.value })} className={sel}>
            <option value="">(none)</option>
            {set.item && !items.includes(set.item) && <option value={set.item}>{set.item}</option>}
            {items.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Status
          <select value={side.status} onChange={(e) => patch({ status: e.target.value as StatusId })} className={sel}>
            {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {side.status === "tox" && (
          <label className="space-y-1 text-xs text-muted-foreground">
            Toxic turn
            <input type="number" min={1} max={15} value={side.toxicCounter} onChange={(e) => patch({ toxicCounter: Number(e.target.value) })} className={num} />
          </label>
        )}
        <label className="space-y-1 text-xs text-muted-foreground">
          Current HP
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={stats?.raw.hp ?? 999}
              value={stats ? Math.max(1, Math.floor((stats.raw.hp * side.hpPercent) / 100)) : 0}
              onChange={(e) => stats && patch({ hpPercent: Math.min(100, (Number(e.target.value) / stats.raw.hp) * 100) })}
              className={num}
            />
            <span className="whitespace-nowrap">/ {stats?.raw.hp ?? "—"}</span>
            <input
              type="number"
              min={1}
              max={100}
              value={Math.round(side.hpPercent)}
              onChange={(e) => patch({ hpPercent: Math.max(1, Math.min(100, Number(e.target.value))) })}
              className={`${num} w-16`}
            />
            <span>%</span>
          </div>
        </label>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {TOGGLE_ABILITIES.has(set.ability) && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={side.abilityOn} onChange={(e) => patch({ abilityOn: e.target.checked })} />
            {set.ability} active
          </label>
        )}
        {set.ability === "Supreme Overlord" && (
          <label className="flex items-center gap-1.5">
            Allies fainted
            <select value={side.alliesFainted} onChange={(e) => patch({ alliesFainted: Number(e.target.value) })} className="rounded border bg-background px-1">
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        )}
        {gen.num === 9 && (
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={side.tera} onChange={(e) => patch({ tera: e.target.checked })} />
              Terastallize
            </label>
            <select value={set.teraType ?? ""} onChange={(e) => patchSet({ teraType: e.target.value || undefined })} className="rounded border bg-background px-1 py-0.5">
              <option value="">Tera type…</option>
              {teraTypes.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        )}
        {gen.num === 8 && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={side.dynamax} onChange={(e) => patch({ dynamax: e.target.checked })} />
            Dynamax
          </label>
        )}
      </div>

      {/* ── Moves ─────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          Moves {movesLoading ? "· loading legal moves…" : `· ${legalMoves.length} legal in this format`}
        </p>
        {[0, 1, 2, 3].map((i) => {
          const name = set.moves[i] ?? "";
          const m = name ? gen.moves.get(toID(name)) : undefined;
          const illegal = !!name && !movesLoading && legalMoves.length > 0 && !legal.has(name);
          const multi = Array.isArray(m?.multihit) ? m!.multihit as number[] : null;
          return (
            <div key={i} className="flex flex-wrap items-center gap-1.5">
              <select value={name} onChange={(e) => setMove(i, e.target.value)} className={`${sel} min-w-0 flex-1 ${illegal ? "border-yellow-500/70" : ""}`}>
                <option value="">(No move)</option>
                {illegal && <option value={name}>{name} ⚠ not legal</option>}
                {legalMoves.map((mv) => <option key={mv} value={mv}>{mv}</option>)}
              </select>
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{m && m.category !== "Status" ? m.basePower : ""}</span>
              {m && <TypeBadge type={m.type} />}
              {m && m.category !== "Status" && (
                <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Critical hit">
                  <input
                    type="checkbox"
                    checked={side.crits[i]}
                    onChange={(e) => patch({ crits: side.crits.map((c, j) => (j === i ? e.target.checked : c)) })}
                  />
                  Crit
                </label>
              )}
              {multi && (
                <select
                  value={side.hits[i] ?? ""}
                  onChange={(e) => patch({ hits: side.hits.map((h, j) => (j === i ? (e.target.value ? Number(e.target.value) : undefined) : h)) })}
                  className="rounded border bg-background px-1 py-0.5 text-xs"
                  title="Hits"
                >
                  <option value="">Hits</option>
                  {Array.from({ length: multi[1] - multi[0] + 1 }, (_, n) => multi[0] + n).map((h) => <option key={h} value={h}>{h} hits</option>)}
                </select>
              )}
              {gen.num === 7 && m && m.category !== "Status" && (
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={side.useZ[i]}
                    onChange={(e) => patch({ useZ: side.useZ.map((z, j) => (j === i ? e.target.checked : z)) })}
                  />
                  Z
                </label>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
