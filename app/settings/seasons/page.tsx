import { getSeasons, getActiveSeason, getTeams } from "@/lib/data";
import { SeasonManagementClient } from "@/components/season-management-client";

export default async function SeasonManagementPage() {
  const [seasons, activeSeason] = await Promise.all([getSeasons(), getActiveSeason()]);
  const teams = activeSeason ? await getTeams(activeSeason.id) : [];
  return <SeasonManagementClient seasons={seasons} teams={teams} />;
}
