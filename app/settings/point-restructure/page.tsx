import { Card } from "@/components/ui/card";
import { PointsClient, type PointsMon } from "@/components/points/points-client";
import { getActiveSeason, getListPokemon, getPointLists } from "@/lib/data";
import { findSpecies } from "@/lib/dex";

export const revalidate = 0;

const GEN_LAST_DEX = [151, 251, 386, 493, 649, 721, 809, 905];
const genOfDex = (dex: number) => {
  const i = GEN_LAST_DEX.findIndex((last) => dex <= last);
  return i < 0 ? 9 : i + 1;
};

export default async function PointRestructurePage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const [lists, active, { list: listParam }] = await Promise.all([getPointLists(), getActiveSeason(), searchParams]);

  if (lists.length === 0) {
    return (
      <Card className="mx-auto mt-10 max-w-xl space-y-3 p-8">
        <h1 className="text-2xl font-black">Point lists aren&apos;t set up yet</h1>
        <p className="text-sm text-muted-foreground">
          Run <code className="rounded bg-muted px-1">supabase/point-lists.sql</code> once in the Supabase SQL editor, then reload this page.
        </p>
      </Card>
    );
  }

  const list =
    lists.find((l) => l.id === listParam) ??
    lists.find((l) => l.seasons.some((s) => s.id === active?.id)) ??
    lists[0];
  const defaultList = lists.find((l) => l.name.toLowerCase() === "default");

  const [pokemon, defaults] = await Promise.all([
    getListPokemon(list.id),
    defaultList && defaultList.id !== list.id ? getListPokemon(defaultList.id) : Promise.resolve(null),
  ]);
  const defaultPoints = defaults ? new Map(defaults.map((p) => [p.id, p.pointValue])) : null;

  const mons: PointsMon[] = pokemon.map((p) => {
    const species = findSpecies(p);
    return {
      ...p,
      gen: species?.g ?? genOfDex(p.dexNumber),
      champions: Boolean(species?.ch),
      defaultPoints: defaultPoints?.get(p.id) ?? null,
    };
  });

  // Start with the format of a season using this list (the active one first)
  const user = list.seasons.find((s) => s.activeSeason) ?? list.seasons[0];

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-4xl font-black max-md:text-3xl">Point Restructure</h1>
        <p className="mt-1 text-muted-foreground">
          Points and bans live in point lists. Each season uses one list, and editing a list changes every season using it.
        </p>
      </div>
      <PointsClient
        key={list.id}
        lists={lists}
        list={list}
        pokemon={mons}
        hasDefault={Boolean(defaultPoints)}
        initialFormat={user?.format ?? "all"}
      />
    </div>
  );
}
