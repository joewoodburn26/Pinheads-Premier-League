import { denied, requireAdmin } from "@/lib/auth";
import { getListPokemon, getPointLists } from "@/lib/data";
import { filterAvailable, formatLabel } from "@/lib/dex";
import { buildPointsWorkbook } from "@/lib/points-workbook";

export const dynamic = "force-dynamic";

/** Excel download of a point list: /api/point-lists/<id>/workbook?format=gen9 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await denied(requireAdmin);
  if (blocked) return new Response(blocked, { status: 403 });

  const { id } = await params;
  const list = (await getPointLists()).find((l) => l.id === id);
  if (!list) return new Response("Point list not found.", { status: 404 });

  const format = new URL(request.url).searchParams.get("format") ?? "all";
  const legal = filterAvailable(await getListPokemon(id), format);
  const file = await buildPointsWorkbook({
    listName: list.name,
    formatName: formatLabel(format),
    pokemon: legal.filter((p) => !p.banned),
    banned: legal.filter((p) => p.banned),
  });

  const safe = list.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "points";
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="points-${safe}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
