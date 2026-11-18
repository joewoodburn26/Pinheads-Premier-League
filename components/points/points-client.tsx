"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListBar } from "@/components/points/list-bar";
import { PointsCard } from "@/components/points/points-card";
import { PokemonSprite } from "@/components/pokemon-sprite";
import { FORMAT_OPTIONS, formatName, legalIn } from "@/lib/formats";
import { savePointListChanges } from "@/lib/point-list-actions";
import { pokemonTypesFor } from "@/lib/type-chart";
import type { PointList, Pokemon, PokemonType } from "@/lib/types";

export type PointsMon = Pokemon & {
  /** Generation it was introduced */
  gen: number;
  /** In Pokémon Champions */
  champions: boolean;
  /** Points in the Default list (null when this is Default or there's no Default) */
  defaultPoints: number | null;
};

const ALL_TYPES: PokemonType[] = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground",
  "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
];

const CATEGORIES = [
  { key: "legendary", label: "Legendary", test: (p: Pokemon) => p.legendary },
  { key: "mythical", label: "Mythical", test: (p: Pokemon) => p.mythical },
  { key: "paradox", label: "Paradox", test: (p: Pokemon) => p.paradox },
  { key: "ultraBeast", label: "Ultra Beast", test: (p: Pokemon) => Boolean(p.ultraBeast) },
  { key: "regional", label: "Regional forms", test: (p: Pokemon) => /\b(alolan|galarian|hisuian|paldean)\b/i.test(p.name) },
  { key: "mega", label: "Megas", test: (p: Pokemon) => /^mega\s/i.test(p.name) },
] as const;
type CategoryKey = (typeof CATEGORIES)[number]["key"];

const BAN_GROUPS = ["Legendary", "Mythical", "Paradox", "Ultra Beast", "Other"] as const;
const banGroup = (p: Pokemon): (typeof BAN_GROUPS)[number] =>
  p.mythical ? "Mythical" : p.legendary ? "Legendary" : p.paradox ? "Paradox" : p.ultraBeast ? "Ultra Beast" : "Other";

