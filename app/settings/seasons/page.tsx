import { getPointLists, getSeasons, getTeams } from "@/lib/data";
import { SeasonManagementClient } from "@/components/season-management-client";

export default async function SeasonManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; tab?: string }>;
}) {
  const [seasons, pointLists, { season: seasonParam, tab }] = await Promise.all([getSeasons(), getPointLists(), searchParams]);
  const selected =
    seasons.find((s) => s.id === seasonParam) ?? seasons.find((s) => s.activeSeason) ?? seasons.find((s) => !s.archived) ?? seasons[0];
  const teams = selected ? await getTeams(selected.id) : [];
  return (
    <SeasonManagementClient
      key={selected?.id ?? "none"}
      seasons={seasons}
      selected={selected}
      teams={teams}
      pointLists={pointLists}
      initialTab={tab}
    />
  );
}
