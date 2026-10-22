"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, KeyRound, Shield, Trash2, User, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createMember, removeMember, resetMemberPassword, updateMember } from "@/lib/auth-actions";
import type { Member, Role } from "@/lib/auth";

type TeamOption = { coachId: string; label: string; coachName: string };

const ROLE_INFO: Record<Role, { label: string; icon: React.ReactNode; className: string; hint: string }> = {
  owner: { label: "Owner", icon: <Crown size={12} />, className: "bg-yellow-400 text-black", hint: "Everything, including members" },
  admin: { label: "Admin", icon: <Shield size={12} />, className: "bg-blue-600 text-white", hint: "Settings, rules and every team" },
  coach: { label: "Coach", icon: <User size={12} />, className: "bg-muted text-foreground", hint: "Their own team" },
};

function RoleBadge({ role }: { role: Role }) {
  const info = ROLE_INFO[role];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${info.className}`}>
      {info.icon} {info.label}
    </span>
  );
}

const selectClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";

export function MembersClient({
  members,
  teamOptions,
  meId,
  defaultPassword,
}: {
  members: Member[];
  teamOptions: TeamOption[];
  meId: string;
  defaultPassword: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState("");
  const [flash, setFlash] = useState("");
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: "reset" | "remove" } | null>(null);

  const teamFor = (coachId: string | null) => teamOptions.find((t) => t.coachId === coachId);

  function show(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 3500);
  }

  function run(id: string, fn: () => Promise<{ error?: string }>, success: string) {
    setRowError(null);
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.error) setRowError({ id, msg: result.error });
        else {
          setConfirm(null);
          show(success);
          router.refresh();
        }
      } catch {
        setRowError({ id, msg: "Something went wrong. Try again." });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Add member ─────────────────────────────────────────────────── */}
      <Card className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <UserPlus size={18} /> Add a member
        </h2>
        <form
          className="grid gap-3 md:grid-cols-[1.2fr_1.4fr_0.8fr_1.2fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            setFormError("");
            startTransition(async () => {
              try {
                const result = await createMember(fd);
                if (result.error) return setFormError(result.error);
                form.reset();
                show(`✓ ${fd.get("name")} added. Their starting password is ${defaultPassword}.`);
                router.refresh();
              } catch {
                setFormError("Couldn't add the member. Try again.");
              }
            });
          }}
        >
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
            <Input name="name" placeholder="e.g. Matt Smith" required />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</span>
            <Input name="email" type="email" placeholder="name@example.com" required />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rights</span>
            <select name="role" defaultValue="coach" className={selectClass}>
              <option value="coach">Coach</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team</span>
            <select name="coachId" defaultValue="" className={selectClass}>
              <option value="">No team</option>
              {teamOptions.map((t) => (
                <option key={t.coachId} value={t.coachId}>{t.label}</option>
              ))}
            </select>
          </label>
          <Button disabled={pending}>{pending ? "Adding…" : "Add"}</Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Use their <strong>real name</strong>, not their coach or team name. They sign in with this email and the
          starting password <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{defaultPassword}</code>,
          then have to choose their own password before they can do anything else.
        </p>
        {formError && <p className="text-sm text-red-400">✗ {formError}</p>}
      </Card>

      {flash && (
        <p className="rounded-md border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-400">{flash}</p>
      )}

      {/* ── Member list ────────────────────────────────────────────────── */}
      <Card className="divide-y divide-white/5 overflow-hidden">
        <div className="hidden grid-cols-[1.6fr_0.9fr_1.3fr_auto] gap-4 bg-white/[0.02] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
          <span>Member</span>
          <span>Rights</span>
          <span>Team</span>
          <span className="w-[180px] text-right">Account</span>
        </div>

        {members.map((m) => {
          const isMe = m.id === meId;
          const isOwnerRow = m.role === "owner";
          const team = teamFor(m.coachId);
          const confirming = confirm?.id === m.id ? confirm.kind : null;

          return (
            <div key={m.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.6fr_0.9fr_1.3fr_auto] md:items-center md:gap-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {m.name}
                  {isMe && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                  {m.mustChangePassword && (
                    <span className="rounded-full border border-yellow-500/40 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">
                      Hasn&apos;t set a password yet
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>

              <div>
                {isOwnerRow ? (
                  <RoleBadge role="owner" />
                ) : (
                  <select
                    value={m.role}
                    disabled={pending}
                    onChange={(e) => run(m.id, () => updateMember(m.id, { role: e.target.value as Role }), `✓ ${m.name}'s rights updated.`)}
                    className={selectClass}
                    title={ROLE_INFO[m.role].hint}
                  >
                    <option value="coach">Coach</option>
                    <option value="admin">Admin</option>
                  </select>
                )}
              </div>

              <div>
                <select
                  value={m.coachId ?? ""}
                  disabled={pending}
                  onChange={(e) => run(m.id, () => updateMember(m.id, { coachId: e.target.value || null }), `✓ ${m.name}'s team updated.`)}
                  className={selectClass}
                >
                  <option value="">No team</option>
                  {teamOptions.map((t) => (
                    <option key={t.coachId} value={t.coachId}>{t.label}</option>
                  ))}
                  {m.coachId && !team && <option value={m.coachId}>(team not in this season)</option>}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 md:w-[180px]">
                {isMe || isOwnerRow ? (
                  <span className="text-xs text-muted-foreground">{isMe ? "Use your account menu" : ""}</span>
                ) : confirming ? (
                  <>
                    <button
                      onClick={() =>
                        confirming === "reset"
                          ? run(m.id, () => resetMemberPassword(m.id), `✓ ${m.name}'s password is back to ${defaultPassword}.`)
                          : run(m.id, () => removeMember(m.id), `✓ ${m.name} removed.`)
                      }
                      disabled={pending}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-bold text-white ${confirming === "remove" ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"}`}
                    >
                      {confirming === "remove" ? "Remove" : `Reset to ${defaultPassword}`}
                    </button>
                    <button onClick={() => setConfirm(null)} className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setConfirm({ id: m.id, kind: "reset" })}
                      title="Reset password"
                      className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <KeyRound size={13} /> Reset password
                    </button>
                    <button
                      onClick={() => setConfirm({ id: m.id, kind: "remove" })}
                      title="Remove member"
                      aria-label={`Remove ${m.name}`}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>

              {rowError?.id === m.id && <p className="text-xs text-red-400 md:col-span-4">✗ {rowError.msg}</p>}
            </div>
          );
        })}
      </Card>

      <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
        {(["owner", "admin", "coach"] as Role[]).map((r) => (
          <div key={r} className="flex items-center gap-2">
            <RoleBadge role={r} /> {ROLE_INFO[r].hint}
          </div>
        ))}
      </div>
    </div>
  );
}
