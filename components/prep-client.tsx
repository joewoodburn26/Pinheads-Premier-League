"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Lock, Save, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TypeBadge } from "@/components/type-badge";
import { pokemonTypes, typeColors } from "@/lib/type-chart";
import { saveMatchupNotes } from "@/lib/prep-actions";
import type { PrepMember, PrepTeam } from "@/lib/prep";

type TeamOption = { id: string; teamName: string; coachName: string };
type Category = { key: string; label: string };

const YOU = { color: "#3b82f6", label: "You" };
const OPP = { color: "#ef4444", label: "Opponent" };

function speedAt(base: number, level: 50 | 100, ev: 0 | 252, plusNature = false) {
  // 31 IVs
  const stat = Math.floor(((2 * base + 31 + Math.floor(ev / 4)) * level) / 100) + 5;
  return plusNature ? Math.floor(stat * 1.1) : stat;
}

const SECTIONS = [
  ["rosters", "Rosters"],
  ["grid", "Weakness Grid"],
  ["speed", "Speed Tiers"],
  ["moves", "Moves"],
  ["notes", "Notes"],
] as const;

export function PrepClient({
  teams,
  yourTeamId,
  vsTeamId,
  you,
  opp,
  categories,
  formatLabel,
  notes,
}: {
  teams: TeamOption[];
  yourTeamId: string;
  vsTeamId: string;
  you: PrepTeam | null;
  opp: PrepTeam | null;
  categories: Category[];
  formatLabel: string;
  notes: { canEdit: boolean; text: string; updatedLabel: string | null };
}) {
  const router = useRouter();
  const [navigating, startNav] = useTransition();
  const yourName = teams.find((t) => t.id === yourTeamId)?.teamName ?? "Your team";
  const oppName = teams.find((t) => t.id === vsTeamId)?.teamName ?? "Opponent";

  function go(team: string, vs: string) {
    const q = new URLSearchParams();
    if (team) q.set("team", team);
    if (vs) q.set("vs", vs);
    startNav(() => router.push(`/prep${q.size ? `?${q}` : ""}`));
  }

  const ready = !!you && !!opp;
  const unmatched = ready ? [...you.unmatched, ...opp.unmatched] : [];

  return (
    <div className={`space-y-8 ${navigating ? "opacity-60" : ""} transition-opacity`}>
      {/* ── Header + pickers ─────────────────────────────────────────── */}
      <section className="pokeball-bg relative overflow-hidden rounded-2xl border border-white/5 px-6 py-7">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/10 via-transparent to-red-500/10" />
        <div className="flex flex-wrap items-center gap-2">
          <Swords size={22} className="text-muted-foreground" />
          <h1 className="text-3xl font-black sm:text-4xl">Matchup Prep</h1>
          <span className="ml-auto rounded-full border px-3 py-1 text-xs text-muted-foreground">{formatLabel}</span>
        </div>
        <div className="mt-5 grid items-end gap-3 md:grid-cols-[1fr_auto_1fr]">
          <TeamPicker label="Your team" color={YOU.color} value={yourTeamId} teams={teams} exclude={vsTeamId} onChange={(id) => go(id, vsTeamId)} />
          <button
            onClick={() => go(vsTeamId, yourTeamId)}
            disabled={!yourTeamId && !vsTeamId}
            title="Swap teams"
            aria-label="Swap teams"
            className="mx-auto mb-1 rounded-full border bg-background p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeftRight size={16} />
          </button>
          <TeamPicker label="Opponent" color={OPP.color} value={vsTeamId} teams={teams} exclude={yourTeamId} onChange={(id) => go(yourTeamId, id)} />
        </div>
        {ready && <nav className="mt-5 flex flex-wrap gap-1.5">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-full border bg-background/60 px-3 py-1 text-xs hover:bg-muted">
              {label}
            </a>
          ))}
        </nav>}
        {unmatched.length > 0 && (
          <p className="mt-3 text-xs text-yellow-400">
            No move/ability data found for: {unmatched.join(", ")}. Tell Claude these names so they can be matched.
          </p>
        )}
      </section>

      {!you || !opp ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <Swords size={36} className="text-muted-foreground/50" />
          <p className="text-lg font-bold">Pick both teams to start</p>
          <p className="text-sm text-muted-foreground">Choose your team and an opponent above to load the matchup.</p>
        </Card>
      ) : (
      <>
      {/* ── Rosters ──────────────────────────────────────────────────── */}
      <Section id="rosters" title="Rosters">
        <div className="grid gap-4 xl:grid-cols-2">
          <RosterTable name={yourName} side={YOU} members={you.members} />
          <RosterTable name={oppName} side={OPP} members={opp.members} />
        </div>
      </Section>

      {/* ── Weakness grid ────────────────────────────────────────────── */}
      <Section id="grid" title="Weakness Grid" hint="Damage each Pokémon takes from each attacking type. Green = weak, red = resists, gray = immune (abilities like Levitate aren't counted).">
        <div className="grid gap-4">
          <WeaknessGrid name={yourName} side={YOU} members={you.members} />
          <WeaknessGrid name={oppName} side={OPP} members={opp.members} />
        </div>
      </Section>

      {/* ── Speed tiers ──────────────────────────────────────────────── */}
      <SpeedSection you={you.members} opp={opp.members} />

      {/* ── Moves ────────────────────────────────────────────────────── */}
      <Section id="moves" title="Moves" hint="Who can learn each utility move in this format.">
        <div className="grid gap-4 lg:grid-cols-2">
          {categories.map((cat) => (
            <MoveCategoryCard key={cat.key} label={cat.label} you={you} opp={opp} catKey={cat.key} />
          ))}
        </div>
      </Section>

      {/* ── Notes ────────────────────────────────────────────────────── */}
      <Section id="notes" title="Matchup Notes">
        <NotesCard key={`${yourTeamId}|${vsTeamId}`} teamId={yourTeamId} vsId={vsTeamId} oppName={oppName} notes={notes} />
      </Section>
      </>
      )}
    </div>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────────

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div>
        <h2 className="text-2xl font-black">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function TeamPicker({
  label, color, value, teams, exclude, onChange,
}: {
  label: string; color: string; value: string; teams: TeamOption[]; exclude: string; onChange: (id: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color }}>
        <span className="size-2 rounded-full" style={{ background: color }} /> {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border-2 bg-background px-3 py-2.5 text-base font-bold"
        style={{ borderColor: `${color}66` }}
      >
        <option value="" disabled>Select a team…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id} disabled={t.id === exclude}>
            {t.teamName}{t.coachName ? ` (${t.coachName})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function SideTitle({ name, side }: { name: string; side: { color: string; label: string } }) {
  return (
    <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3" style={{ borderTop: `3px solid ${side.color}` }}>
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: side.color }}>{side.label}</span>
      <span className="font-black">{name}</span>
    </div>
  );
}

function statTone(v: number) {
  if (v >= 120) return "text-green-400";
  if (v >= 90) return "text-foreground";
  if (v >= 60) return "text-muted-foreground";
  return "text-orange-400";
}

function RosterTable({ name, side, members }: { name: string; side: typeof YOU; members: PrepMember[] }) {
  return (
    <Card className="overflow-hidden">
      <SideTitle name={name} side={side} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-white/5">
              <th className="px-3 py-2 text-left">Pokémon</th>
              <th className="px-2 py-2 text-left">Types</th>
              <th className="px-2 py-2">BST</th>
              {["HP", "Atk", "Def", "SpA", "SpD", "Spe"].map((s) => <th key={s} className="px-1.5 py-2">{s}</th>)}
              <th className="px-3 py-2 text-left">Abilities</th>
            </tr>
          </thead>
          <tbody>
            {members.map(({ pokemon: p, types, abilities }) => (
              <tr key={p.id} className="border-b border-white/5 last:border-0">
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <Image src={p.spriteUrl} alt="" width={36} height={36} className="size-8 object-contain" />
                    <span className="whitespace-nowrap font-semibold">{p.name}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5"><div className="flex gap-1">{types.map((t) => <TypeBadge key={t} type={t} />)}</div></td>
                <td className="px-2 py-1.5 text-center font-bold tabular-nums">{p.bst}</td>
                {[p.hp, p.attack, p.defense, p.specialAttack, p.specialDefense, p.speed].map((v, i) => (
                  <td key={i} className={`px-1.5 py-1.5 text-center tabular-nums ${statTone(v)}`}>{v}</td>
                ))}
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{abilities.join(" · ") || "—"}</td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-6 text-center text-sm text-muted-foreground">No Pokémon on this roster yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Colors match the usual type-defense charts: green = weak (good to hit), red = resists
const MULT_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  "0":    { label: "0", bg: "#2e3436", fg: "#d1d5db" },
  "0.25": { label: "¼", bg: "#6b0000", fg: "#ffffff" },
  "0.5":  { label: "½", bg: "#a40000", fg: "#ffffff" },
  "2":    { label: "2", bg: "#4e9a06", fg: "#ffffff" },
  "4":    { label: "4", bg: "#2b5a02", fg: "#ffffff" },
};

function multCell(x: number) {
  const hit = MULT_STYLE[String(x)];
  if (!hit) return <td className="px-0.5 py-0.5"><div className="h-7" /></td>;
  return (
    <td className="px-0.5 py-0.5">
      <div className="grid h-7 place-items-center rounded text-xs font-bold" style={{ background: hit.bg, color: hit.fg }}>
        {hit.label}
      </div>
    </td>
  );
}

function WeaknessGrid({ name, side, members }: { name: string; side: typeof YOU; members: PrepMember[] }) {
  return (
    <Card className="overflow-hidden">
      <SideTitle name={name} side={side} />
      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[1280px] table-fixed text-sm">
          <colgroup>
            <col className="w-[170px]" />
            {pokemonTypes.map((t) => <col key={t} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-[11px] uppercase tracking-wider text-muted-foreground">Pokémon</th>
              {pokemonTypes.map((t) => (
                <th key={t} className="px-0.5 py-1">
                  <span className="block rounded px-1 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: typeColors[t] }}>
                    {t}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.pokemon.id}>
                <td className="px-2 py-0.5">
                  <div className="flex items-center gap-1.5">
                    <Image src={m.pokemon.spriteUrl} alt="" width={28} height={28} className="size-6 object-contain" />
                    <span className="truncate text-xs font-semibold">{m.pokemon.name}</span>
                  </div>
                </td>
                {pokemonTypes.map((t) => <MultCellWrap key={t} x={m.weakness[t]} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MultCellWrap({ x }: { x: number }) {
  return multCell(x);
}

function SpeedSection({ you, opp }: { you: PrepMember[]; opp: PrepMember[] }) {
  const [level, setLevel] = useState<50 | 100>(100);
  const rows = useMemo(
    () =>
      [...you.map((m) => ({ m, side: YOU })), ...opp.map((m) => ({ m, side: OPP }))]
        .map((r) => ({
          ...r,
          s0: speedAt(r.m.pokemon.speed, level, 0),
          s252: speedAt(r.m.pokemon.speed, level, 252),
          sPlus: speedAt(r.m.pokemon.speed, level, 252, true),
        }))
        .sort((a, b) => b.sPlus - a.sPlus || b.m.pokemon.speed - a.m.pokemon.speed),
    [you, opp, level],
  );

  return (
    <section id="speed" className="scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Speed Tiers</h2>
          <p className="text-sm text-muted-foreground">Level {level}, 31 IVs. Sorted by max speed (252 EVs, + nature).</p>
        </div>
        <div className="flex rounded-md border p-0.5 text-sm">
          {([100, 50] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`rounded px-3 py-1 font-semibold transition-colors ${level === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Level {l}
            </button>
          ))}
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-white/5">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Pokémon</th>
                <th className="px-3 py-2">Base</th>
                <th className="px-3 py-2">0 EVs</th>
                <th className="px-3 py-2">252 EVs</th>
                <th className="px-3 py-2">252+</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, side, s0, s252, sPlus }, i) => (
                <tr key={`${side.label}-${m.pokemon.id}`} className="border-b border-white/5 last:border-0" style={{ background: `${side.color}0d` }}>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-1 rounded-full" style={{ background: side.color }} />
                      <Image src={m.pokemon.spriteUrl} alt="" width={32} height={32} className="size-7 object-contain" />
                      <span className="font-semibold">{m.pokemon.name}</span>
                      <span className="text-[10px] font-bold uppercase" style={{ color: side.color }}>{side.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-center tabular-nums">{m.pokemon.speed}</td>
                  <td className="px-3 py-1.5 text-center tabular-nums text-muted-foreground">{s0}</td>
                  <td className="px-3 py-1.5 text-center tabular-nums">{s252}</td>
                  <td className="px-3 py-1.5 text-center font-bold tabular-nums">{sPlus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function MoveCategoryCard({ label, you, opp, catKey }: { label: string; you: PrepTeam; opp: PrepTeam; catKey: string }) {
  const sideRows = [
    { side: YOU, team: you },
    { side: OPP, team: opp },
  ];
  const learnerCount = (t: PrepTeam) => new Set(t.categories[catKey].flatMap((r) => r.learners)).size;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
        <h3 className="font-bold">{label}</h3>
        <span className="ml-auto text-xs font-bold tabular-nums" style={{ color: YOU.color }}>{learnerCount(you)}</span>
        <span className="text-xs text-muted-foreground">vs</span>
        <span className="text-xs font-bold tabular-nums" style={{ color: OPP.color }}>{learnerCount(opp)}</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-white/5">
        {sideRows.map(({ side, team }) => {
          const byId = new Map(team.members.map((m) => [m.pokemon.id, m.pokemon]));
          const rows = team.categories[catKey];
          return (
            <div key={side.label} className="space-y-2 p-3" style={{ boxShadow: `inset 0 2px 0 ${side.color}55` }}>
              {rows.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">None</p>
              ) : (
                rows.map((r) => (
                  <div key={r.move}>
                    <span
                      className="inline-block rounded px-2 py-0.5 text-xs font-bold"
                      style={{ background: typeColors[r.type], color: "#ffffff", textShadow: "0 1px 1px rgba(0,0,0,0.45)" }}
                      title={`${r.type}-type`}
                    >
                      {r.move}
                    </span>
                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                      {r.learners.map((id) => {
                        const p = byId.get(id);
                        return p ? (
                          <Image key={id} src={p.spriteUrl} alt={p.name} title={p.name} width={28} height={28} className="size-7 rounded bg-white/[0.04] object-contain" />
                        ) : null;
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function NotesCard({
  teamId, vsId, oppName, notes,
}: {
  teamId: string; vsId: string; oppName: string;
  notes: { canEdit: boolean; text: string; updatedLabel: string | null };
}) {
  const [text, setText] = useState(notes.text);
  const [baseline, setBaseline] = useState(notes.text);
  const [saved, setSaved] = useState(notes.updatedLabel);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const dirty = text !== baseline;

  if (!notes.canEdit) {
    return (
      <Card className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
        <Lock size={16} /> Notes are private to each team. Pick your own team on the left to keep notes for this matchup.
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock size={12} /> Private to your team · saved for this opponent ({oppName})
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Game plan, leads, threats to watch, sets you expect…"
        maxLength={5000}
        className="min-h-40 w-full rounded-md border bg-background p-3 text-sm leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={pending || !dirty}
          onClick={() => {
            setError("");
            startTransition(async () => {
              try {
                const result = await saveMatchupNotes(teamId, vsId, text);
                if (result.error) return setError(result.error);
                setBaseline(text);
                setSaved("just now");
              } catch {
                setError("Couldn't save your notes. Try again.");
              }
            });
          }}
        >
          <Save size={14} className="mr-2" /> {pending ? "Saving…" : "Save notes"}
        </Button>
        {dirty && !pending && <span className="text-xs text-yellow-400">Unsaved changes</span>}
        {!dirty && saved && <span className="text-xs text-muted-foreground">Saved {saved}</span>}
        {error && <span className="text-xs text-red-400">✗ {error}</span>}
      </div>
    </Card>
  );
}
