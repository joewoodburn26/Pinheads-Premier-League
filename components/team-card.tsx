import Image from "next/image";
import Link from "next/link";
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

type TeamCardProps = {
  team: Team;
  topPokemon?: Pokemon;
  /** Full drafted roster, shown as a sprite strip. Optional. */
  roster?: Pokemon[];
  /** Standings position (1-based). Optional. */
  rank?: number;
  /** Battle differential. Optional. */
  diff?: number;
};

export function TeamCard({ team, topPokemon, roster, rank, diff }: TeamCardProps) {
  const accentClass = teamAccentClass(team.teamName);
  const sortedRoster = roster
    ? [...roster].sort((a, b) => b.pointValue - a.pointValue)
    : [];
  const games = team.wins + team.losses;
  const pct = games > 0 ? Math.round((team.wins / games) * 100) : null;

  return (
    <Link href={`/teams/${team.id}`} className="block h-full">
      <Card
        className={`team-card-accent ${accentClass} relative flex h-full flex-col overflow-hidden p-0 transition-all duration-300 cursor-pointer`}
      >
        {/* ── Banner: landscape team photo ─────────────────────────────── */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          {team.logoUrl ? (
            <Image
              src={`${team.logoUrl}?v=${Date.now()}`}
              alt={team.teamName}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="grid h-full place-items-center text-4xl font-black text-muted-foreground">
              {initials(team.teamName)}
            </div>
          )}

          {/* fade into card body */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-card via-card/40 to-transparent" />

          {rank !== undefined && (
            <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-black text-white backdrop-blur-sm">
              #{rank}
            </span>
          )}

          {team.coach?.imageUrl && (
            <div className="absolute right-3 top-3 size-10 overflow-hidden rounded-full border-2 border-white/70 shadow-md">
              <Image
                src={`${team.coach.imageUrl}?v=${Date.now()}`}
                alt={team.coach.name}
                width={40}
                height={40}
                className="size-10 object-cover"
                unoptimized
              />
            </div>
          )}

          {/* Ace Pokémon sitting on the banner edge */}
          {topPokemon && (
            <div className="absolute -bottom-1 right-2 flex flex-col items-center">
              <Image
                src={topPokemon.spriteUrl}
                alt={topPokemon.name}
                width={80}
                height={80}
                className="size-20 object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]"
              />
            </div>
          )}
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-1">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {team.coach?.name ?? "Unassigned Coach"}
            </p>
            <h2 className="team-name-color text-xl font-black leading-tight break-words hyphens-auto">
              {team.teamName}
            </h2>
          </div>

          {/* Record row */}
          <div className="flex items-end justify-between gap-3">
            <p className="text-3xl font-black tabular-nums leading-none">
              {team.wins}
              <span className="mx-1 text-lg font-normal text-muted-foreground">–</span>
              {team.losses}
            </p>
            <div className="flex gap-3 text-right text-xs text-muted-foreground">
              {pct !== null && (
                <div>
                  <p className="text-sm font-bold text-foreground tabular-nums">{pct}%</p>
                  <p>Win</p>
                </div>
              )}
              {diff !== undefined && (
                <div>
                  <p className="text-sm font-bold text-foreground tabular-nums">
                    {diff > 0 ? `+${diff}` : diff}
                  </p>
                  <p>Diff</p>
                </div>
              )}
              {topPokemon && (
                <div>
                  <p className="team-name-color text-sm font-bold tabular-nums">{topPokemon.pointValue}</p>
                  <p>Ace pts</p>
                </div>
              )}
            </div>
          </div>

          {/* Roster strip */}
          {roster && (
            <div className="mt-auto border-t border-white/10 pt-3">
              {sortedRoster.length === 0 ? (
                <p className="text-xs text-muted-foreground">No Pokémon drafted yet</p>
              ) : (
                <div className="grid grid-cols-6 gap-1">
                  {sortedRoster.slice(0, 12).map((p) => (
                    <div key={p.id} className="grid place-items-center rounded-md bg-white/5" title={`${p.name} · ${p.pointValue}pts`}>
                      <Image src={p.spriteUrl} alt={p.name} width={40} height={40} className="size-9 object-contain" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
