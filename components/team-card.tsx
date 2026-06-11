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
      <Card className={`team-card-accent ${accentClass} relative overflow-hidden p-5 transition-all duration-300 cursor-pointer`}>
        {topPokemon && (
          <div className="absolute -right-2 -top-2 opacity-15 pointer-events-none">
            <Image src={topPokemon.spriteUrl} alt="" width={100} height={100} className="size-24 object-contain" />
          </div>
        )}

        <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-start">
          <div className="flex flex-col items-center gap-2">
            <div className="grid size-20 place-items-center rounded-lg border bg-muted text-xl font-black">
              {team.logoUrl
                ? <Image src={`${team.logoUrl}?v=${Date.now()}`} alt="" width={80} height={80} className="size-20 object-contain rounded-lg" unoptimized />
                : <span className="text-lg">{initials(team.teamName)}</span>
              }
            </div>
            <div className="grid size-12 place-items-center overflow-hidden rounded-full border bg-background text-muted-foreground">
              {team.coach?.imageUrl
                ? <Image src={`${team.coach.imageUrl}?v=${Date.now()}`} alt="" width={48} height={48} className="size-12 object-cover" unoptimized />
                : <User size={18} />
              }
            </div>
          </div>

          <div className="min-w-0 flex flex-col justify-center gap-1 pt-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {team.coach?.name ?? "Unassigned Coach"}
            </p>
            <h2 className="team-name-color text-xl font-black leading-tight truncate">{team.teamName}</h2>
            <p className="text-2xl font-black tabular-nums">
              {team.wins}
              <span className="text-muted-foreground font-normal text-base mx-1">–</span>
              {team.losses}
            </p>
          </div>

          {topPokemon && (
            <div className="flex flex-col items-center gap-1 pt-1">
              <Image src={topPokemon.spriteUrl} alt={topPokemon.name} width={56} height={56} className="size-14 object-contain drop-shadow-md" />
              <p className="text-xs font-bold team-name-color">{topPokemon.pointValue}pts</p>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
