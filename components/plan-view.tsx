"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Download, Lock, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TypeBadge } from "@/components/type-badge";
import {
  CoverageMap, RoleBalance, SpeedTiers, ThreatScore, exportToPdf, type BuilderSlot,
} from "@/components/draft-workspace";
import { pokemonTypesFor } from "@/lib/type-chart";

export function PlanView({
  planId,
  planName,
  teamId,
  teamName,
  slots,
  budget,
  seasonName,
  updatedLabel,
  createdByName,
  missing,
}: {
  planId: string;
  planName: string;
  teamId: string;
  teamName: string;
  slots: BuilderSlot[];
  budget: number;
  seasonName?: string;
  updatedLabel: string;
  createdByName: string | null;
  /** Picks that no longer exist in the Pokédex */
  missing: number;
}) {
  const used = slots.reduce((n, s) => n + s.pokemon.pointValue, 0);
  const over = used > budget;
  const avgBst = slots.length ? Math.round(slots.reduce((n, s) => n + s.pokemon.bst, 0) / slots.length) : 0;
  const pct = Math.min(100, Math.round((used / budget) * 100));

  return (
    <div className="space-y-6">
      <Link href={`/teams/${teamId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Back to {teamName}
      </Link>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[.2em] text-muted-foreground">
              <Lock size={12} /> Private draft plan · {teamName}
            </p>
            <h1 className="mt-1 text-3xl font-black sm:text-4xl">{planName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Updated {updatedLabel}
              {createdByName ? ` · created by ${createdByName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/draft?plan=${planId}`}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Wand2 size={15} /> Open in Draft Room
            </Link>
            <button
              onClick={() => exportToPdf(slots, budget, seasonName ? `${seasonName} · ${planName}` : planName)}
              className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              <Download size={15} /> Download PDF
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Budget (current point values)</span>
            <span className={`font-bold ${over ? "text-red-400" : ""}`}>{used} / {budget} pts</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${over ? "bg-red-500" : pct > 80 ? "bg-yellow-400" : "bg-green-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Pokémon", value: slots.length },
            { label: "Pts left", value: budget - used, warn: over },
            { label: "Avg BST", value: avgBst },
          ].map((s) => (
            <div key={s.label} className="rounded-md bg-muted p-3">
              <p className={`text-2xl font-black ${s.warn ? "text-red-400" : ""}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {missing > 0 && (
          <p className="text-xs text-yellow-400">
            {missing} Pokémon in this plan no longer exist in the Pokédex and were left out.
          </p>
        )}
      </Card>

      {/* ── Picks ────────────────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {slots.map(({ pokemon, note }) => (
          <Card key={pokemon.id} className="flex flex-col items-center gap-1.5 p-4 text-center">
            <Image src={pokemon.spriteUrl} alt={pokemon.name} width={96} height={96} className="size-20 object-contain" />
            <p className="font-bold leading-tight">{pokemon.name}</p>
            <div className="flex flex-wrap justify-center gap-1">
              {pokemonTypesFor(pokemon).map((t) => <TypeBadge key={t} type={t} />)}
            </div>
            <p className="text-lg font-black">{pokemon.pointValue} pts</p>
            {note && <p className="w-full rounded-md bg-muted/50 px-2 py-1 text-xs italic text-muted-foreground">“{note}”</p>}
          </Card>
        ))}
      </section>

      {/* ── Analysis ─────────────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          <h3 className="text-sm font-bold">Type Coverage</h3>
          <p className="text-xs text-muted-foreground">↑ = your hits · ↓ = your weaknesses</p>
          <CoverageMap slots={slots} />
        </Card>
        <div className="space-y-4">
          <Card className="space-y-2 p-4">
            <h3 className="text-sm font-bold">Role Balance</h3>
            <RoleBalance slots={slots} />
          </Card>
          <Card className="space-y-2 p-4">
            <h3 className="text-sm font-bold">Top Threats</h3>
            <p className="text-xs text-muted-foreground">Types that hit the most of your team</p>
            <ThreatScore slots={slots} />
          </Card>
          <Card className="space-y-2 p-4">
            <h3 className="text-sm font-bold">Speed Tiers</h3>
            <SpeedTiers slots={slots} />
          </Card>
        </div>
      </section>
    </div>
  );
}
