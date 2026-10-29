"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { toID } from "@smogon/calc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldPanel } from "@/components/calculator/field-panel";
import { PokemonPanel, type PickOption } from "@/components/calculator/pokemon-panel";
import {
  basicSet, blankField, blankSide, getGen, runCalcs, statsOf, withSet,
  type FieldState, type MoveResult, type SideState,
} from "@/components/calculator/calc-utils";
import { exportSet, parseTeam, type CalcSet } from "@/lib/showdown-text";
import { smogonSets, type NamedSet } from "@/lib/smogon-sets";

export type CalcPokemon = { id: string; name: string; species: string; sprite: string };
export type CalcTeam = { id: string; name: string; roster: string[] };

const ACCENTS: [string, string] = ["#3b82f6", "#ef4444"];
const IMPORTS_KEY = "ppl-calc-sets-v2";
const OLD_IMPORTS_KEY = "ppl-calc-imports-v1";
const BASIC = "basic";

type SpeciesData = { moves: string[]; abilities: string[]; sets: NamedSet[] };

/** A set the member imported from Showdown, filed under its Pokémon. */
export type SavedSet = { id: string; name: string; set: CalcSet };

const newId = () => Math.random().toString(36).slice(2, 10);

function readImports(): SavedSet[] {
  try {
    const raw = localStorage.getItem(IMPORTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedSet[];
      return Array.isArray(parsed) ? parsed.filter((s) => s?.id && s?.set?.species) : [];
    }
    // Sets imported before sets had names
    const old = JSON.parse(localStorage.getItem(OLD_IMPORTS_KEY) ?? "[]") as NamedSet[];
    return Array.isArray(old)
      ? old.filter((n) => n?.set?.species).map((n) => ({ id: newId(), name: n.label.replace(/^Imported · /, ""), set: n.set }))
      : [];
  } catch {
    return [];
  }
}

