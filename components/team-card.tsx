import Image from "next/image";
import Link from "next/link";
import { User } from "lucide-react";
import type { Team } from "@/lib/types";
import { initials } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function TeamCard({ team }: { team: Team }) {
  return (
    <Link href={`/teams/${team.id}`} className="block">
      <Card className="grid min-h-48 grid-cols-[88px_1fr] gap-4 p-5 transition hover:-translate-y-1 hover:border-primary/70">
        <div className="flex flex-col items-center gap-3">
          <div className="grid size-20 place-items-center rounded-md border bg-muted text-xl font-black">
            {team.logoUrl ? <Image src={team.logoUrl} alt="" width={80} height={80} className="size-20 object-contain" /> : initials(team.teamName)}
          </div>
          <div className="grid size-14 place-items-center overflow-hidden rounded-full border bg-background text-muted-foreground">
            {team.coach?.imageUrl ? <Image src={team.coach.imageUrl} alt="" width={56} height={56} className="size-14 object-cover" /> : <User size={24} />}
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          <p className="text-sm text-muted-foreground">{team.coach?.name ?? "Unassigned Coach"}</p>
          <h2 className="truncate text-2xl font-black">{team.teamName}</h2>
          <p className="mt-4 text-sm font-semibold text-accent">
            {team.wins}-{team.losses}
          </p>
        </div>
      </Card>
    </Link>
  );
}
