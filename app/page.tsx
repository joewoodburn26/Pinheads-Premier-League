import { TeamCard } from "@/components/team-card";
import { getActiveSeason, getTeams } from "@/lib/data";

export default async function HomePage() {
  const season = await getActiveSeason();
  const teams = await getTeams(season?.id);

  return (
    <div className="space-y-8">
      <section className="grid gap-3 py-8">
        <p className="text-sm font-bold uppercase tracking-[.24em] text-accent">Pokemon Draft League</p>
        <h1 className="max-w-4xl text-5xl font-black tracking-tight sm:text-7xl">Pinheads Draft</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {season?.name ?? "Current season"} command center for teams, match results, rosters, draft planning, rules, and league stats.
        </p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => <TeamCard key={team.id} team={team} />)}
      </section>
    </div>
  );
}
