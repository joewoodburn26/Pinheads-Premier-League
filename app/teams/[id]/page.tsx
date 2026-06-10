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

  // Get all Pokémon with data
  const pokemon = roster.map((s) => s.pokemon).filter(Boolean) as NonNullable<typeof roster[0]["pokemon"]>[];

  // Derive dominant colors from roster types
  const { color, secondColor } = pokemon.length > 0
    ? getDominantTypeColor(pokemon)
    : { color: "#6390F0", secondColor: "#A98FF3" }; // default blue/flying

  const rgb1 = hexToRgb(color);
  const rgb2 = hexToRgb(secondColor);

  return (
    <div
      className="min-h-screen space-y-8"
      style={{
        background: `
          radial-gradient(ellipse at top left, rgba(${rgb1}, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at bottom right, rgba(${rgb2}, 0.1) 0%, transparent 50%)
        `,
      }}
    >
      {/* ── Team Header ──────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-xl border p-6"
        style={{
          background: `linear-gradient(135deg, rgba(${rgb1}, 0.12) 0%, rgba(${rgb2}, 0.06) 100%)`,
          borderColor: `rgba(${rgb1}, 0.3)`,
          boxShadow: `0 0 40px rgba(${rgb1}, 0.1)`,
        }}
      >
        {/* Faint type color bar at top */}
        <div
          className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
          style={{ background: `linear-gradient(90deg, ${color}, ${secondColor})` }}
        />

        <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
          {/* Logo + coach photo */}
          <div className="flex flex-row gap-4 sm:flex-col">
            <div
              className="grid size-32 place-items-center rounded-lg border text-3xl font-black"
              style={{ borderColor: `rgba(${rgb1}, 0.4)`, background: `rgba(${rgb1}, 0.08)` }}
            >
              {team.logoUrl
                ? <Image src={team.logoUrl} alt="" width={128} height={128} className="size-32 object-contain rounded-lg" />
                : initials(team.teamName)
              }
            </div>
            <div className="grid size-24 place-items-center overflow-hidden rounded-full border bg-background text-muted-foreground"
              style={{ borderColor: `rgba(${rgb1}, 0.3)` }}
            >
              {team.coach?.imageUrl
                ? <Image src={team.coach.imageUrl} alt="" width={96} height={96} className="size-24 object-cover" />
                : <User size={36} />
              }
            </div>
          </div>

          {/* Team info */}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Team Name</p>
              <h1
                className="text-4xl font-black"
                style={{ color }}
              >
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

            {/* Upload forms */}
            <Card className="space-y-3 p-4 text-sm text-muted-foreground"
              style={{ borderColor: `rgba(${rgb1}, 0.2)` }}
            >
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

      {/* ── Roster ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2
          className="text-2xl font-black"
          style={{ color }}
        >
          Roster
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roster.map((slot) =>
            slot.pokemon && <PokemonCard key={slot.id} pokemon={slot.pokemon} />
          )}
        </div>
      </section>
    </div>
  );
}