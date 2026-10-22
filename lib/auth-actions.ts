"use server";

// Sign-in and member management.
// These return { error } instead of throwing so the forms can show the exact
// message (production builds hide thrown error messages).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_PASSWORD,
  authEnabled,
  getCurrentUser,
  hasOwner,
  requireOwner,
  type Role,
} from "@/lib/auth";

type Result = { error?: string };

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");
const nameSchema = z.string().trim().min(2, "Enter your real name.");
const passwordSchema = z
  .string()
  .min(8, "Passwords need at least 8 characters.")
  .refine((p) => p !== DEFAULT_PASSWORD, "Choose something other than the starting password.");

function firstIssue(err: unknown): string {
  if (err instanceof z.ZodError) return err.issues[0]?.message ?? "Check the form and try again.";
  return err instanceof Error ? err.message : "Something went wrong.";
}

function notConfigured(): Result {
  return { error: "Sign-ins need Supabase to be connected." };
}

// ─── Sign in / out ───────────────────────────────────────────────────────────

export async function signIn(formData: FormData): Promise<Result & { mustChange?: boolean }> {
  if (!authEnabled()) return notConfigured();
  let email: string;
  try {
    email = emailSchema.parse(formData.get("email"));
  } catch (err) {
    return { error: firstIssue(err) };
  }
  const password = String(formData.get("password") ?? "");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Wrong email or password." };

  const { data: profile } = await createSupabaseAdminClient()
    .from("profiles")
    .select("must_change_password")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "This account isn't part of the league yet. Ask the league owner to add you." };
  }

  revalidatePath("/", "layout");
  return { mustChange: Boolean(profile.must_change_password) };
}

export async function signOut() {
  if (authEnabled()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/");
}

// ─── Own password ────────────────────────────────────────────────────────────

export async function changePassword(formData: FormData): Promise<Result> {
  if (!authEnabled()) return notConfigured();
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in first." };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  try {
    passwordSchema.parse(password);
  } catch (err) {
    return { error: firstIssue(err) };
  }
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  const { error: profileError } = await createSupabaseAdminClient()
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);
  if (profileError) return { error: profileError.message };

  revalidatePath("/", "layout");
  return {};
}

// ─── First-time setup: create the owner account ──────────────────────────────

export async function setupOwner(formData: FormData): Promise<Result> {
  if (!authEnabled()) return notConfigured();
  if (await hasOwner()) return { error: "The league already has an owner. Sign in instead." };

  let name: string, email: string;
  const password = String(formData.get("password") ?? "");
  try {
    name = nameSchema.parse(formData.get("name"));
    email = emailSchema.parse(formData.get("email"));
    passwordSchema.parse(password);
  } catch (err) {
    return { error: firstIssue(err) };
  }
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords don't match." };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) return { error: error?.message ?? "Couldn't create the account." };

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    name,
    email,
    role: "owner",
    must_change_password: false,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: profileError.message };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signInWithPassword({ email, password });
  revalidatePath("/", "layout");
  return {};
}

// ─── Members (owner only) ────────────────────────────────────────────────────

const roleSchema = z.enum(["admin", "coach"]);

async function ownerGuard(): Promise<Result | null> {
  if (!authEnabled()) return notConfigured();
  try {
    await requireOwner();
    return null;
  } catch (err) {
    return { error: firstIssue(err) };
  }
}

export async function createMember(formData: FormData): Promise<Result> {
  const denied = await ownerGuard();
  if (denied) return denied;

  let name: string, email: string, role: "admin" | "coach";
  try {
    name = nameSchema.parse(formData.get("name"));
    email = emailSchema.parse(formData.get("email"));
    role = roleSchema.parse(formData.get("role"));
  } catch (err) {
    return { error: firstIssue(err) };
  }
  const coachId = String(formData.get("coachId") ?? "") || null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) {
    const msg = error?.message ?? "";
    return { error: /already|exists|registered/i.test(msg) ? "Someone already has an account with that email." : msg || "Couldn't create the account." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    name,
    email,
    role,
    coach_id: coachId,
    must_change_password: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/settings/members");
  return {};
}

export async function updateMember(
  memberId: string,
  changes: { name?: string; role?: Role; coachId?: string | null },
): Promise<Result> {
  const denied = await ownerGuard();
  if (denied) return denied;
  const me = await getCurrentUser();

  const admin = createSupabaseAdminClient();
  const { data: target } = await admin.from("profiles").select("role").eq("id", memberId).maybeSingle();
  if (!target) return { error: "That member no longer exists." };

  const update: Record<string, unknown> = {};
  try {
    if (changes.name !== undefined) update.name = nameSchema.parse(changes.name);
    if (changes.role !== undefined) {
      if (target.role === "owner" || memberId === me?.id) return { error: "The owner's role can't be changed." };
      update.role = roleSchema.parse(changes.role);
    }
    if (changes.coachId !== undefined) update.coach_id = changes.coachId || null;
  } catch (err) {
    return { error: firstIssue(err) };
  }

  const { error } = await admin.from("profiles").update(update).eq("id", memberId);
  if (error) return { error: error.message };

  revalidatePath("/settings/members");
  revalidatePath("/", "layout");
  return {};
}

export async function resetMemberPassword(memberId: string): Promise<Result> {
  const denied = await ownerGuard();
  if (denied) return denied;
  const me = await getCurrentUser();
  if (memberId === me?.id) return { error: "Change your own password from your account menu." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(memberId, { password: DEFAULT_PASSWORD });
  if (error) return { error: error.message };
  await admin.from("profiles").update({ must_change_password: true }).eq("id", memberId);

  revalidatePath("/settings/members");
  return {};
}

export async function removeMember(memberId: string): Promise<Result> {
  const denied = await ownerGuard();
  if (denied) return denied;
  const me = await getCurrentUser();
  if (memberId === me?.id) return { error: "You can't remove your own account." };

  const admin = createSupabaseAdminClient();
  const { data: target } = await admin.from("profiles").select("role").eq("id", memberId).maybeSingle();
  if (target?.role === "owner") return { error: "The owner account can't be removed." };

  const { error } = await admin.auth.admin.deleteUser(memberId);
  if (error) return { error: error.message };

  revalidatePath("/settings/members");
  return {};
}
