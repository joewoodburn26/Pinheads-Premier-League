import { redirect } from "next/navigation";
import { PrepClient } from "@/components/prep-client";
import { Card } from "@/components/ui/card";
import { canEditTeam, canReport, getCurrentUser } from "@/lib/auth";
import { getActiveSeason, getRoster, getTeams } from "@/lib/data";
import { PREP_CATEGORIES, buildPrepTeam } from "@/lib/prep";
import { formatLabel } from "@/lib/dex";
import { getMatchupNotes } from "@/lib/prep-notes";
import type { Pokemon } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prep · Pinheads Premier League" };

export default async function PrepPage({ searchParams }: { searchParams: Promise<{ team?: string; vs?: string }> }) {
  // Coaches and above only
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/prep");
  if (!canReport(user)) redirect("/account/password");

  const season = await getActiveSeason();
  const teams = await getTeams(season?.id);
  if (teams.length < 2) {
    return <Card className="mx-auto mt-10 max-w-md p-8 text-center text-sm text-muted-foreground">Prep needs at least two teams in the active season.</Card>;
  }
  const byId = new Map(teams.map((t) => [t.id, t]));

  // ── Both teams must be picked (nothing is pre-selected) ───────────────────
  const params = await searchParams;
  const yourTeam = byId.get(params.team ?? "");
  const vsTeamRaw = byId.get(params.vs ?? "");
  const vsTeam = vsTeamRaw && vsTeamRaw.id !== yourTeam?.id ? vsTeamRaw : undefined;

  // ── Rosters → prep data ────────────────────────────────────────────────────
  let you = null;
  let opp = null;
  if (yourTeam && vsTeam) {
    const [yourSlots, vsSlots] = await Promise.all([getRoster(yourTeam.id), getRoster(vsTeam.id)]);
    const mons = (slots: typeof yourSlots) => slots.map((s) => s.pokemon).filter((p): p is Pokemon => Boolean(p));
    you = buildPrepTeam(mons(yourSlots), season?.format);
    opp = buildPrepTeam(mons(vsSlots), season?.format);
  }

  // ── Private notes (only for a team you can edit) ───────────────────────────
  const canNote = !!yourTeam && !!vsTeam && canEditTeam(user, yourTeam.coachId);
  const saved = canNote ? await getMatchupNotes(yourTeam!.id, vsTeam!.id) : { notes: "", updatedAt: null };
  const updatedLabel = saved.updatedAt
    ? new Date(saved.updatedAt).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
      })
    : null;

  return (
    <PrepClient
      teams={teams
        .map((t) => ({ id: t.id, teamName: t.teamName, coachName: t.coach?.name ?? "" }))
        .sort((a, b) => a.teamName.localeCompare(b.teamName))}
      yourTeamId={yourTeam?.id ?? ""}
      vsTeamId={vsTeam?.id ?? ""}
      you={you}
      opp={opp}
      categories={PREP_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))}
      formatLabel={formatLabel(season?.format)}
      notes={{ canEdit: canNote, text: saved.notes, updatedLabel }}
    />
  );
}
