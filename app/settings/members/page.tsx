import { redirect } from "next/navigation";
import { MembersClient } from "@/components/members-client";
import { Card } from "@/components/ui/card";
import { DEFAULT_PASSWORD, getCurrentUser, isOwner, listMembers } from "@/lib/auth";
import { getActiveSeason, getTeams } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Members · Pinheads Premier League" };

export default async function MembersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings/members");
  if (!isOwner(user)) {
    return (
      <Card className="mx-auto mt-10 max-w-md p-8 text-center text-sm text-muted-foreground">
        Only the league owner can manage members.
      </Card>
    );
  }

  const season = await getActiveSeason();
  const [members, teams] = await Promise.all([listMembers(), getTeams(season?.id)]);

  const teamOptions = teams
    .filter((t) => t.coachId)
    .map((t) => ({ coachId: t.coachId, label: t.teamName, coachName: t.coach?.name ?? "" }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black">Members</h1>
        <p className="mt-1 text-muted-foreground">
          Add league members, choose what they can change, and link them to their team in {season?.name}.
        </p>
      </div>
      <MembersClient
        members={members}
        teamOptions={teamOptions}
        meId={user.id}
        defaultPassword={DEFAULT_PASSWORD}
      />
    </div>
  );
}
