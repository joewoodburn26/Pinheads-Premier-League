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
      <Card className={`team-card-accent ${accentClass} relative overflow-hidden transition-all duration-300 cursor-pointer`}
        style={{ aspectRatio: "3 / 4" }}>

        {/* Background — team logo fills entire card */}
        <div className="absolute inset-0 z-0">
          {team.logoUrl ? (
            <Image
              src={`${team.logoUrl}?v=${Date.now()}`}
              alt={team.teamName}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted text-4xl font-black text-muted-foreground">
              {initials(team.teamName)}
            </div>
          )}
          {/* Dark overlay so text is readable */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/20 to-background/80" />
        </div>

        {/* Team name strip — top */}
        <div className="absolute top-0 left-0 right-0 z-10 px-3 pt-2 pb-1">
          <h2 className="team-name-color text-base font-black leading-tight line-clamp-1">
            {team.teamName}
          </h2>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold truncate">
            {team.coach?.name ?? "Unassigned"}
          </p>
        </div>

        {/* Middle row — team logo (yellow) left, Pokémon sprite (blue) right */}
        <div className="absolute z-10 flex items-start justify-between px-2 gap-2"
          style={{ top: "52px", left: 0, right: 0 }}>

          {/* YELLOW — team logo square */}
          <div className="relative overflow-hidden rounded-lg border-2 bg-background/60 flex-shrink-0"
            style={{
              width: "38%",
              aspectRatio: "1 / 1",
              borderColor: "var(--team-color, #888)",
            }}>
            {team.logoUrl ? (
              <Image
                src={`${team.logoUrl}?v=${Date.now()}`}
                alt={team.teamName}
                fill
                className="object-contain p-1"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xl font-black">
                {initials(team.teamName)}
              </div>
            )}
          </div>

          {/* BLUE — top Pokémon sprite square */}
          <div className="relative overflow-hidden rounded-lg border-2 bg-background/60 flex-shrink-0"
            style={{
              width: "38%",
              aspectRatio: "1 / 1",
              borderColor: "var(--team-color, #888)",
            }}>
            {topPokemon ? (
              <Image
                src={topPokemon.spriteUrl}
                alt={topPokemon.name}
                fill
                className="object-contain p-1"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <User size={20} />
              </div>
            )}
          </div>
        </div>

        {/* GREEN — standings bottom-left */}
        <div className="absolute z-10 bottom-2 left-2 rounded-lg bg-background/70 backdrop-blur-sm px-3 py-1.5">
          <p className="text-xl font-black tabular-nums leading-none">
            {team.wins}
            <span className="text-muted-foreground font-normal text-sm mx-1">–</span>
            {team.losses}
          </p>
        </div>

        {/* Top Pokémon points — bottom right */}
        {topPokemon && (
          <div className="absolute z-10 bottom-2 right-2">
            <p className="text-sm font-bold team-name-color">{topPokemon.pointValue}pts</p>
          </div>
        )}

      </Card>
    </Link>
  );
}
