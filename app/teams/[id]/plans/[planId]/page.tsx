import { notFound } from "next/navigation";
import { PlanView } from "@/components/plan-view";
import { canEditTeam, getCurrentUser } from "@/lib/auth";
import { getActiveSeason, getPokemon, getTeams } from "@/lib/data";
import { getPlan, resolvePicks } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Draft Plan · Pinheads Premier League" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export default async function PlanPage({ params }: { params: Promise<{ id: string; planId: string }> }) {
  const { id, planId } = await params;
  const [plan, user, season] = await Promise.all([getPlan(planId), getCurrentUser(), getActiveSeason()]);
  if (!plan || plan.teamId !== id) notFound();

  const team = (await getTeams(season?.id)).find((t) => t.id === id);
  // Private: anyone who can't edit this team gets a plain 404, so plans stay hidden
  if (!team || !canEditTeam(user, team.coachId)) notFound();

  const allPokemon = await getPokemon();
  const slots = resolvePicks(plan.picks, allPokemon);

  return (
    <PlanView
      planId={plan.id}
      planName={plan.name}
      teamId={team.id}
      teamName={team.teamName}
      slots={slots}
      budget={season?.draftBudget ?? 105}
      seasonName={season?.name}
      updatedLabel={formatDate(plan.updatedAt)}
      createdByName={plan.createdByName}
      missing={plan.picks.length - slots.length}
    />
  );
}