const SORTS = [
  { key: "points", label: "Points" },
  { key: "name", label: "Name" },
  { key: "dex", label: "Dex #" },
  { key: "bst", label: "BST" },
  { key: "speed", label: "Speed" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

type Edit = { points: number; banned: boolean };

export function PointsClient({
  lists,
  list,
  pokemon,
  hasDefault,
  initialFormat,
}: {
  lists: PointList[];
  list: PointList;
  pokemon: PointsMon[];
  hasDefault: boolean;
  initialFormat: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"pokemon" | "banned">("pokemon");
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [chips, setChips] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState(initialFormat);
  const [types, setTypes] = useState<PokemonType[]>([]);
  const [cats, setCats] = useState<Set<CategoryKey>>(new Set());
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [onlyDiffers, setOnlyDiffers] = useState(false);
  const [sort, setSort] = useState<SortKey>("points");
  const [showFilters, setShowFilters] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirtyCount = Object.keys(edits).length;

  // Leaving with unsaved changes asks first
  useEffect(() => {
    if (!dirtyCount) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);

  const current = (p: PointsMon): Edit => edits[p.id] ?? { points: p.pointValue, banned: Boolean(p.banned) };

  const setEdit = (p: PointsMon, patch: Partial<Edit>) => {
    setMessage(null);
    setEdits((prev) => {
      const next = { ...(prev[p.id] ?? { points: p.pointValue, banned: Boolean(p.banned) }), ...patch };
      const copy = { ...prev };
      if (next.points === p.pointValue && next.banned === Boolean(p.banned)) delete copy[p.id];
      else copy[p.id] = next;
      return copy;
    });
  };
  const resetEdit = (id: string) => setEdits(({ [id]: _drop, ...rest }) => (void _drop, rest));

  // ── Filtering ──
  const legal = useMemo(() => pokemon.filter((p) => legalIn(format, p)), [pokemon, format]);

  const matchesFilters = (p: PointsMon) => {
    if (types.length && !types.every((t) => pokemonTypesFor(p).includes(t))) return false;
    if (cats.size && !CATEGORIES.some((c) => cats.has(c.key) && c.test(p))) return false;
    if (onlyChanged && !edits[p.id]) return false;
    if (onlyDiffers && (p.defaultPoints === null || p.defaultPoints === current(p).points)) return false;
    return true;
  };

  const q = query.trim().toLowerCase();
  const matchesQuery = (p: PointsMon) => p.name.toLowerCase().includes(q) || String(p.dexNumber) === q;

  // A Pokémon belongs to the tab it started in until changes are saved, so cards don't jump away mid-edit
  const unbannedPool = legal.filter((p) => !p.banned);
  const bannedPool = legal.filter((p) => p.banned);

  const chipCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of unbannedPool) m.set(p.pointValue, (m.get(p.pointValue) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [unbannedPool]);

  const sorter = (a: PointsMon, b: PointsMon) => {
    switch (sort) {
      case "name": return a.name.localeCompare(b.name);
      case "dex": return a.dexNumber - b.dexNumber || a.name.localeCompare(b.name);
      case "bst": return b.bst - a.bst || a.name.localeCompare(b.name);
      case "speed": return b.speed - a.speed || a.name.localeCompare(b.name);
      default: return b.pointValue - a.pointValue || a.name.localeCompare(b.name);
    }
  };

  const searching = q.length > 0;
  const filtersOn = types.length > 0 || cats.size > 0 || onlyChanged || onlyDiffers;
  const showingPokemon = searching || chips.size > 0 || onlyChanged || onlyDiffers;
  const visible = useMemo(
    () =>
      showingPokemon
        ? unbannedPool
            .filter((p) => (searching ? matchesQuery(p) : chips.size === 0 || chips.has(p.pointValue)))
            .filter(matchesFilters)
            .sort(sorter)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unbannedPool, chips, q, types, cats, onlyChanged, onlyDiffers, sort, edits, showingPokemon],
  );
  const visibleBanned = useMemo(
    () => bannedPool.filter((p) => (!searching || matchesQuery(p)) && matchesFilters(p)).sort(sorter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bannedPool, q, types, cats, onlyChanged, onlyDiffers, sort, edits],
  );

  // Group the cards by point value when sorted by points, so each tier gets a heading
  const groups = useMemo(() => {
    if (sort !== "points") return [{ value: null as number | null, mons: visible }];
    const out: { value: number | null; mons: PointsMon[] }[] = [];
    for (const p of visible) {
      const last = out[out.length - 1];
      if (last && last.value === p.pointValue) last.mons.push(p);
      else out.push({ value: p.pointValue, mons: [p] });
    }
    return out;
  }, [visible, sort]);

  const toggleChip = (v: number) =>
    setChips((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  const toggleType = (t: PokemonType) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.length >= 2 ? [prev[1], t] : [...prev, t]));
  const toggleCat = (c: CategoryKey) =>
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  const clearFilters = () => {
    setTypes([]);
    setCats(new Set());
    setOnlyChanged(false);
    setOnlyDiffers(false);
  };

  const switchList = (id: string) => {
    if (dirtyCount && !window.confirm(`You have ${dirtyCount} unsaved change(s). Switch lists and lose them?`)) return;
    router.push(`/settings/point-restructure?list=${id}`);
  };

  const save = () =>
    startTransition(async () => {
      const changes = Object.entries(edits).map(([pokemonId, e]) => ({ pokemonId, points: e.points, banned: e.banned }));
      const res = await savePointListChanges(list.id, changes);
      if (res.error) return setMessage({ text: res.error, tone: "error" });
      setEdits({});
      setMessage({ text: `Saved ${changes.length} change(s) to ${list.name}.`, tone: "ok" });
      router.refresh();
    });

  const card = (p: PointsMon) => {
    const e = current(p);
    return (
      <PointsCard
        key={p.id}
        mon={p}
        points={e.points}
        banned={e.banned}
        originalPoints={p.pointValue}
        originalBanned={Boolean(p.banned)}
        defaultPoints={p.defaultPoints !== null && p.defaultPoints !== e.points ? p.defaultPoints : null}
        onPoints={(v) => setEdit(p, { points: v })}
        onBan={(b) => setEdit(p, { banned: b })}
        onReset={() => resetEdit(p.id)}
      />
    );
  };

  return (
    <div className="space-y-5">
      <ListBar lists={lists} list={list} format={format} formatName={formatName(format)} dirty={dirtyCount > 0} onSwitch={switchList} />

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b">
        {([
          ["pokemon", `Pokémon (${unbannedPool.length})`],
          ["banned", `Banned (${bannedPool.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Search + filters ── */}
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any Pokémon by name or dex #…"
              className="pl-9"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Clear search">
                <X size={15} />
              </button>
            )}
          </div>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
            title="Only Pokémon legal in this format are shown"
          >
            {FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-md border bg-background px-3 py-2 text-sm">
            {SORTS.map((s) => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
          </select>
          <Button variant="secondary" onClick={() => setShowFilters((s) => !s)}>
            <SlidersHorizontal size={14} className="mr-1.5" /> Filters
            {filtersOn && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">on</span>}
          </Button>
        </div>

        {showFilters && (
          <div className="space-y-3 border-t pt-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type <span className="normal-case tracking-normal">(pick up to 2)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      types.includes(t) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => toggleCat(c.key)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      cats.has(c.key) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />
                Only unsaved changes
              </label>
              {hasDefault && (
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={onlyDiffers} onChange={(e) => setOnlyDiffers(e.target.checked)} />
                  Only points that differ from Default
                </label>
              )}
              {filtersOn && (
                <button onClick={clearFilters} className="ml-auto text-xs text-muted-foreground underline hover:text-foreground">
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Point value chips */}
        {tab === "pokemon" && (
          <div className="space-y-1.5 border-t pt-3">
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Point values</p>
              <button onClick={() => setChips(new Set(chipCounts.map(([v]) => v)))} className="text-xs text-muted-foreground underline hover:text-foreground">All</button>
              {chips.size > 0 && (
                <button onClick={() => setChips(new Set())} className="text-xs text-muted-foreground underline hover:text-foreground">Clear</button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {chipCounts.map(([v, n]) => (
                <button
                  key={v}
                  onClick={() => toggleChip(v)}
                  className={`min-w-[3rem] rounded-lg border px-2 py-1 text-center transition-colors ${
                    chips.has(v) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <span className="block text-base font-black leading-tight">{v}</span>
                  <span className={`block text-[10px] ${chips.has(v) ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{n}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── Pokémon tab ── */}
      {tab === "pokemon" &&
        (!showingPokemon ? (
          <Card className="p-10 text-center text-muted-foreground">
            Pick one or more point values above, or search for a Pokémon.
          </Card>
        ) : visible.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">No Pokémon match.</Card>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">{visible.length} Pokémon{searching && chips.size > 0 ? " (search ignores the point values)" : ""}</p>
            {groups.map((g) => (
              <section key={g.value ?? "all"} className="space-y-2">
                {g.value !== null && (
                  <h2 className="text-lg font-black">
                    {g.value} pts <span className="text-sm font-semibold text-muted-foreground">· {g.mons.length}</span>
                  </h2>
                )}
                <div className="grid gap-3 md:grid-cols-2">{g.mons.map(card)}</div>
              </section>
            ))}
          </div>
        ))}

      {/* ── Banned tab ── */}
      {tab === "banned" &&
        (visibleBanned.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">No banned Pokémon{searching || filtersOn ? " match" : ` in ${formatName(format)}`}.</Card>
        ) : (
          <div className="space-y-6">
            {BAN_GROUPS.map((group) => {
              const mons = visibleBanned.filter((p) => banGroup(p) === group);
              if (!mons.length) return null;
              return (
                <section key={group} className="space-y-2">
                  <h2 className="text-lg font-black">
                    {group} <span className="text-sm font-semibold text-muted-foreground">· {mons.length}</span>
                  </h2>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {mons.map((p) => {
                      const e = current(p);
                      const changed = !!edits[p.id];
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-2 rounded-lg border p-2 ${changed ? "border-amber-400/70 bg-amber-400/5" : ""}`}
                        >
                          <PokemonSprite src={p.spriteUrl} name={p.name} size={48} className="shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm font-semibold ${e.banned ? "" : "text-green-400"}`}>{p.name}</p>
                            <p className="text-[11px] text-muted-foreground">{e.points} pts</p>
                          </div>
                          <button
                            onClick={() => setEdit(p, { banned: !e.banned })}
                            className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                              e.banned ? "hover:border-green-500/50 hover:bg-green-500/10 hover:text-green-400" : "border-amber-400/60 text-amber-300"
                            }`}
                          >
                            {e.banned ? "Unban" : "Undo"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ))}

      {message && !dirtyCount && (
        <p className={`text-sm ${message.tone === "error" ? "text-red-400" : "text-green-400"}`}>{message.text}</p>
      )}

      {/* ── Save bar ── */}
      {dirtyCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
            <p className="text-sm font-semibold">
              {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"} to <span className="text-primary">{list.name}</span>
              {list.seasons.length > 0 && (
                <span className="font-normal text-muted-foreground"> · affects {list.seasons.map((s) => s.name).join(", ")}</span>
              )}
            </p>
            {message?.tone === "error" && <p className="text-sm text-red-400">{message.text}</p>}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => setEdits({})} disabled={isPending}>Discard</Button>
              <Button onClick={save} disabled={isPending}>{isPending ? "Saving…" : "Save changes"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
