import { DraftWorkspace } from "@/components/draft-workspace";
import { getActiveSeason, getPokemon } from "@/lib/data";

export default async function DraftPage() {
  const [season, pokemon] = await Promise.all([getActiveSeason(), getPokemon()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Draft Room</h1>
        <p className="text-muted-foreground">Browse legal Pokemon, edit costs, and test builds against a {season.draftBudget} point budget.</p>
      </div>
      <DraftWorkspace pokemon={pokemon} budget={season.draftBudget} />
    </div>
  );
}
