import Image from "next/image";
import Link from "next/link";
import { User } from "lucide-react";
import type { Team, Pokemon } from "@/lib/types";
import { initials } from "@/lib/utils";
import { Card } from "@/components/ui/card";

function teamAccentClass(teamName: string): string {
  const name = teamName.toLowerCase();
  if (name.includes("sylveon"))    return "team-fairy";
  if (name.includes("darkrai"))    return "team-dark";
  if (name.includes("aggron"))     return "team-steel";
  if (name.includes("toucannon") || name.includes("toucannons")) return "team-flying";
  if (name.includes("pyroar"))     return "team-fire";
  if (name.includes("wailord"))    return "team-water";
  if (name.includes("cinderace"))  return "team-fire";
  if (name.includes("jigglypuff")) return "team-normal";
  return "team-steel";
}

export function TeamCard({ team, topPokemon }: { team: Team; topPokemon?: Pokemon }) {
  const accentClass = teamAccentClass(team.teamName);

  return (
    <Link href={`/teams/${team.id}`} className="block">
      <Card className={`team-card-accent ${accentClass} relative aspect-square overflow-hidden p-0 transition-all duration-300 cursor-pointer flex flex-col`}>

        {/* Top Pokémon watermark */}
        {topPokemon && (
          <div className="absolute -right-2 -top-2 opacity-10 pointer-events-none z-0">
            <Image src={topPokemon.spriteUrl} alt="" width={120} height={120} className="size-28 object-contain" />
          </div>
        )}

        {/* Team name — full width at top */}
        <div className="relative z-10 px-3 pt-3 pb-1">
          <h2 className="team-name-color text-lg font-black leading-tight line-clamp-2">
            {team.teamName}
          </h2>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">
            {team.coach?.name ?? "Unassigned"}
          </p>
        </div>

        {/* Images row — logo + coach side by side, fill width */}
        <div className="relative z-10 flex flex-1 gap-2 px-3 pb-2 min-h-0">
          {/* Team logo — fills available space, no letterbox */}
          <div className="flex-1 relative overflow-hidden rounded-lg border min-h-0"
            style={{ borderColor: "var(--team-color, #666)", opacity: 0.9 }}>
            {team.logoUrl ? (
              <Image
                src={`${team.logoUrl}?v=${Date.now()}`}
                alt={team.teamName}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted text-2xl font-black">
                {initials(team.teamName)}
              </div>
            )}
          </div>

          {/* Coach photo — square, fills height */}
          <div className="relative overflow-hidden rounded-lg border aspect-square self-stretch"
            style={{ borderColor: "var(--team-color, #666)", opacity: 0.9 }}>
            {team.coach?.imageUrl ? (
              <Image
                src={`${team.coach.imageUrl}?v=${Date.now()}`}
                alt={team.coach?.name ?? ""}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
                <User size={24} />
              </div>
            )}
          </div>
        </div>

        {/* Bottom row — record + top Pokémon pts */}
        <div className="relative z-10 flex items-center justify-between px-3 pb-3">
          <p className="text-2xl font-black tabular-nums">
            {team.wins}
            <span className="text-muted-foreground font-normal text-base mx-1">–</span>
            {team.losses}
          </p>
          {topPokemon && (
            <div className="flex items-center gap-1.5">
              <Image src={topPokemon.spriteUrl} alt={topPokemon.name} width={36} height={36} className="size-8 object-contain drop-shadow-md" />
              <p className="text-xs font-bold team-name-color">{topPokemon.pointValue}pts</p>
            </div>
          )}
        </div>

      </Card>
    </Link>
  );
}
