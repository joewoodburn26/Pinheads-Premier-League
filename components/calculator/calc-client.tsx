"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { toID } from "@smogon/calc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldPanel } from "@/components/calculator/field-panel";
import { PokemonPanel, type PickOption } from "@/components/calculator/pokemon-panel";
import {
  blankField, blankSide, defaultSet, getGen, runCalcs, statsOf, withSet,
  type FieldState, type MoveResult, type SideState,
} from "@/components/calculator/calc-utils";
import { exportSet, parseTeam, type CalcSet } from "@/lib/showdown-text";
import { smogonSets, type NamedSet } from "@/lib/smogon-sets";

export type CalcPokemon = { id: string; name: string; species: string; sprite: string };
export type CalcTeam = { id: string; name: string; roster: string[] };

const ACCENTS: [string, string] = ["#3b82f6", "#ef4444"];
const IMPORTS_KEY = "ppl-calc-imports-v1";
const DEFAULT_LABEL = "Default set";

type SpeciesData = { moves: string[]; abilities: string[]; sets: NamedSet[] };

function readImports(): NamedSet[] {
  try {
    const raw = localStorage.getItem(IMPORTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as NamedSet[]) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => s?.label && s?.set?.species) : [];
  } catch {
    return [];
  }
}

function writeImports(list: NamedSet[]) {
  try {
    localStorage.setItem(IMPORTS_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: imports last for this visit only */
  }
}

export function CalcClient({
  calcGen,
  formatLabel,
  natdex,
  doublesDefault,
  defaultLevel,
  pokemon,
  teams,
  myTeamId,
}: {
  calcGen: number;
  formatLabel: string;
  natdex: boolean;
  doublesDefault: boolean;
  defaultLevel: number;
  pokemon: CalcPokemon[];
  teams: CalcTeam[];
  myTeamId?: string;
}) {
  const gen = useMemo(() => getGen(calcGen), [calcGen]);

  // ── Reference data ────────────────────────────────────────────────────────
  const byId = useMemo(() => new Map(pokemon.map((p) => [p.id, p])), [pokemon]);
  const bySpecies = useMemo(() => {
    const m = new Map<string, CalcPokemon>();
    for (const p of pokemon) if (!m.has(toID(p.species))) m.set(toID(p.species), p);
    return m;
  }, [pokemon]);
  const items = useMemo(() => [...gen.items].map((i) => i.name).sort(), [gen]);
  const natures = useMemo(
    () => [...gen.natures].map((n) => ({ name: n.name, plus: n.plus, minus: n.minus })).sort((a, b) => a.name.localeCompare(b.name)),
    [gen],
  );
  const teraTypes = useMemo(() => [...gen.types].map((t) => t.name).filter((t) => t !== "???"), [gen]);

  // ── Species data (legal moves, abilities, Smogon sets), cached ───────────
  const cache = useRef(new Map<string, Promise<SpeciesData>>());
  const [loaded, setLoaded] = useState<Record<string, SpeciesData>>({});

  const loadSpecies = useCallback(
    (species: string): Promise<SpeciesData> => {
      const key = toID(species);
      let p = cache.current.get(key);
      if (!p) {
        p = Promise.all([
          fetch(`/api/calc-moves?species=${encodeURIComponent(species)}`)
            .then((r) => r.json() as Promise<{ moves: string[]; abilities: string[] }>)
            .catch(() => ({ moves: [] as string[], abilities: [] as string[] })),
          smogonSets(species, calcGen, defaultLevel, natdex).catch(() => [] as NamedSet[]),
        ]).then(([api, sets]) => {
          const data = { moves: api.moves ?? [], abilities: api.abilities ?? [], sets };
          setLoaded((prev) => ({ ...prev, [key]: data }));
          return data;
        });
        cache.current.set(key, p);
      }
      return p;
    },
    [calcGen, defaultLevel, natdex],
  );

  // ── State ─────────────────────────────────────────────────────────────────
  const [imports, setImports] = useState<NamedSet[]>([]);
  useEffect(() => setImports(readImports()), []);

  const initialPick = (i: 0 | 1) => {
    const mine = teams.find((t) => t.id === myTeamId);
    const other = teams.find((t) => t.id !== myTeamId && t.roster.length);
    const id = i === 0 ? (mine?.roster[0] ?? pokemon[0]?.id) : (other?.roster[0] ?? pokemon[1]?.id ?? pokemon[0]?.id);
    return byId.get(id ?? "");
  };
  const [sides, setSides] = useState<[SideState, SideState]>(() => {
    const a = initialPick(0);
    const b = initialPick(1);
    return [blankSide(a?.species ?? "Pikachu", defaultLevel, a?.id), blankSide(b?.species ?? "Pikachu", defaultLevel, b?.id)];
  });
  const [teamFilter, setTeamFilter] = useState<[string, string]>([
    myTeamId && teams.some((t) => t.id === myTeamId) ? myTeamId : "all",
    "all",
  ]);
  const [field, setField] = useState<FieldState>(() => blankField(doublesDefault));
  const [selected, setSelected] = useState<{ side: 0 | 1; idx: number }>({ side: 0, idx: 0 });
  const [importFor, setImportFor] = useState<0 | 1 | null>(null);
  const tokens = useRef<[number, number]>([0, 0]);

  const setSide = useCallback((i: 0 | 1, s: SideState) => {
    setSides((prev) => (i === 0 ? [s, prev[1]] : [prev[0], s]));
  }, []);

  /** Load a set on a side (Smogon, imported, or default). */
  const applySet = useCallback(
    (i: 0 | 1, set: CalcSet, label: string, pokemonId?: string, data?: SpeciesData) => {
      let s = set;
      // Smogon / default sets follow the season's movepool; imported sets are left as pasted
      if (data && data.moves.length && !label.startsWith("Imported")) {
        const legal = new Set(data.moves);
        const kept = set.moves.filter((m) => legal.has(m));
        if (kept.length < set.moves.length) {
          const filler = defaultSet(gen, set.species, data.moves, data.abilities, set.level).moves.filter((m) => !kept.includes(m));
          s = { ...set, moves: [...kept, ...filler].slice(0, 4) };
        }
      }
      setSide(i, { ...withSet(blankSide(set.species, set.level, pokemonId), s, label) });
    },
    [gen, setSide],
  );

  const pickSpecies = useCallback(
    async (i: 0 | 1, species: string, pokemonId?: string) => {
      const token = ++tokens.current[i];
      setSide(i, blankSide(species, defaultLevel, pokemonId));
      const data = await loadSpecies(species);
      if (token !== tokens.current[i]) return;
      const first = data.sets[0];
      if (first) applySet(i, first.set, first.label, pokemonId, data);
      else applySet(i, defaultSet(gen, species, data.moves, data.abilities, defaultLevel), DEFAULT_LABEL, pokemonId, data);
    },
    [applySet, defaultLevel, gen, loadSpecies, setSide],
  );

  // First load
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    sides.forEach((s, i) => void pickSpecies(i as 0 | 1, s.set.species, s.pokemonId));
  }, [pickSpecies, sides]);

  // Load species data for whatever is on screen (e.g. imported sets)
  useEffect(() => {
    for (const s of sides) void loadSpecies(s.set.species);
  }, [sides, loadSpecies]);

  function pick(i: 0 | 1, key: string) {
    if (key.startsWith("imp:")) {
      const named = imports.find((n) => n.label === key.slice(4));
      if (!named) return;
      tokens.current[i]++;
      const mon = bySpecies.get(toID(named.set.species));
      applySet(i, named.set, named.label, mon?.id);
      return;
    }
    const mon = byId.get(key);
    if (mon) void pickSpecies(i, mon.species, mon.id);
  }

  function loadSet(i: 0 | 1, label: string) {
    const side = sides[i];
    const data = loaded[toID(side.set.species)];
    const imported = imports.find((n) => n.label === label);
    if (imported) return applySet(i, imported.set, imported.label, side.pokemonId);
    const smogon = data?.sets.find((n) => n.label === label);
    if (smogon) return applySet(i, smogon.set, smogon.label, side.pokemonId, data);
    if (label === DEFAULT_LABEL && data) {
      applySet(i, defaultSet(gen, side.set.species, data.moves, data.abilities, defaultLevel), DEFAULT_LABEL, side.pokemonId, data);
    }
  }

  // ── Pick lists ────────────────────────────────────────────────────────────
  const teamOptions = useMemo(
    () => [
      { value: "all", label: `All legal Pokémon (${pokemon.length})` },
      ...teams.map((t) => ({ value: t.id, label: `${t.name}${t.id === myTeamId ? " (yours)" : ""}` })),
      { value: "imports", label: `Imported sets (${imports.length})` },
    ],
    [imports.length, myTeamId, pokemon.length, teams],
  );

  function picksFor(filter: string): PickOption[] {
    if (filter === "imports") {
      return imports.map((n) => ({
        key: `imp:${n.label}`,
        name: n.label.replace(/^Imported · /, ""),
        species: n.set.species,
        sprite: bySpecies.get(toID(n.set.species))?.sprite ?? `https://play.pokemonshowdown.com/sprites/gen5/${toID(n.set.species)}.png`,
      }));
    }
    const ids = filter === "all" ? pokemon.map((p) => p.id) : teams.find((t) => t.id === filter)?.roster ?? [];
    return ids.flatMap((id) => {
      const p = byId.get(id);
      return p ? [{ key: p.id, name: p.name, species: p.species, sprite: p.sprite }] : [];
    });
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const results = useMemo<[MoveResult[], MoveResult[]]>(
    () => [runCalcs(gen, sides, field, 0), runCalcs(gen, sides, field, 1)],
    [gen, sides, field],
  );
  const main = results[selected.side][selected.idx] ?? results[selected.side].find((r) => r.move) ?? null;
  const names: [string, string] = [sides[0].set.nickname || sides[0].set.species, sides[1].set.nickname || sides[1].set.species];

  const speeds = sides.map((s, i) => {
    const st = statsOf(gen, s);
    if (!st) return null;
    let spe = st.boosted.spe;
    if (/Choice Scarf/.test(s.set.item)) spe = Math.floor(spe * 1.5);
    if (s.status === "par") spe = Math.floor(spe * (gen.num >= 7 || gen.num === 0 ? 0.5 : 0.25));
    if (field.sides[i].isTailwind) spe *= 2;
    return spe;
  });

  // ── Import / export ───────────────────────────────────────────────────────
  function doImport(i: 0 | 1, text: string): string | null {
    const sets = parseTeam(text, defaultLevel);
    if (!sets.length) return "Couldn't find any Pokémon in that text. Paste a team exported from Showdown.";
    const existing = new Map(imports.map((n) => [n.label, n]));
    const added: NamedSet[] = [];
    for (const set of sets) {
      const base = `Imported · ${set.nickname && set.nickname !== set.species ? `${set.nickname} (${set.species})` : set.species}`;
      existing.delete(base);
      const named = { label: base, set };
      existing.set(base, named);
      added.push(named);
    }
    const next = [...existing.values()];
    setImports(next);
    writeImports(next);
    setTeamFilter((prev) => (i === 0 ? ["imports", prev[1]] : [prev[0], "imports"]));
    const first = added[0];
    tokens.current[i]++;
    applySet(i, first.set, first.label, bySpecies.get(toID(first.set.species))?.id);
    return null;
  }

  async function doExport(i: 0 | 1) {
    try {
      await navigator.clipboard.writeText(exportSet(sides[i].set, { champions: gen.num === 0 }));
      return true;
    } catch {
      return false;
    }
  }

  function clearImports() {
    setImports([]);
    writeImports([]);
    setTeamFilter((prev) => prev.map((f) => (f === "imports" ? "all" : f)) as [string, string]);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const panel = (i: 0 | 1) => {
    const side = sides[i];
    const data = loaded[toID(side.set.species)];
    const setOptions = [
      ...imports.filter((n) => toID(n.set.species) === toID(side.set.species)).map((n) => n.label),
      ...(data?.sets.map((n) => n.label) ?? []),
      DEFAULT_LABEL,
    ];
    const mon = side.pokemonId ? byId.get(side.pokemonId) : bySpecies.get(toID(side.set.species));
    return (
      <PokemonPanel
        title={`Pokémon ${i + 1}`}
        accent={ACCENTS[i]}
        gen={gen}
        side={side}
        onChange={(s) => setSide(i, s)}
        teamOptions={teamOptions}
        teamFilter={teamFilter[i]}
        onTeamFilter={(v) => setTeamFilter((prev) => (i === 0 ? [v, prev[1]] : [prev[0], v]))}
        picks={picksFor(teamFilter[i])}
        onPick={(key) => pick(i, key)}
        sprite={mon?.sprite ?? `https://play.pokemonshowdown.com/sprites/gen5/${toID(side.set.species)}.png`}
        setOptions={setOptions}
        onLoadSet={(label) => loadSet(i, label)}
        onImport={() => setImportFor(i)}
        onExport={() => doExport(i)}
        legalMoves={data?.moves ?? []}
        movesLoading={!data}
        abilities={data?.abilities ?? []}
        items={items}
        natures={natures}
        teraTypes={teraTypes}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Results ──────────────────────────────────────────────────── */}
      <Card className="space-y-4 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          {([0, 1] as const).map((i) => (
            <div key={i} className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENTS[i] }}>
                {names[i]}&apos;s moves <span className="font-normal normal-case text-muted-foreground">(select one for details)</span>
              </p>
              <div className="grid gap-1 sm:grid-cols-2">
                {results[i].map((r, idx) =>
                  r.move ? (
                    <button
                      key={idx}
                      onClick={() => setSelected({ side: i, idx })}
                      className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors ${
                        selected.side === i && selected.idx === idx ? "bg-white/10" : "hover:bg-muted"
                      }`}
                      style={selected.side === i && selected.idx === idx ? { borderColor: ACCENTS[i] } : undefined}
                    >
                      <span className="truncate font-semibold">{r.move}</span>
                      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                        {r.status ? "—" : `${r.minPct} - ${r.maxPct}%`}
                      </span>
                    </button>
                  ) : null,
                )}
                {results[i].every((r) => !r.move) && <p className="text-xs text-muted-foreground">No moves selected.</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-muted/30 p-3" style={{ borderLeft: `3px solid ${ACCENTS[selected.side]}` }}>
          {main ? (
            <>
              <p className="text-sm font-semibold leading-relaxed">{main.desc || "—"}</p>
              {!main.status && main.damage.length > 0 && (
                <p className="mt-1.5 break-words text-xs text-muted-foreground">
                  Possible damage amounts: ({main.damage.join(", ")})
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Pick moves to see damage.</p>
          )}
          {speeds[0] !== null && speeds[1] !== null && (
            <p className="mt-2 text-xs text-muted-foreground">
              Speed: <span style={{ color: ACCENTS[0] }}>{names[0]} {speeds[0]}</span> vs{" "}
              <span style={{ color: ACCENTS[1] }}>{names[1]} {speeds[1]}</span> —{" "}
              {speeds[0] === speeds[1]
                ? "speed tie"
                : `${speeds[0]! > speeds[1]! ? names[0] : names[1]} moves first`}
              {" "}(scarf, paralysis and Tailwind included)
            </p>
          )}
        </div>
      </Card>

      {/* ── Panels ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[1fr_300px_1fr]">
        {panel(0)}
        <FieldPanel
          gen={gen}
          field={field}
          onChange={setField}
          names={names}
          accents={ACCENTS}
          onLevel={gen.num === 0 ? undefined : (level) => setSides((prev) => prev.map((s) => ({ ...s, set: { ...s.set, level } })) as [SideState, SideState])}
        />
        {panel(1)}
      </div>

      <p className="text-xs text-muted-foreground">
        {formatLabel} · damage from Smogon&apos;s calc (the Showdown calculator&apos;s engine). Starting sets come from Smogon when
        one exists. Imported sets stay in this browser.
        {imports.length > 0 && (
          <button onClick={clearImports} className="ml-2 underline hover:text-foreground">Clear imported sets</button>
        )}
      </p>

      {importFor !== null && (
        <ImportDialog
          side={importFor}
          onClose={() => setImportFor(null)}
          onImport={(text) => {
            const err = doImport(importFor, text);
            if (!err) setImportFor(null);
            return err;
          }}
        />
      )}
    </div>
  );
}

function ImportDialog({ side, onClose, onImport }: { side: 0 | 1; onClose: () => void; onImport: (text: string) => string | null }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <Card className="w-full max-w-xl space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black">Import Showdown team · Pokémon {side + 1}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted"><X size={16} /></button>
        </div>
        <p className="text-xs text-muted-foreground">
          In Showdown&apos;s Teambuilder, open your team and click <b>Import/Export</b>, then copy the text here. The whole team
          is saved under &quot;Imported sets&quot; for both sides; the first Pokémon loads now.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          placeholder={"Garchomp @ Choice Scarf\nAbility: Rough Skin\nEVs: 252 Atk / 4 SpD / 252 Spe\nJolly Nature\n- Earthquake\n- Outrage"}
          className="h-72 w-full rounded-md border bg-background p-3 font-mono text-xs"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => setError(onImport(text) ?? "")} disabled={!text.trim()}>Import</Button>
        </div>
      </Card>
    </div>
  );
}
