import { getSeasons } from "@/lib/data";
import { SeasonManagementClient } from "@/components/season-management-client";

export default async function SeasonManagementPage() {
  const seasons = await getSeasons();
  return <SeasonManagementClient seasons={seasons} />;
}
