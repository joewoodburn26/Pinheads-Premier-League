import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { authEnabled, getCurrentUser, hasOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Pinheads Premier League" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (authEnabled()) {
    if (!(await hasOwner())) redirect("/setup");
    const user = await getCurrentUser();
    if (user) redirect(user.mustChangePassword ? "/account/password" : safeNext);
  }

  return <LoginForm next={safeNext} />;
}
