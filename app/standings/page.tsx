import { getActiveSeason, getTeams } from "@/lib/data";
import { winPct } from "@/lib/utils";

export default async function StandingsPage() {
  const season = await getActiveSeason();
  const teams = await getTeams(season?.id);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Standings</h1>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="p-3">Team</th>
              <th className="p-3">Coach</th>
              <th className="p-3">Wins</th>
              <th className="p-3">Losses</th>
              <th className="p-3">Win %</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-t">
                <td className="p-3 font-semibold">{team.teamName}</td>
                <td className="p-3 text-muted-foreground">{team.coach?.name}</td>
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
