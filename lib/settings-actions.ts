"use server";

// Season & team management. These return { error } instead of throwing so the
// settings page can show the real reason (production hides thrown messages).

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Result = { error?: string };
type Supabase = ReturnType<typeof createSupabaseAdminClient>;

async function run(fn: () => Promise<void>): Promise<Result> {
  try {
    await requireAdmin();
    await fn();
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

function refreshAll() {
  revalidatePath("/", "layout");
}

const bool = (v: FormDataEntryValue | null) => String(v) === "true";

/** New team with its own placeholder coach (rename it on the team page). */
async function createTeam(
  supabase: Supabase,
  seasonId: string,
  team: { name: string; coachId?: string | null; logoUrl?: string | null; draftOrder: number },
): Promise<string> {
  let coachId = team.coachId ?? null;
  if (!coachId) {
    const { data: coach, error } = await supabase.from("coaches").insert({ name: "TBD" }).select("id").single();
    if (error || !coach) throw new Error(`Couldn't create a coach for ${team.name}: ${error?.message ?? "unknown error"}`);
    coachId = coach.id as string;
  }
  const { data, error } = await supabase
    .from("teams")
    .insert({
      season_id: seasonId,
      coach_id: coachId,
      team_name: team.name,
      logo_url: team.logoUrl ?? null,
      wins: 0,
      losses: 0,
      draft_order: team.draftOrder,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Couldn't create ${team.name}: ${error?.message ?? "unknown error"}`);
  return data.id as string;
}

/** Round-robin schedule (one bye per week for odd team counts), max 8 weeks. */
async function buildSchedule(supabase: Supabase, seasonId: string) {
  const { data: teams, error: teamsError } = await supabase.from("teams").select("id").eq("season_id", seasonId);
  if (teamsError) throw new Error(teamsError.message);

  const { error: delError } = await supabase.from("schedule_matches").delete().eq("season_id", seasonId);
  if (delError) throw new Error(delError.message);
  if (!teams || teams.length < 2) return;

  const ids: string[] = teams.map((t) => t.id as string);
  if (ids.length % 2 !== 0) ids.push("BYE");
  const n = ids.length;
  const weeks = Math.min(n - 1, 8);
  const rows: Record<string, unknown>[] = [];

  for (let round = 0; round < weeks; round++) {
    for (let i = 0; i < n / 2; i++) {
      const home = ids[i];
      const away = ids[n - 1 - i];
      if (home !== "BYE" && away !== "BYE") {
        rows.push({ season_id: seasonId, week: round + 1, home_team: home, away_team: away, winner: null, is_bye: false });
      }
    }
    ids.splice(1, 0, ids.pop()!);
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("schedule_matches").insert(rows);
    if (error) throw new Error(error.message);
  }
}

// ─── Season actions ───────────────────────────────────────────────────────────

export async function createNewSeason(formData: FormData): Promise<Result> {
  return run(async () => {
    const supabase = createSupabaseAdminClient();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new Error("Give the season a name.");
    const draftBudget = Number(formData.get("budget") ?? formData.get("draftBudget") ?? 105) || 105;
    const rosterSize = Number(formData.get("rosterSize") ?? 10) || 10;
    const format = String(formData.get("format") ?? "all") || "all";
    const teamCount = Math.min(12, Math.max(2, Number(formData.get("teamCount") ?? 8) || 8));
    const sourceSeasonId = String(formData.get("sourceSeasonId") ?? "");
    const copyNames = bool(formData.get("copyNames"));
    const copyCoaches = bool(formData.get("copyCoaches"));
    const copyRosters = bool(formData.get("copyRosters"));
    const copyLogos = bool(formData.get("copyLogos"));
    const copyPoints = bool(formData.get("copyPoints"));
    const pointsSourceId = String(formData.get("pointsSourceId") ?? "") || sourceSeasonId;

    // 1. Season
    const { data: season, error } = await supabase
      .from("seasons")
      .insert({ name, draft_budget: draftBudget, roster_size: rosterSize, format, active_season: false, archived: false })
      .select("id")
      .single();
    if (error || !season) {
      throw new Error(
        error?.message?.includes("duplicate") ? `A season called “${name}” already exists.` : error?.message ?? "Couldn't create the season.",
      );
    }
    const seasonId = season.id as string;

    try {
      // 2. Teams (copied from another season where asked, "Team N" otherwise)
      type SourceTeam = { id: string; team_name: string; coach_id: string | null; logo_url: string | null };
      let sourceTeams: SourceTeam[] = [];
      if (sourceSeasonId) {
        const { data } = await supabase
          .from("teams")
          .select("id, team_name, coach_id, logo_url, draft_order")
          .eq("season_id", sourceSeasonId)
          .order("draft_order", { ascending: true, nullsFirst: false })
          .order("team_name");
        sourceTeams = (data ?? []) as SourceTeam[];
      }

      for (let i = 0; i < teamCount; i++) {
        const src = sourceTeams[i];
        const teamId = await createTeam(supabase, seasonId, {
          name: copyNames && src ? src.team_name : `Team ${i + 1}`,
          coachId: copyCoaches && src ? src.coach_id : null,
          logoUrl: copyLogos && src ? src.logo_url : null,
          draftOrder: i,
        });

        if (copyRosters && src) {
          const { data: slots } = await supabase
            .from("team_pokemon")
            .select("pokemon_id, slot_order")
            .eq("team_id", src.id);
          if (slots && slots.length > 0) {
            const { error: rosterError } = await supabase
              .from("team_pokemon")
              .insert(slots.map((s) => ({ season_id: seasonId, team_id: teamId, pokemon_id: s.pokemon_id, slot_order: s.slot_order })));
            if (rosterError) throw new Error(`Couldn't copy a roster: ${rosterError.message}`);
          }
        }
      }

      // 3. Season point values
      if (copyPoints && pointsSourceId) {
        const { data: points, error: pointsError } = await supabase
          .from("season_point_values")
          .select("pokemon_id, point_value")
          .eq("season_id", pointsSourceId);
        if (pointsError) throw new Error(`Couldn't copy points: ${pointsError.message}`);
        if (points && points.length > 0) {
          const { error: insError } = await supabase
            .from("season_point_values")
            .insert(points.map((p) => ({ season_id: seasonId, pokemon_id: p.pokemon_id, point_value: p.point_value })));
          if (insError) throw new Error(`Couldn't copy points: ${insError.message}`);
        }
      }

      // 4. Schedule
      await buildSchedule(supabase, seasonId);
    } catch (err) {
      // Don't leave a half-made season behind
      await supabase.from("seasons").delete().eq("id", seasonId);
      throw err;
    }

    refreshAll();
  });
}

export async function setActiveSeason(seasonId: string): Promise<Result> {
  return run(async () => {
    const supabase = createSupabaseAdminClient();
    const { error: offError } = await supabase.from("seasons").update({ active_season: false }).neq("id", seasonId);
    if (offError) throw new Error(offError.message);
    const { error } = await supabase.from("seasons").update({ active_season: true }).eq("id", seasonId);
    if (error) throw new Error(error.message);
    refreshAll();
  });
}

export async function archiveSeason(seasonId: string): Promise<Result> {
  return run(async () => {
    const { error } = await createSupabaseAdminClient()
      .from("seasons")
      .update({ archived: true, active_season: false })
      .eq("id", seasonId);
    if (error) throw new Error(error.message);
    refreshAll();
  });
}

export async function deleteSeason(seasonId: string): Promise<Result> {
  return run(async () => {
    const { error } = await createSupabaseAdminClient().from("seasons").delete().eq("id", seasonId);
    if (error) throw new Error(error.message);
    refreshAll();
  });
}

export async function updateRosterSize(seasonId: string, rosterSize: number): Promise<Result> {
  return run(async () => {
    const { error } = await createSupabaseAdminClient().from("seasons").update({ roster_size: rosterSize }).eq("id", seasonId);
    if (error) throw new Error(error.message);
    refreshAll();
  });
}

export async function updateSeasonFormat(seasonId: string, format: string): Promise<Result> {
  return run(async () => {
    const { error } = await createSupabaseAdminClient().from("seasons").update({ format }).eq("id", seasonId);
    if (error) throw new Error(error.message);
    refreshAll();
  });
}

/**
 * CSV of "name or dex number, points". With a seasonId the values are saved as
 * that season's points; without one they change the base Pokédex points.
 */
export async function updatePointsFromCsv(
  csv: string,
  seasonId?: string,
): Promise<Result & { updated?: number; notFound?: string[] }> {
  let updated = 0;
  const notFound: string[] = [];
  const result = await run(async () => {
    const supabase = createSupabaseAdminClient();
    // Split a CSV line, respecting "quoted, values"
    const cells = (line: string): string[] => {
      const out: string[] = [];
      let cur = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') quoted = false;
          else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ",") { out.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      out.push(cur.trim());
      return out;
    };

    const lines = csv.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
    // Works with the downloaded CSV (Name … Points columns) or a simple "name,points" list
    const header = cells(lines[0] ?? "").map((h) => h.toLowerCase());
    const hasHeader = header.includes("points");
    const nameCol = hasHeader ? header.indexOf("name") : 0;
    const dexCol = hasHeader ? header.findIndex((h) => h.startsWith("pokedex")) : -1;
    const pointsCol = hasHeader ? header.indexOf("points") : 1;

    const rows: { key: string; pointValue: number }[] = [];
    for (const line of hasHeader ? lines.slice(1) : lines) {
      const parts = cells(line);
      const key = (nameCol >= 0 ? parts[nameCol] : "") || (dexCol >= 0 ? parts[dexCol] : "") || "";
      const pts = Number(parts[pointsCol]);
      if (!key || parts[pointsCol] === undefined || parts[pointsCol] === "" || isNaN(pts)) continue;
      rows.push({ key, pointValue: pts });
    }
    if (rows.length === 0) throw new Error("No valid rows found in the CSV.");

    const { data: allMons, error: monsError } = await supabase.from("pokemon").select("id, name, dex_number");
    if (monsError) throw new Error(monsError.message);
    const byName = new Map((allMons ?? []).map((p) => [String(p.name).toLowerCase(), p.id as string]));
    const byDex = new Map<number, string>();
    for (const p of allMons ?? []) if (!byDex.has(p.dex_number)) byDex.set(p.dex_number as number, p.id as string);

    const resolved: { id: string; pointValue: number }[] = [];
    for (const { key, pointValue } of rows) {
      const id = /^\d+$/.test(key) ? byDex.get(Number(key)) : byName.get(key.toLowerCase());
      if (id) resolved.push({ id, pointValue });
      else notFound.push(key);
    }

    if (seasonId) {
      for (let i = 0; i < resolved.length; i += 500) {
        const chunk = resolved.slice(i, i + 500).map((r) => ({ season_id: seasonId, pokemon_id: r.id, point_value: r.pointValue }));
        const { error } = await supabase.from("season_point_values").upsert(chunk, { onConflict: "season_id,pokemon_id" });
        if (error) throw new Error(error.message);
      }
    } else {
      for (const r of resolved) {
        const { error } = await supabase.from("pokemon").update({ point_value: r.pointValue }).eq("id", r.id);
        if (error) throw new Error(error.message);
      }
    }
    updated = resolved.length;
    refreshAll();
  });
  return { ...result, updated, notFound };
}

// ─── Team actions ─────────────────────────────────────────────────────────────

/**
 * Add/remove teams in a season, then rebuild its schedule.
 * Form fields: seasonId, toAdd (JSON array of names), toRemove (JSON array of team ids).
 */
export async function applyTeamChanges(formData: FormData): Promise<Result> {
  return run(async () => {
    const supabase = createSupabaseAdminClient();
    const seasonId = String(formData.get("seasonId") ?? "");
    if (!seasonId) throw new Error("No season selected.");
    const parseList = (key: string): string[] => {
      try {
        const v = JSON.parse(String(formData.get(key) ?? "[]"));
        return Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : [];
      } catch {
        return [];
      }
    };
    const toAdd = parseList("toAdd");
    const toRemove = parseList("toRemove");

    // Schedule rows reference teams, so clear the schedule before removing any
    const { error: schedError } = await supabase.from("schedule_matches").delete().eq("season_id", seasonId);
    if (schedError) throw new Error(schedError.message);

    if (toRemove.length > 0) {
      const { error } = await supabase.from("teams").delete().in("id", toRemove).eq("season_id", seasonId);
      if (error) throw new Error(error.message);
    }

    if (toAdd.length > 0) {
      const { data: existing } = await supabase.from("teams").select("draft_order").eq("season_id", seasonId);
      let next = (existing ?? []).reduce((max, t) => Math.max(max, (t.draft_order as number | null) ?? -1), -1) + 1;
      for (const name of toAdd) await createTeam(supabase, seasonId, { name, draftOrder: next++ });
    }

    await buildSchedule(supabase, seasonId);
    refreshAll();
  });
}

export async function regenerateSchedule(seasonId: string): Promise<Result> {
  return run(async () => {
    await buildSchedule(createSupabaseAdminClient(), seasonId);
    refreshAll();
  });
}
