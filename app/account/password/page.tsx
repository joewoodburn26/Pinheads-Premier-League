import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/auth-forms";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Password · Pinheads Premier League" };

export default async function PasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/password");
  return <PasswordForm forced={user.mustChangePassword} name={user.name} />;
}
