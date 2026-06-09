import { getActiveSeason, getTeams } from "@/lib/data";
import { winPct } from "@/lib/utils";

export const revalidate = 0;

export default async function StandingsPage() {
  const season = await getActiveSeason();
  const teams = await getTeams(season?.id);

  // Sort by wins desc, then win % desc
  const sorted = [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return parseFloat(winPct(b.wins, b.losses)) - parseFloat(winPct(a.wins, a.losses));
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Standings</h1>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Team</th>
              <th className="p-3">Coach</th>
              <th className="p-3">W</th>
              <th className="p-3">L</th>
              <th className="p-3">Win %</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((team, idx) => (
              <tr key={team.id} className="border-t">
                <td className="p-3 text-muted-foreground">{idx + 1}</td>
                <td className="p-3 font-semibold">{team.teamName}</td>
                <td className="p-3 text-muted-foreground">{team.coach?.name ?? "—"}</td>
                <td className="p-3">{team.wins}</td>
                <td className="p-3">{team.losses}</td>
                <td className="p-3">{winPct(team.wins, team.losses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}