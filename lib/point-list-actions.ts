"use server";

// Point lists: named sets of point values + bans that seasons use.
// Every action is admin-only and returns { error } instead of throwing so the
// settings pages can show the real reason.

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { POKEDEX_TAG } from "@/lib/data";
import { readPointsWorkbook } from "@/lib/points-workbook";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createListCopy, listRows, pokedexRows, upsertRows, type Row } from "@/lib/point-lists-store";
import { hasSupabaseEnv } from "@/lib/supabase/server";

type Result = { error?: string };
type Supabase = ReturnType<typeof createSupabaseAdminClient>;

async function run<T extends object = Result>(fn: (supabase: Supabase) => Promise<T | void>): Promise<T & Result> {
  try {
    await requireAdmin();
    if (!hasSupabaseEnv()) throw new Error("Supabase isn't configured.");
    return ((await fn(createSupabaseAdminClient())) ?? {}) as T & Result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." } as T & Result;
  }
}

function refresh() {
  revalidateTag(POKEDEX_TAG);
  revalidatePath("/", "layout");
}

const cleanName = (name: string) => {
  const n = name.trim();
  if (!n) throw new Error("Give the list a name.");
  if (n.length > 60) throw new Error("Keep the name under 60 characters.");
  return n;
};

const duplicateMessage = (msg: string, name: string) =>
  msg.includes("duplicate") ? `A list called “${name}” already exists.` : msg;

/** New list, copied from another list (or the Pokédex values when no source is given). */
export async function createPointList(name: string, copyFromListId: string | null): Promise<Result & { id?: string }> {
  return run(async (supabase) => {
    const id = await createListCopy(supabase, cleanName(name), copyFromListId);
    refresh();
    return { id };
  });
}

export async function renamePointList(listId: string, name: string): Promise<Result> {
  return run(async (supabase) => {
    const n = cleanName(name);
    const { error } = await supabase.from("point_lists").update({ name: n }).eq("id", listId);
    if (error) throw new Error(duplicateMessage(error.message, n));
    refresh();
  });
}

export async function deletePointList(listId: string): Promise<Result> {
  return run(async (supabase) => {
    const { data: users } = await supabase.from("seasons").select("name").eq("point_list_id", listId);
    if (users && users.length > 0) {
      throw new Error(`Still used by ${users.map((s) => s.name).join(", ")}. Switch those seasons to another list first.`);
    }
    const { error } = await supabase.from("point_lists").delete().eq("id", listId);
    if (error) throw new Error(error.message);
    refresh();
  });
}

export type PointChange = { pokemonId: string; points: number; banned: boolean };

/** Save edits made on the Point Restructure page (points and bans together). */
export async function savePointListChanges(listId: string, changes: PointChange[]): Promise<Result> {
  return run(async (supabase) => {
    for (const c of changes) {
      if (!Number.isInteger(c.points) || c.points < 0 || c.points > 999) throw new Error("Points must be whole numbers from 0 to 999.");
    }
    await upsertRows(
      supabase,
      listId,
      changes.map((c) => ({ pokemon_id: c.pokemonId, point_value: c.points, banned: c.banned })),
    );
    refresh();
  });
}

/** Switch which list a season uses. */
export async function setSeasonPointList(seasonId: string, listId: string): Promise<Result> {
  return run(async (supabase) => {
    const { error } = await supabase.from("seasons").update({ point_list_id: listId }).eq("id", seasonId);
    if (error) throw new Error(error.message);
    refresh();
  });
}

/** Give a season its own copy of the list it uses now, named after the season. */
export async function splitSeasonPointList(seasonId: string): Promise<Result> {
  return run(async (supabase) => {
    const { data: season } = await supabase.from("seasons").select("name, point_list_id").eq("id", seasonId).single();
    if (!season) throw new Error("Season not found.");
    const id = await createListCopy(supabase, `${season.name} points`, (season.point_list_id as string | null) ?? null);
    await supabase.from("seasons").update({ point_list_id: id }).eq("id", seasonId);
    refresh();
  });
}

/**
 * Upload an edited workbook. Only the chosen list changes, and only the Pokémon
 * whose points differ from the list's current value; everything else is left alone.
 */
export async function importPointsWorkbook(
  listId: string,
  formData: FormData,
): Promise<Result & { updated?: number; unchanged?: number; notFound?: string[] }> {
  return run(async (supabase) => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
    if (file.size > 5_000_000) throw new Error("That file is too big (5 MB max).");
    const rows = await readPointsWorkbook(await file.arrayBuffer(), file.name);

    const current = new Map((await listRows(supabase, listId)).map((r) => [r.pokemon_id, r]));
    const dex = await pokedexRows(supabase);
    const dexById = new Map(dex.map((r) => [r.pokemon_id, r]));

    // Rows carry the Pokémon's id; names are a fallback for hand-made sheets
    const { data: names } = await supabase.from("pokemon").select("id, name").limit(5000);
    const byName = new Map((names ?? []).map((p) => [String(p.name).toLowerCase(), p.id as string]));

    const changes: Row[] = [];
    const notFound: string[] = [];
    let unchanged = 0;
    for (const r of rows) {
      const id = (r.id && dexById.has(r.id) ? r.id : undefined) ?? byName.get(r.name.toLowerCase());
      if (!id) {
        notFound.push(r.name || r.id || "?");
        continue;
      }
      const before = current.get(id) ?? dexById.get(id)!;
      if (before.point_value === r.points && current.has(id)) {
        unchanged++;
        continue;
      }
      changes.push({ pokemon_id: id, point_value: r.points, banned: before.banned });
    }
    if (changes.length > 0) await upsertRows(supabase, listId, changes);
    refresh();
    return { updated: changes.length, unchanged, notFound };
  });
}
