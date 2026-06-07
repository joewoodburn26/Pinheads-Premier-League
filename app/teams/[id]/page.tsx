import Image from "next/image";
import { notFound } from "next/navigation";
import { User } from "lucide-react";
import { InlineEdit } from "@/components/inline-edit";
import { ImageUploadForm } from "@/components/image-upload-form";
import { PokemonCard } from "@/components/pokemon-card";
import { Card } from "@/components/ui/card";
import { getRoster, getTeam } from "@/lib/data";
import { updateCoachBio, updateCoachName, updateTeamName } from "@/lib/actions";
import { initials } from "@/lib/utils";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await getTeam(id);
  if (!team) notFound();
  const roster = await getRoster(team.id);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-lg border bg-card p-6 sm:grid-cols-[160px_1fr]">
        <div className="flex flex-row gap-4 sm:flex-col">
          <div className="grid size-32 place-items-center rounded-lg border bg-muted text-3xl font-black">
            {team.logoUrl ? <Image src={team.logoUrl} alt="" width={128} height={128} className="size-32 object-contain" /> : initials(team.teamName)}
          </div>
          <div className="grid size-24 place-items-center overflow-hidden rounded-full border bg-background text-muted-foreground">
            {team.coach?.imageUrl ? <Image src={team.coach.imageUrl} alt="" width={96} height={96} className="size-24 object-cover" /> : <User size={36} />}
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Team Name</p>
            <h1 className="text-4xl font-black">
              <InlineEdit value={team.teamName} name="teamName" action={updateTeamName.bind(null, team.id)} />
            </h1>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Coach</p>
            <div className="text-xl font-semibold">
              <InlineEdit value={team.coach?.name ?? ""} name="coachName" action={updateCoachName.bind(null, team.coachId, team.id)} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Bio</p>
            <InlineEdit value={team.coach?.bio ?? ""} name="bio" multiline action={updateCoachBio.bind(null, team.coachId, team.id)} />
          </div>
          <Card className="space-y-3 p-4 text-sm text-muted-foreground">
            <div>
              <p className="mb-2 font-semibold text-foreground">Team Logo</p>
              <ImageUploadForm targetId={team.id} kind="team-logo" />
            </div>
            <div>
              <p className="mb-2 font-semibold text-foreground">Coach Image</p>
              <ImageUploadForm targetId={team.coachId} kind="coach-image" />
            </div>
          </Card>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-black">Roster</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roster.map((slot) => slot.pokemon && <PokemonCard key={slot.id} pokemon={slot.pokemon} />)}
        </div>
      </section>
    </div>
  );
}