function writeImports(list: SavedSet[]) {
  try {
    localStorage.setItem(IMPORTS_KEY, JSON.stringify(list));
    localStorage.removeItem(OLD_IMPORTS_KEY);
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
  const [imports, setImports] = useState<SavedSet[]>([]);
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

  /** Load a set on a side. `key` is "basic", "imp:<id>" or "smogon:<label>". */
  const applySet = useCallback(
    (i: 0 | 1, set: CalcSet, label: string, pokemonId?: string, data?: SpeciesData) => {
      let s = set;
      // Smogon sets follow the season's movepool; imported sets are left as pasted
      if (data && data.moves.length && !label.startsWith("imp:")) {
        const legal = new Set(data.moves);
        s = { ...set, moves: set.moves.filter((m) => legal.has(m)) };
      }
      setSide(i, { ...withSet(blankSide(set.species, set.level, pokemonId), s, label) });
    },
    [setSide],
  );

  const pickSpecies = useCallback(
    async (i: 0 | 1, species: string, pokemonId?: string) => {
      const token = ++tokens.current[i];
      setSide(i, blankSide(species, defaultLevel, pokemonId));
      const data = await loadSpecies(species);
      if (token !== tokens.current[i]) return;
      // Start basic (31 IVs, no EVs or moves); Smogon sets are in the Set dropdown
      applySet(i, basicSet(species, data.abilities, defaultLevel), BASIC, pokemonId, data);
    },
    [applySet, defaultLevel, loadSpecies, setSide],
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
    const mon = byId.get(key);
    if (mon) void pickSpecies(i, mon.species, mon.id);
  }

  function loadSet(i: 0 | 1, key: string) {
    const side = sides[i];
    const data = loaded[toID(side.set.species)];
    if (key.startsWith("imp:")) {
      const saved = imports.find((n) => n.id === key.slice(4));
      if (saved) applySet(i, saved.set, key, side.pokemonId);
    } else if (key.startsWith("smogon:")) {
      const smogon = data?.sets.find((n) => n.label === key.slice(7));
      if (smogon) applySet(i, smogon.set, key, side.pokemonId, data);
    } else if (key === BASIC) {
      applySet(i, basicSet(side.set.species, data?.abilities ?? [], defaultLevel), BASIC, side.pokemonId, data);
    }
  }

  // ── Pick lists ────────────────────────────────────────────────────────────
  const teamOptions = useMemo(
    () => [
      { value: "all", label: `All legal Pokémon (${pokemon.length})` },
      ...teams.map((t) => ({ value: t.id, label: `${t.name}${t.id === myTeamId ? " (yours)" : ""}` })),
    ],
    [myTeamId, pokemon.length, teams],
  );

  function picksFor(filter: string): PickOption[] {
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

  // ── Import / export / manage saved sets ───────────────────────────────────
  function saveImports(next: SavedSet[]) {
    setImports(next);
    writeImports(next);
  }

  function doImport(i: 0 | 1, text: string, setName: string): string | null {
    const sets = parseTeam(text, defaultLevel);
    if (!sets.length) return "Couldn't find any Pokémon in that text. Paste a set exported from Showdown.";
    const name = setName.trim().slice(0, 40);
    let next = [...imports];
    const added: SavedSet[] = [];
    for (const set of sets) {
      const label = name || set.nickname || "Imported set";
      // Same Pokémon + same name replaces the old copy
      next = next.filter((n) => !(toID(n.set.species) === toID(set.species) && n.name === label));
      const saved = { id: newId(), name: label, set };
      next.push(saved);
      added.push(saved);
    }
    saveImports(next);
    const first = added[0];
    tokens.current[i]++;
    void loadSpecies(first.set.species);
    applySet(i, first.set, `imp:${first.id}`, bySpecies.get(toID(first.set.species))?.id);
    return null;
  }

  function renameSet(id: string, name: string) {
    const clean = name.trim().slice(0, 40);
    if (!clean) return;
    saveImports(imports.map((n) => (n.id === id ? { ...n, name: clean } : n)));
  }

  function deleteSet(id: string) {
    saveImports(imports.filter((n) => n.id !== id));
    // Any side showing that set drops back to the basic set
    ([0, 1] as const).forEach((j) => {
      if (sides[j].setLabel === `imp:${id}`) {
        const data = loaded[toID(sides[j].set.species)];
        applySet(j, basicSet(sides[j].set.species, data?.abilities ?? [], defaultLevel), BASIC, sides[j].pokemonId, data);
      }
    });
  }

  async function doExport(i: 0 | 1) {
    try {
      await navigator.clipboard.writeText(exportSet(sides[i].set, { champions: gen.num === 0 }));
      return true;
    } catch {
      return false;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const panel = (i: 0 | 1) => {
    const side = sides[i];
    const data = loaded[toID(side.set.species)];
    const mine = imports.filter((n) => toID(n.set.species) === toID(side.set.species));
    const setGroups = [
      { label: "", options: [{ value: BASIC, text: "Basic (no EVs or moves)" }] },
      { label: "Your sets", options: mine.map((n) => ({ value: `imp:${n.id}`, text: n.name })) },
      { label: "Smogon sets", options: (data?.sets ?? []).map((n) => ({ value: `smogon:${n.label}`, text: n.label })) },
    ].filter((g) => g.options.length);
    const savedId = side.setLabel.startsWith("imp:") ? side.setLabel.slice(4) : null;
    const saved = savedId ? imports.find((n) => n.id === savedId) : undefined;
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
        setGroups={setGroups}
        onLoadSet={(key) => loadSet(i, key)}
        savedSetName={saved?.name}
        onRenameSet={saved ? (name) => renameSet(saved.id, name) : undefined}
        onDeleteSet={saved ? () => deleteSet(saved.id) : undefined}
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
        {formatLabel} · damage from Smogon&apos;s calc (the Showdown calculator&apos;s engine). Pokémon start with 31 IVs and no EVs or moves;
        pick Smogon sets or your imported sets from the dropdown next to the Pokémon&apos;s name. Imported sets are saved in this browser.
      </p>

      {importFor !== null && (
        <ImportDialog
          side={importFor}
          onClose={() => setImportFor(null)}
          onImport={(text, name) => {
            const err = doImport(importFor, text, name);
            if (!err) setImportFor(null);
            return err;
          }}
        />
      )}
    </div>
  );
}

function ImportDialog({
  side,
  onClose,
  onImport,
}: {
  side: 0 | 1;
  onClose: () => void;
  onImport: (text: string, name: string) => string | null;
}) {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <Card className="w-full max-w-xl space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black">Import Showdown set · Pokémon {side + 1}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted"><X size={16} /></button>
        </div>
        <p className="text-xs text-muted-foreground">
          In Showdown&apos;s Teambuilder, click <b>Import/Export</b> and copy one Pokémon or a whole team. Each Pokémon&apos;s set
          is saved under that Pokémon with the name below, so you can pick it from its set list later.
        </p>
        <label className="block space-y-1 text-xs text-muted-foreground">
          Set name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
            placeholder="e.g. VS Michael"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Politoed @ Damp Rock\nAbility: Drizzle\nEVs: 252 HP / 252 Def / 4 SpD\nBold Nature\n- Scald\n- Encore"}
          className="h-64 w-full rounded-md border bg-background p-3 font-mono text-xs"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          {!name.trim() && <span className="mr-auto text-xs text-muted-foreground">No name? It&apos;s saved as &quot;Imported set&quot;.</span>}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => setError(onImport(text, name) ?? "")} disabled={!text.trim()}>Import</Button>
        </div>
      </Card>
    </div>
  );
}
