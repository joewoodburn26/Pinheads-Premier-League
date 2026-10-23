"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Lock, Save, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TypeBadge } from "@/components/type-badge";
import { MoveCategoryCard, OPP, Section, SideTitle, SpeedSection, WEAKNESS_HINT, WeaknessGrid, YOU } from "@/components/prep-parts";
import { saveMatchupNotes } from "@/lib/prep-actions";
import type { PrepMember, PrepTeam } from "@/lib/prep";

type TeamOption = { id: string; teamName: string; coachName: string };
type Category = { key: string; label: string };


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
      <Section id="grid" title="Weakness Grid" hint={WEAKNESS_HINT}>
        <div className="grid gap-4">
          <WeaknessGrid name={yourName} side={YOU} members={you.members} />
          <WeaknessGrid name={oppName} side={OPP} members={opp.members} />
        </div>
      </Section>

      {/* ── Speed tiers ──────────────────────────────────────────────── */}
      <SpeedSection sides={[{ side: YOU, members: you.members }, { side: OPP, members: opp.members }]} />

      {/* ── Moves ────────────────────────────────────────────────────── */}
      <Section id="moves" title="Moves" hint="Who can learn each utility move in this format.">
        <div className="grid gap-4 lg:grid-cols-2">
          {categories.map((cat) => (
            <MoveCategoryCard key={cat.key} label={cat.label} catKey={cat.key} sides={[{ side: YOU, team: you }, { side: OPP, team: opp }]} />
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
