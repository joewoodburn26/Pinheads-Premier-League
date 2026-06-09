import { getSeasons } from "@/lib/data";
import { winPct } from "@/lib/utils";

export default async function SeasonsPage() {
  const seasons = await getSeasons();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Season History</h1>
        <p className="text-muted-foreground">
          Read-only record of all seasons. To create, manage, or delete seasons go to{" "}
          <a href="/settings/seasons" className="underline hover:text-foreground">
            Settings → Season Management
          </a>.
        </p>
      </div>

      <div className="space-y-4">
        {seasons.map((season) => (
          <div key={season.id} className={`rounded-lg border p-4 ${season.activeSeason ? "border-primary bg-primary/5" : ""}`}>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{season.name}</h2>
              {season.activeSeason && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                  ACTIVE
                </span>
              )}
              {season.archived && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  ARCHIVED
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Draft budget: {season.draftBudget} pts · Created {new Date(season.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}