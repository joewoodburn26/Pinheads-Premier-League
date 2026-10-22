import { redirect } from "next/navigation";
import { PrepClient } from "@/components/prep-client";
import { Card } from "@/components/ui/card";
import { canEditTeam, canReport, getCurrentUser } from "@/lib/auth";
import { getActiveSeason, getRoster, getSchedule, getTeams } from "@/lib/data";
import { getMyTeam } from "@/lib/plans";
import { PREP_CATEGORIES, buildPrepTeam } from "@/lib/prep";
import { getMatchupNotes } from "@/lib/prep-notes";
import type { Pokemon } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prep · Pinheads Premier League" };

const FORMAT_LABELS: Record<string, string> = {
  all: "All Pokémon · latest learnsets",
  gen9: "Gen 9 National Dex",
  champs: "Pokémon Champions · latest learnsets",
};

export default async function PrepPage({ searchParams }: { searchParams: Promise<{ team?: string; vs?: string }> }) {
  // Coaches and above only
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/prep");
  if (!canReport(user)) redirect("/account/password");

  const season = await getActiveSeason();
  const [teams, matches] = await Promise.all([getTeams(season?.id), getSchedule(season?.id ?? "")]);
  if (teams.length < 2) {
    return <Card className="mx-auto mt-10 max-w-md p-8 text-center text-sm text-muted-foreground">Prep needs at least two teams in the active season.</Card>;
  }
  const byId = new Map(teams.map((t) => [t.id, t]));

  // ── Pick the two teams ─────────────────────────────────────────────────────
  const params = await searchParams;
  const myTeam = await getMyTeam(user, season?.id);
  const yourTeam = byId.get(params.team ?? "") ?? myTeam ?? teams[0];

  // Default opponent: your next unplayed scheduled match, else the first other team
  const nextMatch = [...matches]
    .sort((a, b) => a.week - b.week)
    .find((m) => !m.isBye && !m.winner && (m.homeTeam === yourTeam.id || m.awayTeam === yourTeam.id));
  const nextOppId = nextMatch ? (nextMatch.homeTeam === yourTeam.id ? nextMatch.awayTeam : nextMatch.homeTeam) : undefined;
  const requested = byId.get(params.vs ?? "");
  const vsTeam =
    (requested && requested.id !== yourTeam.id ? requested : undefined) ??
    (nextOppId ? byId.get(nextOppId) : undefined) ??
    teams.find((t) => t.id !== yourTeam.id)!;

  // ── Rosters → prep data ────────────────────────────────────────────────────
  const [yourSlots, vsSlots] = await Promise.all([getRoster(yourTeam.id), getRoster(vsTeam.id)]);
  const mons = (slots: typeof yourSlots) => slots.map((s) => s.pokemon).filter((p): p is Pokemon => Boolean(p));
  const you = buildPrepTeam(mons(yourSlots), season?.format);
  const opp = buildPrepTeam(mons(vsSlots), season?.format);

  // ── Private notes (only for a team you can edit) ───────────────────────────
  const canNote = canEditTeam(user, yourTeam.coachId);
  const saved = canNote ? await getMatchupNotes(yourTeam.id, vsTeam.id) : { notes: "", updatedAt: null };
  const updatedLabel = saved.updatedAt
    ? new Date(saved.updatedAt).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
      })
    : null;

  const gen = /^gen(\d)$/.exec(season?.format ?? "");
  const formatLabel = gen ? `Gen ${gen[1]} National Dex` : FORMAT_LABELS[season?.format ?? "all"] ?? "Latest learnsets";

  return (
    <PrepClient
      teams={teams
        .map((t) => ({ id: t.id, teamName: t.teamName, coachName: t.coach?.name ?? "" }))
        .sort((a, b) => a.teamName.localeCompare(b.teamName))}
      yourTeamId={yourTeam.id}
      vsTeamId={vsTeam.id}
      you={you}
      opp={opp}
      categories={PREP_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))}
      formatLabel={formatLabel}
      notes={{ canEdit: canNote, text: saved.notes, updatedLabel }}
    />
  );
}
