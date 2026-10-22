"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { changePassword, setupOwner, signIn } from "@/lib/auth-actions";

// ── Shared shell ─────────────────────────────────────────────────────────────

export function AuthCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-center py-10">
      <Card className="w-full max-w-md space-y-6 p-7">
        <div className="space-y-2 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-blue-600/80 text-white shadow-lg">
            {icon}
          </div>
          <h1 className="text-2xl font-black">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <Input {...props} />
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function ErrorText({ error }: { error: string }) {
  return error ? (
    <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
  ) : null;
}

// ── Sign in ──────────────────────────────────────────────────────────────────

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <AuthCard icon={<LogIn size={22} />} title="Sign in" subtitle="Pinheads Premier League">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError("");
          startTransition(async () => {
            try {
              const result = await signIn(fd);
              if (result.error) return setError(result.error);
              router.replace(result.mustChange ? "/account/password" : next);
              router.refresh();
            } catch {
              setError("Couldn't sign in. Try again.");
            }
          });
        }}
      >
        <Field label="Email" name="email" type="email" autoComplete="email" required autoFocus />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <ErrorText error={error} />
        <Button className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
        <p className="text-center text-xs text-muted-foreground">
          Forgot your password? Ask the league owner to reset it.
        </p>
      </form>
    </AuthCard>
  );
}

// ── First-time owner setup ───────────────────────────────────────────────────

export function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <AuthCard
      icon={<ShieldCheck size={22} />}
      title="Create the owner account"
      subtitle="This only appears once. The owner can add everyone else from Settings → Members."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError("");
          startTransition(async () => {
            try {
              const result = await setupOwner(fd);
              if (result.error) return setError(result.error);
              router.replace("/settings/members");
              router.refresh();
            } catch {
              setError("Couldn't create the account. Try again.");
            }
          });
        }}
      >
        <Field label="Your name" name="name" required autoFocus hint="Your real name, not your coach or team name." />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters." />
        <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
        <ErrorText error={error} />
        <Button className="w-full" disabled={pending}>{pending ? "Creating…" : "Create owner account"}</Button>
      </form>
    </AuthCard>
  );
}

// ── Change password (forced on first sign-in) ────────────────────────────────

export function PasswordForm({ forced, name }: { forced: boolean; name: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <AuthCard
      icon={<KeyRound size={22} />}
      title={forced ? `Welcome, ${name.split(" ")[0]}!` : "Change password"}
      subtitle={
        forced
          ? "You signed in with the starting password. Choose your own to finish setting up your account."
          : "Pick a new password for your account."
      }
    >
      {done ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-green-400">✓ Password updated.</p>
          <Button className="w-full" onClick={() => { router.replace("/"); router.refresh(); }}>
            Go to the home page
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            setError("");
            startTransition(async () => {
              try {
                const result = await changePassword(fd);
                if (result.error) return setError(result.error);
                form.reset();
                setDone(true);
                router.refresh();
              } catch {
                setError("Couldn't update your password. Try again.");
              }
            });
          }}
        >
          <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus hint="At least 8 characters, and not the starting password." />
          <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
          <ErrorText error={error} />
          <Button className="w-full" disabled={pending}>{pending ? "Saving…" : "Save password"}</Button>
        </form>
      )}
    </AuthCard>
  );
}
