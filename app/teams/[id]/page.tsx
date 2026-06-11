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
import { getDominantTypeColor, hexToRgb } from "@/lib/team-theme";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await getTeam(id);
  if (!team) notFound();
  const roster = await getRoster(team.id);

  const pokemon = roster.map((s) => s.pokemon).filter(Boolean) as NonNullable<typeof roster[0]["pokemon"]>[];
  const { color, secondColor } = pokemon.length > 0
    ? getDominantTypeColor(pokemon)
    : { color: "#6390F0", secondColor: "#A98FF3" };

  const rgb1 = hexToRgb(color);
  const rgb2 = hexToRgb(secondColor);

  return (
    <>
      <div className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 10% 0%, rgba(${rgb1}, 0.1) 0%, transparent 55%),
            radial-gradient(ellipse 60% 40% at 90% 100%, rgba(${rgb2}, 0.07) 0%, transparent 50%),
            hsl(220, 20%, 10%)
          `,
        }}
      />

      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-xl border p-6"
          style={{
            background: `linear-gradient(135deg, rgba(${rgb1}, 0.1) 0%, rgba(${rgb2}, 0.05) 100%)`,
            borderColor: `rgba(${rgb1}, 0.25)`,
            boxShadow: `0 0 40px rgba(${rgb1}, 0.08)`,
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
            style={{ background: `linear-gradient(90deg, ${color}, ${secondColor})` }} />

          <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
            <div className="flex flex-row gap-4 sm:flex-col">
              <div className="grid size-32 place-items-center rounded-lg border text-3xl font-black"
                style={{ borderColor: `rgba(${rgb1}, 0.35)`, background: `rgba(${rgb1}, 0.06)` }}
              >
                {team.logoUrl
                  ? <Image src={`${team.logoUrl}?v=${Date.now()}`} alt="" width={128} height={128} className="size-32 object-contain rounded-lg" unoptimized />
                  : initials(team.teamName)
                }
              </div>
              <div className="grid size-24 place-items-center overflow-hidden rounded-full border bg-background text-muted-foreground"
                style={{ borderColor: `rgba(${rgb1}, 0.25)` }}
              >
                {team.coach?.imageUrl
                  ? <Image src={`${team.coach.imageUrl}?v=${Date.now()}`} alt="" width={96} height={96} className="size-24 object-cover" unoptimized />
                  : <User size={36} />
                }
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Team Name</p>
                <h1 className="text-4xl font-black" style={{ color }}>
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
              <Card className="space-y-3 p-4 text-sm text-muted-foreground" style={{ borderColor: `rgba(${rgb1}, 0.2)` }}>
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
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black" style={{ color }}>Roster</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roster.map((slot) =>
              slot.pokemon && <PokemonCard key={slot.id} pokemon={slot.pokemon} />
            )}
          </div>
        </section>
      </div>
    </>
  );
}
