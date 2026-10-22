import { redirect } from "next/navigation";
import { SetupForm } from "@/components/auth-forms";
import { Card } from "@/components/ui/card";
import { authEnabled, hasOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up · Pinheads Premier League" };

export default async function SetupPage() {
  if (!authEnabled()) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center text-sm text-muted-foreground">
        Sign-ins need Supabase to be connected.
      </Card>
    );
  }
  if (await hasOwner()) redirect("/login");
  return <SetupForm />;
}
