import { getActiveSeason, getTeams } from "@/lib/data";
import { TeamManagementClient } from "@/components/team-management-client";

export default async function TeamManagementPage() {
  const season = await getActiveSeason();
  const teams  = await getTeams(season.id);
  return <TeamManagementClient season={season} teams={teams} />;
}
