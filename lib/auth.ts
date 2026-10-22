// Server-side helpers for who is signed in and what they may change.
// Import only from server components, route handlers and server actions.

import { cache } from "react";
import { createSupabaseServerClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type Role = "owner" | "admin" | "coach";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  coachId: string | null;
  mustChangePassword: boolean;
};

export type Member = CurrentUser & { createdAt: string };

/** Starting password for accounts the owner creates. Must be changed on first sign-in. */
export const DEFAULT_PASSWORD = "Asset101";

/** Sign-ins only exist when the site is connected to Supabase. */
export function authEnabled() {
  return hasSupabaseEnv();
}

// Local development with mock data (no Supabase): act as the owner so every page works.
const LOCAL_OWNER: CurrentUser = {
  id: "local-owner",
  email: "local@localhost",
  name: "Local Dev",
  role: "owner",
  coachId: null,
  mustChangePassword: false,
};

function mapProfile(row: Record<string, unknown>): Member {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as Role,
    coachId: (row.coach_id as string | null) ?? null,
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: row.created_at as string,
  };
}

/** The signed-in league member, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!authEnabled()) return LOCAL_OWNER;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: profile } = await createSupabaseAdminClient()
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();
  return profile ? mapProfile(profile) : null;
});

export function isAdmin(user: CurrentUser | null | undefined): boolean {
  return user?.role === "owner" || user?.role === "admin";
}

export function isOwner(user: CurrentUser | null | undefined): boolean {
  return user?.role === "owner";
}

async function requireUser(check: (u: CurrentUser) => boolean, message: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in first.");
  if (user.mustChangePassword) throw new Error("Choose a new password before making changes.");
  if (!check(user)) throw new Error(message);
  return user;
}

export function requireSignedIn() {
  return requireUser(() => true, "Please sign in first.");
}

export function requireAdmin() {
  return requireUser(isAdmin, "Only admins can do that.");
}

export function requireOwner() {
  return requireUser(isOwner, "Only the league owner can do that.");
}

/** For actions that report { ok } instead of throwing. */
export async function canAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user && !user.mustChangePassword && isAdmin(user);
}

export async function hasOwner(): Promise<boolean> {
  if (!authEnabled()) return true;
  const { count } = await createSupabaseAdminClient()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner");
  return (count ?? 0) > 0;
}

export async function listMembers(): Promise<Member[]> {
  if (!authEnabled()) return [{ ...LOCAL_OWNER, createdAt: new Date().toISOString() }];
  const { data } = await createSupabaseAdminClient()
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapProfile);
}

// ─── Team-level permissions ──────────────────────────────────────────────────

/** Signed in, past the starting password: can report results, fix stats, etc. */
export function canReport(user: CurrentUser | null | undefined): boolean {
  return !!user && !user.mustChangePassword;
}

/** Admins edit every team; coaches edit the team whose coach they're linked to. */
export function canEditTeam(user: CurrentUser | null | undefined, teamCoachId: string | null | undefined): boolean {
  if (!canReport(user)) return false;
  if (isAdmin(user)) return true;
  return !!user!.coachId && user!.coachId === teamCoachId;
}

/** Throws unless the signed-in member may edit this coach's profile (name, bio, photo). */
export async function requireCoachEditor(coachId: string): Promise<CurrentUser> {
  const user = await requireSignedIn();
  if (isAdmin(user) || (user.coachId && user.coachId === coachId)) return user;
  throw new Error("You can only change your own team.");
}

/** Throws unless the signed-in member may edit this team. */
export async function requireTeamEditor(teamId: string): Promise<CurrentUser> {
  const user = await requireSignedIn();
  if (isAdmin(user)) return user;
  if (!authEnabled()) return user;
  const { data } = await createSupabaseAdminClient().from("teams").select("coach_id").eq("id", teamId).maybeSingle();
  if (data && user.coachId && data.coach_id === user.coachId) return user;
  throw new Error("You can only change your own team.");
}

/** Throws unless the signed-in member may edit the team that owns these roster slots. */
export async function requireSlotEditor(slotIds: string[]): Promise<CurrentUser> {
  const user = await requireSignedIn();
  if (isAdmin(user) || !authEnabled() || slotIds.length === 0) return user;
  const { data } = await createSupabaseAdminClient().from("team_pokemon").select("team_id").in("id", slotIds);
  const teamIds = [...new Set((data ?? []).map((r) => r.team_id as string))];
  if (teamIds.length !== 1) throw new Error("You can only change your own team.");
  return requireTeamEditor(teamIds[0]);
}

/** For actions that return { ok, error } instead of throwing: null if allowed, else the reason. */
export async function denied(check: () => Promise<unknown>): Promise<string | null> {
  try {
    await check();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Not allowed.";
  }
}
