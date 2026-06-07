import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { archiveSeason, createSeason, duplicateSeason, setActiveSeason } from "@/lib/actions";
import { getSeasons } from "@/lib/data";

export default async function SeasonsPage() {
  const seasons = await getSeasons();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Season Management</h1>
      <form action={createSeason} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_160px_120px]">
        <Input name="name" placeholder="Season 2028" />
        <Input name="draftBudget" type="number" defaultValue={105} />
        <Button>Create</Button>
      </form>
      <div className="grid gap-3">
        {seasons.map((season) => (
          <div key={season.id} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_140px_120px_120px]">
            <div>
              <p className="font-semibold">{season.name}</p>
              <p className="text-sm text-muted-foreground">{season.draftBudget} point budget {season.archived ? "· Archived" : ""}</p>
            </div>
            <form action={setActiveSeason}>
              <input type="hidden" name="seasonId" value={season.id} />
              <Button variant={season.activeSeason ? "primary" : "secondary"} disabled={season.activeSeason}>Active</Button>
            </form>
            <form action={duplicateSeason} className="flex gap-2">
              <input type="hidden" name="seasonId" value={season.id} />
              <input type="hidden" name="name" value={`${season.name} Copy`} />
              <Button variant="secondary">Duplicate</Button>
            </form>
            <form action={archiveSeason}>
              <input type="hidden" name="seasonId" value={season.id} />
              <Button variant="secondary">Archive</Button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
