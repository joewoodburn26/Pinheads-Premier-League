import { getActiveSeason, getStats, getTeams } from "@/lib/data";

export default async function StatsPage() {
  const season = await getActiveSeason();
  const [stats, teams] = await Promise.all([getStats(season.id), getTeams(season.id)]);
  const topKos = [...stats].sort((a, b) => b.kos - a.kos).slice(0, 3);
  const topDeaths = [...stats].sort((a, b) => b.deaths - a.deaths).slice(0, 3);
  const topGames = [...stats].sort((a, b) => b.gamesPlayed - a.gamesPlayed).slice(0, 3);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Pokemon Stats</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Leaderboard title="Top 3 KOs" rows={topKos.map((row) => [row.pokemon?.name ?? row.pokemonId, row.kos])} />
        <Leaderboard title="Top 3 Deaths" rows={topDeaths.map((row) => [row.pokemon?.name ?? row.pokemonId, row.deaths])} />
        <Leaderboard title="Top 3 Games Played" rows={topGames.map((row) => [row.pokemon?.name ?? row.pokemonId, row.gamesPlayed])} />
      </div>
      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <select className="h-10 rounded-md border bg-background px-3"><option>{season.name}</option></select>
        <select className="h-10 rounded-md border bg-background px-3"><option>All Teams</option>{teams.map((team) => <option key={team.id}>{team.teamName}</option>)}</select>
        <input className="h-10 rounded-md border bg-background px-3" placeholder="Coach" />
        <input className="h-10 rounded-md border bg-background px-3" placeholder="Pokemon" />
      </div>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr><th className="p-3">Pokemon</th><th className="p-3">Team</th><th className="p-3">GP</th><th className="p-3">W</th><th className="p-3">L</th><th className="p-3">KOs</th><th className="p-3">Deaths</th></tr>
          </thead>
          <tbody>
            {stats.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3 font-semibold">{row.pokemon?.name ?? row.pokemonId}</td>
                <td className="p-3 text-muted-foreground">{teams.find((team) => team.id === row.teamId)?.teamName ?? ""}</td>
                <td className="p-3">{row.gamesPlayed}</td><td className="p-3">{row.wins}</td><td className="p-3">{row.losses}</td><td className="p-3">{row.kos}</td><td className="p-3">{row.deaths}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Leaderboard({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="font-bold">{title}</h2>
      <ol className="mt-3 space-y-2 text-sm">
        {rows.map(([name, value]) => <li key={name} className="flex justify-between"><span>{name}</span><b>{value}</b></li>)}
      </ol>
    </div>
  );
}
