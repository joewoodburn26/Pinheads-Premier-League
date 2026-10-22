import { getActiveSeason, getPokemon } from "@/lib/data";
import { DraftWorkspace, type LoadedPlan, type PlanContext } from "@/components/draft-workspace";
import { canEditTeam, canReport, getCurrentUser } from "@/lib/auth";
import { getMyTeam, getPlan } from "@/lib/plans";
import { getTeams } from "@/lib/data";
import { abilitiesOf, filterAvailable, formatLabel, moveOptions } from "@/lib/dex";

export const revalidate = 0;

export default async function DraftPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const season = await getActiveSeason();
  const [allPokemon, user] = await Promise.all([getPokemon(), getCurrentUser()]);

  if (!season) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-black">Draft Room</h1>
        <p className="text-muted-foreground">No active season found. Set an active season in Settings.</p>
      </div>
    );
  }

  // ── Format: Champions seasons only offer Pokémon that are in Champions ──
  const pokemon = filterAvailable(allPokemon, season.format);
  const abilitiesById = Object.fromEntries(pokemon.map((p) => [p.id, abilitiesOf(p)]));

  // ── Who can save plans, and to which team ──
  const myTeam = canReport(user) ? await getMyTeam(user, season.id) : undefined;
  const planContext: PlanContext = myTeam
    ? { canSave: true, teamId: myTeam.id, teamName: myTeam.teamName }
    : {
        canSave: false,
        reason: !user
          ? "Sign in to save this team as a private draft plan."
          : "Your account isn't linked to a team, so plans can't be saved yet.",
      };

  // ── Plan opened with "Open in Draft Room" (only for people who can see it) ──
  const { plan: planId } = await searchParams;
  let initialPlan: LoadedPlan | null = null;
  if (planId) {
    const plan = await getPlan(planId);
    if (plan) {
      const team = (await getTeams(season.id)).find((t) => t.id === plan.teamId);
      if (team && canEditTeam(user, team.coachId)) {
        initialPlan = { id: plan.id, name: plan.name, teamId: plan.teamId, picks: plan.picks };
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black">Draft Room</h1>
        <p className="text-muted-foreground">
          Browse legal Pokémon, edit costs, and test builds against a {season.draftBudget} point budget.
        </p>
      </div>
      <DraftWorkspace
        pokemon={pokemon}
        budget={season.draftBudget}
        seasonName={season.name}
        planContext={planContext}
        initialPlan={initialPlan}
        abilitiesById={abilitiesById}
        moveOptions={moveOptions(season.format)}
        formatLabel={formatLabel(season.format)}
      />
    </div>
  );
}
