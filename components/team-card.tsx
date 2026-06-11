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
        style={{ aspectRatio: "1 / 1" }}>

        {/* ── BLUE — team name strip across the top ── */}
        <div className="absolute top-0 left-0 right-0 z-10 px-3 py-2 bg-background/70 backdrop-blur-sm">
          <h2 className="team-name-color text-base font-black leading-tight line-clamp-1">
            {team.teamName}
          </h2>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold truncate">
            {team.coach?.name ?? "Unassigned"}
          </p>
        </div>

        {/* ── RED — team logo fills right 65% of card ── */}
        <div className="absolute top-0 right-0 bottom-0 z-0" style={{ left: "35%" }}>
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
          {/* Fade on left edge so it blends into left column */}
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
        </div>

        {/* ── YELLOW — coach photo, top-left square ── */}
        <div className="absolute z-10 overflow-hidden rounded-lg border-2"
          style={{
            top: "42px",
            left: "8px",
            width: "calc(35% - 16px)",
            aspectRatio: "1 / 1",
            borderColor: "var(--team-color, #888)",
          }}>
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
              <User size={20} />
            </div>
          )}
        </div>

        {/* ── GREEN — record, bottom-left square ── */}
        <div className="absolute z-10 bottom-2 left-2 rounded-lg bg-background/70 backdrop-blur-sm px-3 py-2">
          <p className="text-xl font-black tabular-nums leading-none">
            {team.wins}
            <span className="text-muted-foreground font-normal text-sm mx-1">–</span>
            {team.losses}
          </p>
        </div>

        {/* Top Pokémon — bottom right */}
        {topPokemon && (
          <div className="absolute z-10 bottom-2 right-2 flex flex-col items-center">
            <Image src={topPokemon.spriteUrl} alt={topPokemon.name} width={36} height={36} className="size-9 object-contain drop-shadow-md" />
            <p className="text-xs font-bold team-name-color">{topPokemon.pointValue}pts</p>
          </div>
        )}

      </Card>
    </Link>
  );
}
