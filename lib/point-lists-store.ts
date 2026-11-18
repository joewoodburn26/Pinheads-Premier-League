// Point-list database helpers shared by the point-list and season actions.
// Not a "use server" file, so none of this is callable from the browser.

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Supabase = ReturnType<typeof createSupabaseAdminClient>;

export type Row = { pokemon_id: string; point_value: number; banned: boolean };

/** All of a list's rows (Supabase returns at most 1,000 per request). */
export async function listRows(supabase: Supabase, listId: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("point_list_values")
      .select("pokemon_id, point_value, banned")
      .eq("list_id", listId)
      .order("pokemon_id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) return out;
  }
}

/** The Pokédex's own values, for Pokémon a list doesn't cover yet. */
export async function pokedexRows(supabase: Supabase): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("pokemon").select("id, point_value, banned").order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const p of data ?? []) out.push({ pokemon_id: p.id, point_value: p.point_value, banned: Boolean(p.banned) });
    if (!data || data.length < 1000) return out;
  }
}

export async function upsertRows(supabase: Supabase, listId: string, rows: Row[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from("point_list_values")
      .upsert(rows.slice(i, i + 500).map((r) => ({ list_id: listId, ...r })), { onConflict: "list_id,pokemon_id" });
    if (error) throw new Error(error.message);
  }
}

/** Shared with season creation: makes the list and fills it in. */
export async function createListCopy(supabase: Supabase, name: string, copyFromListId: string | null): Promise<string> {
  const { data, error } = await supabase.from("point_lists").insert({ name }).select("id").single();
  if (error || !data) throw new Error(error?.message?.includes("duplicate") ? `A list called “${name}” already exists.` : error?.message ?? "Couldn't create the list.");
  const id = data.id as string;
  try {
    const source = copyFromListId ? await listRows(supabase, copyFromListId) : [];
    // Pokémon the source doesn't cover get the Pokédex values, so the new list is complete
    const covered = new Set(source.map((r) => r.pokemon_id));
    const rest = (await pokedexRows(supabase)).filter((r) => !covered.has(r.pokemon_id));
    await upsertRows(supabase, id, [...source, ...rest]);
  } catch (err) {
    await supabase.from("point_lists").delete().eq("id", id);
    throw err;
  }
  return id;
}

