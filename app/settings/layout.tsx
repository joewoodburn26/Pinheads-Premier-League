import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Every /settings page is admin-only (owner included).
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings/seasons");
  if (user.mustChangePassword) redirect("/account/password");

  if (!isAdmin(user)) {
    return (
      <Card className="mx-auto mt-10 max-w-md space-y-3 p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Lock size={22} />
        </div>
        <h1 className="text-xl font-black">Admins only</h1>
        <p className="text-sm text-muted-foreground">
          Settings can only be changed by league admins. If you think you should have access, ask the league owner.
        </p>
        <Link href="/" className="inline-block text-sm underline hover:text-foreground">Back to the home page</Link>
      </Card>
    );
  }

  return <>{children}</>;
}
