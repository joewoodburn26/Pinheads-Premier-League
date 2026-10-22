import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Flame, Settings2, Shield, Swords, Trophy, User } from "lucide-react";
import { InlineEdit } from "@/components/inline-edit";
import { ImageUploadForm } from "@/components/image-upload-form";
import { PokemonCard } from "@/components/pokemon-card";
import { AceButton } from "@/components/ace-button";
import { TypeBadge } from "@/components/type-badge";
import { Card } from "@/components/ui/card";
import { getActiveSeason, getPokemon, getRoster, getSchedule, getStats, getTeam, getTeams } from "@/lib/data";
import { updateCoachBio, updateCoachName, updateTeamName } from "@/lib/actions";
import { initials } from "@/lib/utils";
import { pickAce } from "@/lib/ace";
import { canEditTeam, getCurrentUser } from "@/lib/auth";
import { TeamPlans, type PlanSummary } from "@/components/team-plans";
import { getTeamPlans, resolvePicks } from "@/lib/plans";
import { getDominantTypeColor, hexToRgb, TYPE_COLORS } from "@/lib/team-theme";
import { pokemonTypesFor } from "@/lib/type-chart";
import type { Pokemon, PokemonStats, PokemonType, Team } from "@/lib/types";

export const revalidate = 0;

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await getTeam(id);
  if (!team) notFound();

  const [roster, allTeams, matches, allStats, user] = await Promise.all([
    getRoster(team.id),
    getTeams(team.seasonId),
    getSchedule(team.seasonId),
    getStats(team.seasonId),
    getCurrentUser(),
  ]);
  // Coaches can edit their own team; admins and the owner can edit any team
  const canEdit = canEditTeam(user, team.coachId);

  // ── Private draft plans (own team, admins, owner) ───────────────────────────
  let planSummaries: PlanSummary[] = [];
  let planBudget = 105;
  let planSeasonName: string | undefined;
  if (canEdit) {
    const [plans, allPokemon, season] = await Promise.all([getTeamPlans(team.id), getPokemon(), getActiveSeason()]);
    planBudget = season?.draftBudget ?? 105;
    planSeasonName = season?.name;
    planSummaries = plans.map((plan) => {
      const slots = resolvePicks(plan.picks, allPokemon);
      return {
        id: plan.id,
        name: plan.name,
        slots,
        points: slots.reduce((n, s) => n + s.pokemon.pointValue, 0),
        updatedLabel: new Date(plan.updatedAt).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York",
        }),
        createdByName: plan.createdByName,
      };
    });
  }

  const pokemon = roster
    .map((s) => s.pokemon)
    .filter((p): p is Pokemon => Boolean(p))
    .sort((a, b) => b.pointValue - a.pointValue);

  const ace = pickAce(team, pokemon);
  const aceIsChosen = !!ace && ace.id === team.acePokemonId;

  const { color, secondColor } = pokemon.length > 0
    ? getDominantTypeColor(pokemon)
    : { color: "#6390F0", secondColor: "#A98FF3" };
  const rgb1 = hexToRgb(color);
  const rgb2 = hexToRgb(secondColor);

  // ── Battle differential + standings rank (same order as home page) ──────────
  const diffMap: Record<string, number> = {};
  for (const m of matches) {
    if (m.isBye) continue;
    if (m.homeTeam) diffMap[m.homeTeam] = (diffMap[m.homeTeam] ?? 0) + (m.homeDiff ?? 0);
    if (m.awayTeam) diffMap[m.awayTeam] = (diffMap[m.awayTeam] ?? 0) + (m.awayDiff ?? 0);
  }
  const standings = [...allTeams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const d = (diffMap[b.id] ?? 0) - (diffMap[a.id] ?? 0);
    if (d !== 0) return d;
    return a.teamName.localeCompare(b.teamName);
  });
  const rank = standings.findIndex((t) => t.id === team.id) + 1;
  const diff = diffMap[team.id] ?? 0;
  const games = team.wins + team.losses;
  const pct = games > 0 ? Math.round((team.wins / games) * 100) : null;

  // ── Match history ───────────────────────────────────────────────────────────
  const teamById = new Map<string, Team>(allTeams.map((t) => [t.id, t]));
  const myMatches = matches
    .filter((m) => m.homeTeam === team.id || m.awayTeam === team.id)
    .sort((a, b) => a.week - b.week);

  // Current streak from the most recent decided match backwards
  const decided = myMatches.filter((m) => !m.isBye && m.winner);
  let streak = "";
  if (decided.length > 0) {
    const lastWon = decided[decided.length - 1].winner === team.id;
    let n = 0;
    for (let i = decided.length - 1; i >= 0; i--) {
      if ((decided[i].winner === team.id) === lastWon) n++;
      else break;
    }
    streak = `${lastWon ? "W" : "L"}${n}`;
  }

  // ── Pokémon stats for this team ─────────────────────────────────────────────
  const teamStats = allStats.filter((s) => s.teamId === team.id);
  const statsByPokemon = new Map<string, PokemonStats>(teamStats.map((s) => [s.pokemonId, s]));
  const totalKos = teamStats.reduce((n, s) => n + s.kos, 0);
  const totalDeaths = teamStats.reduce((n, s) => n + s.deaths, 0);
  const mvps = [...teamStats]
    .filter((s) => s.pokemon && (s.kos > 0 || s.gamesPlayed > 0))
    .sort((a, b) => b.kos - a.kos || a.deaths - b.deaths)
    .slice(0, 3);

  // ── Type makeup ─────────────────────────────────────────────────────────────
  const typeCounts: Partial<Record<PokemonType, number>> = {};
  for (const p of pokemon) for (const t of pokemonTypesFor(p)) typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  const typeMakeup = (Object.entries(typeCounts) as [PokemonType, number][]).sort((a, b) => b[1] - a[1]);
  const typeTotal = typeMakeup.reduce((n, [, c]) => n + c, 0);
  const totalPoints = pokemon.reduce((n, p) => n + p.pointValue, 0);

  const statTiles = [
    { label: "Record", value: `${team.wins}–${team.losses}` },
    { label: "Standing", value: rank > 0 ? ordinal(rank) : "—", sub: `of ${allTeams.length}` },
    { label: "Win %", value: pct !== null ? `${pct}%` : "—" },
    { label: "Diff", value: diff > 0 ? `+${diff}` : String(diff) },
    { label: "Streak", value: streak || "—" },
    { label: "KOs / Deaths", value: `${totalKos} / ${totalDeaths}` },
  ];

  return (
    <>
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 10% 0%, rgba(${rgb1}, 0.12) 0%, transparent 55%),
            radial-gradient(ellipse 60% 40% at 90% 100%, rgba(${rgb2}, 0.08) 0%, transparent 50%),
            hsl(220, 20%, 10%)
          `,
        }}
      />

      <div className="space-y-8">
        {/* ── Hero banner ─────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden rounded-2xl border"
          style={{ borderColor: `rgba(${rgb1}, 0.3)`, boxShadow: `0 0 60px rgba(${rgb1}, 0.12)` }}
        >
          <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
            {team.logoUrl ? (
              <Image
                src={`${team.logoUrl}?v=${Date.now()}`}
                alt={team.teamName}
                fill
                priority
                sizes="100vw"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div
                className="grid h-full place-items-center text-7xl font-black text-white/30"
                style={{ background: `linear-gradient(135deg, rgba(${rgb1}, 0.5), rgba(${rgb2}, 0.3))` }}
              >
                {initials(team.teamName)}
              </div>
            )}

            {/* Darken toward the bottom so text reads on any image */}
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,20%,8%)] via-[hsl(220,20%,8%)]/50 to-transparent" />
            <div
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ background: `linear-gradient(90deg, ${color}, ${secondColor})` }}
            />

            {rank > 0 && (
              <span
                className="absolute left-4 top-5 flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-black text-white shadow-lg"
                style={{ background: `rgba(${rgb1}, 0.85)` }}
              >
                {rank === 1 && <Trophy size={14} />}#{rank}
              </span>
            )}

            {/* Name + coach overlay */}
            <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5 sm:p-8">
              <div
                className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-4 bg-background text-muted-foreground shadow-xl sm:size-24"
                style={{ borderColor: color }}
              >
                {team.coach?.imageUrl ? (
                  <Image
                    src={`${team.coach.imageUrl}?v=${Date.now()}`}
                    alt={team.coach.name}
                    width={96}
                    height={96}
                    className="size-full object-cover"
                    unoptimized
                  />
                ) : (
                  <User size={32} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[.25em] text-white/70 sm:text-sm">
                  Coach {team.coach?.name ?? "Unassigned"}
                </p>
                <h1
                  className="text-3xl font-black leading-none drop-shadow-lg sm:text-6xl"
                  style={{ color }}
                >
                  {team.teamName}
                </h1>
              </div>

              {/* Ace */}
              {ace && (
                <div className="hidden shrink-0 flex-col items-center sm:flex">
                  <Image
                    src={ace.spriteUrl}
                    alt={ace.name}
                    width={160}
                    height={160}
                    className="size-28 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.7)] lg:size-36"
                  />
                  <span className="-mt-2 rounded-full bg-yellow-400 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-black shadow">
                    ★ Ace · {ace.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {team.coach?.bio && (
            <p className="border-t border-white/5 px-5 py-4 text-sm italic text-muted-foreground sm:px-8">
              “{team.coach.bio}”
            </p>
          )}
        </section>

        {/* ── Stat strip ──────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {statTiles.map((s) => (
            <Card
              key={s.label}
              className="p-4 text-center"
              style={{ borderColor: `rgba(${rgb1}, 0.2)`, background: `rgba(${rgb1}, 0.04)` }}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p
                className={`mt-1 text-2xl font-black tabular-nums ${
                  s.label === "Streak" && streak.startsWith("W") ? "text-green-400"
                  : s.label === "Streak" && streak.startsWith("L") ? "text-red-400"
                  : ""
                }`}
              >
                {s.value}
              </p>
              {s.sub && <p className="text-xs text-muted-foreground">{s.sub}</p>}
            </Card>
          ))}
        </section>

        {/* ── Results + MVPs ──────────────────────────────────────────────── */}
        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Season results */}
          <Card className="p-5" style={{ borderColor: `rgba(${rgb1}, 0.2)` }}>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
              <Swords size={18} style={{ color }} /> Season Results
            </h2>
            {myMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches scheduled yet.</p>
            ) : (
              <div className="space-y-2">
                {myMatches.map((m) => {
                  if (m.isBye) {
                    return (
                      <div key={m.id} className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                        <span className="w-12 text-xs font-bold uppercase">Wk {m.week}</span>
                        <span>Bye week</span>
                      </div>
                    );
                  }
                  const oppId = m.homeTeam === team.id ? m.awayTeam : m.homeTeam;
                  const opp = teamById.get(oppId);
                  const result = !m.winner ? null : m.winner === team.id ? "W" : "L";
                  const replays = [m.replay1, m.replay2, m.replay3].filter((r): r is string => Boolean(r));
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                        result === "W" ? "border-green-500/30 bg-green-500/5"
                        : result === "L" ? "border-red-500/30 bg-red-500/5"
                        : ""
                      }`}
                    >
                      <span className="w-12 shrink-0 text-xs font-bold uppercase text-muted-foreground">Wk {m.week}</span>
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-md text-xs font-black ${
                          result === "W" ? "bg-green-500 text-white"
                          : result === "L" ? "bg-red-500 text-white"
                          : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {result ?? "–"}
                      </span>
                      <div className="relative size-8 shrink-0 overflow-hidden rounded-md bg-muted">
                        {opp?.logoUrl && (
                          <Image src={opp.logoUrl} alt="" fill sizes="32px" className="object-cover" unoptimized />
                        )}
                      </div>
                      <Link href={oppId ? `/teams/${oppId}` : "#"} className="min-w-0 flex-1 truncate font-semibold hover:underline">
                        vs {opp?.teamName ?? "TBD"}
                      </Link>
                      {m.bo3Score && <span className="shrink-0 font-mono text-xs text-muted-foreground">{m.bo3Score}</span>}
                      {replays.length > 0 && (
                        <div className="flex shrink-0 gap-1">
                          {replays.map((r, i) => (
                            <a
                              key={r}
                              href={r}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded border px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground hover:text-foreground"
                              title={`Replay game ${i + 1}`}
                            >
                              G{i + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="space-y-6">
            {/* MVPs */}
            <Card className="p-5" style={{ borderColor: `rgba(${rgb1}, 0.2)` }}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
                <Flame size={18} style={{ color }} /> Team MVPs
              </h2>
              {mvps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No battle stats yet.</p>
              ) : (
                <div className="space-y-3">
                  {mvps.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="w-6 text-lg font-black" style={{ color }}>#{i + 1}</span>
                      <Image src={s.pokemon!.spriteUrl} alt={s.pokemon!.name} width={48} height={48} className="size-12 object-contain" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{s.pokemon!.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.gamesPlayed} GP · {s.wins}W–{s.losses}L
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black tabular-nums">{s.kos}</p>
                        <p className="text-xs text-muted-foreground">KOs · {s.deaths} fainted</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Type makeup */}
            <Card className="p-5" style={{ borderColor: `rgba(${rgb1}, 0.2)` }}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
                <Shield size={18} style={{ color }} /> Type Makeup
              </h2>
              {typeMakeup.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Pokémon drafted yet.</p>
              ) : (
                <>
                  <div className="mb-3 flex h-3 overflow-hidden rounded-full">
                    {typeMakeup.map(([t, c]) => (
                      <div key={t} style={{ width: `${(c / typeTotal) * 100}%`, background: TYPE_COLORS[t] }} title={`${t}: ${c}`} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {typeMakeup.map(([t, c]) => (
                      <span key={t} className="flex items-center gap-1">
                        <TypeBadge type={t} />
                        <span className="text-xs font-bold text-muted-foreground">×{c}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>
        </section>

        {/* ── Roster ──────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-2xl font-black" style={{ color }}>Roster</h2>
            <p className="text-sm text-muted-foreground">
              {pokemon.length} Pokémon · {totalPoints} pts{canEdit ? " · tap ☆ to choose your ace" : ""}
            </p>
          </div>
          {pokemon.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Pokémon drafted yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pokemon.map((p) => (
                <PokemonCard
                  key={p.id}
                  pokemon={p}
                  stats={statsByPokemon.get(p.id)}
                  ace={ace?.id === p.id ? (aceIsChosen ? "chosen" : "auto") : undefined}
                  aceControl={
                    canEdit ? (
                      <AceButton
                        teamId={team.id}
                        pokemonId={p.id}
                        pokemonName={p.name}
                        isChosenAce={team.acePokemonId === p.id}
                      />
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Private: draft plans ───────────────────────────────────────── */}
        {canEdit && (
          <TeamPlans
            teamId={team.id}
            plans={planSummaries}
            budget={planBudget}
            seasonName={planSeasonName}
            accent={color}
          />
        )}

        {/* ── Manage team (own team, admins and owner only) ───────────────── */}
        {canEdit && (
        <details className="group rounded-xl border bg-card/50" style={{ borderColor: `rgba(${rgb1}, 0.2)` }}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-bold text-muted-foreground hover:text-foreground">
            <Settings2 size={16} /> Manage Team
            <span className="ml-auto text-xs font-normal group-open:hidden">Edit names, bio and images</span>
          </summary>
          <div className="grid gap-6 border-t px-5 py-5 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team Name</p>
                <div className="text-lg font-bold">
                  <InlineEdit value={team.teamName} name="teamName" action={updateTeamName.bind(null, team.id)} />
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coach</p>
                <div className="text-lg font-semibold">
                  <InlineEdit value={team.coach?.name ?? ""} name="coachName" action={updateCoachName.bind(null, team.coachId, team.id)} />
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bio</p>
                <InlineEdit value={team.coach?.bio ?? ""} name="bio" multiline action={updateCoachBio.bind(null, team.coachId, team.id)} />
              </div>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team Logo (banner)</p>
                <ImageUploadForm targetId={team.id} kind="team-logo" />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coach Image</p>
                <ImageUploadForm targetId={team.coachId} kind="coach-image" />
              </div>
            </div>
          </div>
        </details>
        )}
      </div>
    </>
  );
}
