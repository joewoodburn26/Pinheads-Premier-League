import Image from "next/image";
import { Trophy, Zap } from "lucide-react";
import { TeamCard } from "@/components/team-card";
import { Card } from "@/components/ui/card";
import { getActiveSeason, getTeams, getRoster, getStats, getSchedule } from "@/lib/data";
import { winPct } from "@/lib/utils";
import type { Pokemon } from "@/lib/types";

export const revalidate = 0;

export default async function HomePage() {
  const season = await getActiveSeason();
  const [teams, allStats, matches] = await Promise.all([
    getTeams(season?.id),
    getStats(season?.id),
    getSchedule(season?.id ?? ""),
  ]);

  // Get top Pokémon per team (highest point value)
  const rostersRaw = await Promise.all(teams.map((t) => getRoster(t.id)));
  const topPokemonMap: Record<string, Pokemon> = {};
  teams.forEach((team, i) => {
    const slots = rostersRaw[i];
    const top = slots
      .filter((s) => s.pokemon)
      .sort((a, b) => (b.pokemon?.pointValue ?? 0) - (a.pokemon?.pointValue ?? 0))[0];
    if (top?.pokemon) topPokemonMap[team.id] = top.pokemon;
  });

  // Calculate battle differential from schedule matches
  const battleDiffMap: Record<string, number> = {};
  for (const match of matches) {
    if (match.isBye) continue;
    if (match.homeTeam) {
      battleDiffMap[match.homeTeam] = (battleDiffMap[match.homeTeam] ?? 0) + (match.homeDiff ?? 0);
    }
    if (match.awayTeam) {
      battleDiffMap[match.awayTeam] = (battleDiffMap[match.awayTeam] ?? 0) + (match.awayDiff ?? 0);
    }
  }

  // Sort standings: wins → battle diff → alphabetical
  const sorted = [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const diffA = battleDiffMap[a.id] ?? 0;
    const diffB = battleDiffMap[b.id] ?? 0;
    if (diffB !== diffA) return diffB - diffA;
    return a.teamName.localeCompare(b.teamName);
  });

  const leader = sorted[0];

  // Top 3 Pokémon by KOs
  const topKos = [...allStats]
    .filter((s) => s.pokemon && s.kos > 0)
    .sort((a, b) => b.kos - a.kos)
    .slice(0, 3);

  return (
    <div className="space-y-12">

      {/* ── Hero Banner ───────────────────────────────────────────────────── */}
      <section className="pokeball-bg theme-glow-bg relative rounded-2xl border border-white/5 px-8 py-14 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#DC2626]/10 via-transparent to-[#D97706]/10 rounded-2xl pointer-events-none" />

        <p className="theme-accent-2 text-sm font-bold uppercase tracking-[.3em] mb-3">
          Pokémon Draft League
        </p>
        <h1 className="text-6xl font-black tracking-tight sm:text-8xl mb-4">
          <span className="theme-accent">Pinheads</span>{" "}
          <span className="text-foreground">Premier</span>{" "}
          <span className="theme-accent-2">League</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          {season?.name} · {teams.length} teams competing for the championship
        </p>

        {/* Top 3 standings strip */}
        <div className="mt-8 flex flex-wrap justify-center gap-6">
          {sorted.slice(0, 3).map((team, idx) => (
            <div key={team.id} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
              <span className="theme-accent-2 font-black">#{idx + 1}</span>
              <span className="font-semibold">{team.teamName}</span>
              <span className="text-muted-foreground">{team.wins}–{team.losses}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats Highlights ──────────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2">

        {/* Standings Leader */}
        {leader && (
          <Card className="p-5 flex items-center gap-5 border-[var(--theme-primary)]/30 bg-[var(--theme-primary)]/5">
            <div className="theme-accent-bg rounded-xl p-3">
              <Trophy size={28} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Standings Leader
              </p>
              <p className="text-xl font-black truncate theme-accent">{leader.teamName}</p>
              <p className="text-sm text-muted-foreground">
                {leader.wins}–{leader.losses} · {winPct(leader.wins, leader.losses)} win %
                {leader.coach?.name ? ` · ${leader.coach.name}` : ""}
              </p>
            </div>
            {topPokemonMap[leader.id] && (
              <Image
                src={topPokemonMap[leader.id].spriteUrl}
                alt=""
                width={120}
                height={120}
                className="size-28 object-contain ml-auto shrink-0"
              />
            )}
          </Card>
        )}

        {/* Top 3 KOs */}
        <Card className="p-5 border-[var(--theme-secondary)]/30 bg-[var(--theme-secondary)]/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl p-3" style={{ backgroundColor: "var(--theme-secondary)" }}>
              <Zap size={28} className="text-white" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Top Pokémon by KOs
            </p>
          </div>
          {topKos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No KO data yet.</p>
          ) : (
            <div className="space-y-3">
              {topKos.map((stat, idx) => (
                <div key={stat.id} className="flex items-center gap-3">
                  <span className="theme-accent-2 font-black text-lg w-6">#{idx + 1}</span>
                  {stat.pokemon && (
                    <Image
                      src={stat.pokemon.spriteUrl}
                      alt={stat.pokemon.name}
                      width={40}
                      height={40}
                      className="size-9 object-contain"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{stat.pokemon?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {teams.find((t) => t.id === stat.teamId)?.teamName ?? ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-black theme-accent">{stat.kos}</p>
                    <p className="text-xs text-muted-foreground">KOs</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* ── Team Cards ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-2xl font-black theme-accent">Teams</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              topPokemon={topPokemonMap[team.id]}
            />
          ))}
        </div>
      </section>

    </div>
  );
}
