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
