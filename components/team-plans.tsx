"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Lock, Pencil, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { exportToPdf, type BuilderSlot } from "@/components/draft-workspace";
import { deletePlan, renamePlan } from "@/lib/plan-actions";

export type PlanSummary = {
  id: string;
  name: string;
  slots: BuilderSlot[];
  points: number;
  updatedLabel: string;
  createdByName: string | null;
};

export function TeamPlans({
  teamId,
  plans,
  budget,
  seasonName,
  accent,
}: {
  teamId: string;
  plans: PlanSummary[];
  budget: number;
  seasonName?: string;
  accent: string;
}) {
  return (
    <Card className="overflow-hidden" style={{ borderColor: `${accent}55` }}>
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 bg-white/[0.02] px-5 py-3.5">
        <Lock size={16} className="text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black leading-tight">Draft Plans</h2>
          <p className="text-xs text-muted-foreground">Private: only this team&apos;s coach, admins and the owner can see these.</p>
        </div>
        <Link
          href="/draft"
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Wand2 size={13} /> New plan in Draft Room
        </Link>
      </div>

      {plans.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          No plans yet. Build a team in the <Link href="/draft" className="underline">Draft Room</Link> and click{" "}
          <span className="font-semibold text-foreground">Save plan</span>.
        </p>
      ) : (
        <div className="divide-y divide-white/5">
          {plans.map((p) => (
            <PlanRow key={p.id} teamId={teamId} plan={p} budget={budget} seasonName={seasonName} />
          ))}
        </div>
      )}
    </Card>
  );
}

function PlanRow({
  teamId,
  plan,
  budget,
  seasonName,
}: {
  teamId: string;
  plan: PlanSummary;
  budget: number;
  seasonName?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(plan.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const over = plan.points > budget;

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setError("");
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.error) return setError(result.error);
        after?.();
        router.refresh();
      } catch {
        setError("Something went wrong. Try again.");
      }
    });
  }

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form
              className="flex max-w-md gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => renamePlan(plan.id, name), () => setRenaming(false));
              }}
            >
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus className="h-8" />
              <Button disabled={pending || !name.trim()} className="h-8 px-3 text-xs">Save</Button>
              <button type="button" onClick={() => { setRenaming(false); setName(plan.name); }} className="text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </form>
          ) : (
            <Link href={`/teams/${teamId}/plans/${plan.id}`} className="text-base font-bold hover:underline">
              {plan.name}
            </Link>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {plan.slots.length} Pokémon ·{" "}
            <span className={over ? "font-semibold text-red-400" : ""}>{plan.points} / {budget} pts</span> · Updated{" "}
            {plan.updatedLabel}
            {plan.createdByName ? ` · by ${plan.createdByName}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/teams/${teamId}/plans/${plan.id}`}
            className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            <ExternalLink size={13} /> Open
          </Link>
          <Link
            href={`/draft?plan=${plan.id}`}
            className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            <Wand2 size={13} /> Draft Room
          </Link>
          <button
            onClick={() => exportToPdf(plan.slots, budget, seasonName ? `${seasonName} · ${plan.name}` : plan.name)}
            className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            <Download size={13} /> PDF
          </button>
          <button
            onClick={() => setRenaming(true)}
            title="Rename"
            aria-label="Rename plan"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil size={14} />
          </button>
          {confirmDelete ? (
            <>
              <button
                onClick={() => run(() => deletePlan(plan.id))}
                disabled={pending}
                className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-red-500"
              >
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-1.5 text-xs text-muted-foreground hover:text-foreground">
                Keep
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete"
              aria-label="Delete plan"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {plan.slots.map(({ pokemon }) => (
          <div key={pokemon.id} title={`${pokemon.name} · ${pokemon.pointValue} pts`} className="grid size-11 place-items-center rounded-md bg-white/[0.04]">
            <Image src={pokemon.spriteUrl} alt={pokemon.name} width={40} height={40} className="size-9 object-contain" />
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-400">✗ {error}</p>}
    </div>
  );
}
