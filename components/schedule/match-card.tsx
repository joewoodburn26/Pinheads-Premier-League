"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronUp, ClipboardEdit } from "lucide-react";
import { ReportPanel } from "@/components/schedule/report-panel";
import type { MatchKind } from "@/lib/match-report";
import type { ScheduleMatch } from "@/lib/types";

export type TeamVisual = {
  id: string;
  name: string;
  coach: string;
  logoUrl: string | null;
  aceSprite: string | null;
  color: string;
  color2: string;
};

function TeamSide({ team, align, result }: { team: TeamVisual; align: "left" | "right"; result: "win" | "loss" | "none" }) {
  const right = align === "right";
  return (
    <Link
      href={`/teams/${team.id}`}
      className={`group relative flex min-w-0 flex-col items-center gap-2 overflow-hidden px-2 py-3 text-center transition-opacity sm:flex-row sm:gap-3 sm:px-4 sm:py-4 ${right ? "sm:flex-row-reverse sm:text-right" : "sm:text-left"} ${result === "loss" ? "opacity-60 hover:opacity-90" : ""}`}
    >
      {team.logoUrl && (
        <Image src={team.logoUrl} alt="" fill sizes="400px" unoptimized className="object-cover opacity-20 transition-opacity group-hover:opacity-30" />
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(${right ? "270deg" : "90deg"}, ${team.color}55, ${team.color2}14 60%, transparent)` }}
      />
      <div className="relative grid size-14 shrink-0 place-items-center rounded-full border border-white/10 bg-black/30 sm:size-20" style={{ boxShadow: `0 0 0 3px ${team.color}55` }}>
        {team.aceSprite ? (
          <Image src={team.aceSprite} alt="" width={72} height={72} className="size-12 object-contain drop-shadow sm:size-[72px]" />
        ) : (
          <span className="text-xl font-black">{team.name.slice(0, 2)}</span>
        )}
      </div>
      <div className="relative min-w-0">
        <p className="line-clamp-2 text-sm font-black leading-tight sm:text-lg">{team.name}</p>
        <p className="truncate text-xs text-muted-foreground">{team.coach}</p>
        {result === "win" && (
          <span className="mt-1 inline-block rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400">Winner</span>
        )}
      </div>
    </Link>
  );
}

export function MatchCard({
  kind = "regular",
  match,
  home,
  away,
  canReport,
  highlight,
  label,
  defaultOpen = false,
}: {
  kind?: MatchKind;
  /** Small heading above the card, e.g. "Semifinal 1" */
  label?: string;
  defaultOpen?: boolean;
  match: ScheduleMatch;
  home: TeamVisual;
  away: TeamVisual;
  canReport: boolean;
  highlight?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const played = !!match.winner;
  const homeWon = match.winner === match.homeTeam;
  const score = /^(\d)\s*-\s*(\d)$/.exec(match.bo3Score ?? "");
  const [hi, lo] = score ? [Number(score[1]), Number(score[2])] : [null, null];
  const homeGames = hi === null ? (homeWon ? "W" : "L") : homeWon ? hi : lo;
  const awayGames = hi === null ? (homeWon ? "L" : "W") : homeWon ? lo : hi;
  const replays = [match.replay1, match.replay2, match.replay3];
  const diff = match.homeDiff ?? 0;

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-card transition-shadow ${open ? "xl:col-span-2" : ""} ${highlight ? "ring-2 ring-primary/60" : ""}`}
      style={{ borderColor: played ? `${(homeWon ? home : away).color}66` : undefined }}
    >
      {(highlight || label) && (
        <div className={`px-4 py-1 text-[11px] font-bold uppercase tracking-wider ${highlight ? "bg-primary/15 text-primary" : "bg-white/[0.03] text-muted-foreground"}`}>
          {[label, highlight ? "Your match" : ""].filter(Boolean).join(" · ")}
        </div>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
        <TeamSide team={home} align="left" result={played ? (homeWon ? "win" : "loss") : "none"} />

        <div className="flex min-w-[76px] flex-col items-center justify-center gap-1 border-x border-white/5 bg-black/20 px-2 py-3 sm:min-w-[96px] sm:px-3">
          {played ? (
            <>
              <p className="text-3xl font-black tabular-nums leading-none">
                <span className={homeWon ? "" : "text-muted-foreground"}>{homeGames}</span>
                <span className="mx-1 text-muted-foreground">–</span>
                <span className={!homeWon ? "" : "text-muted-foreground"}>{awayGames}</span>
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Final</p>
            </>
          ) : (
            <>
              <p className="text-lg font-black text-muted-foreground">VS</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Upcoming</p>
            </>
          )}
        </div>

        <TeamSide team={away} align="right" result={played ? (homeWon ? "loss" : "win") : "none"} />
      </div>

      {/* ── Footer: games, diff, report ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/5 px-4 py-2.5">
        {replays.map((r, i) =>
          r ? (
            <a
              key={i}
              href={r}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border px-2.5 py-0.5 text-xs font-semibold hover:bg-muted"
              title={`Watch game ${i + 1}`}
            >
              G{i + 1} ▶
            </a>
          ) : null,
        )}
        {played && (
          <span className="text-xs text-muted-foreground">
            Diff{" "}
            <span className={diff > 0 ? "font-bold text-green-400" : diff < 0 ? "font-bold text-red-400" : ""}>
              {home.name} {diff > 0 ? `+${diff}` : diff}
            </span>
          </span>
        )}
        <span className="ml-auto" />
        {canReport ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-semibold hover:bg-muted"
          >
            <ClipboardEdit size={13} /> {played ? "Edit result" : "Report result"}
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        ) : (
          !played && (
            <Link href="/login?next=/schedule" className="text-xs text-muted-foreground underline hover:text-foreground">
              Sign in to report
            </Link>
          )
        )}
      </div>

      {open && canReport && (
        <ReportPanel
          kind={kind}
          match={match}
          home={{ name: home.name, color: home.color }}
          away={{ name: away.name, color: away.color }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
