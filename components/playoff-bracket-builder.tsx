"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Save, Trophy, Shield, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBracketStructure, getBracketSeeding } from "@/lib/schedule-utils";
import { saveBracketSlots, updatePlayoffMatch, type PlayoffMatch } from "@/lib/playoff-actions";
import { winPct } from "@/lib/utils";

interface StandingRow {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  seed: number;
}

// ─── Drag data type ────────────────────────────────────────────────────────────

const DRAG_TYPE = "application/x-team-id";

// ─── Mini standings table ──────────────────────────────────────────────────────

function MiniStandings({ standings }: { standings: StandingRow[] }) {
  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-bold text-sm">Standings (drag teams into bracket)</h3>
      <div className="space-y-1">
        {standings.map(row => (
          <div
            key={row.teamId}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData(DRAG_TYPE, row.teamId);
              e.dataTransfer.effectAllowed = "copy";
            }}
            className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-black text-muted-foreground w-6 shrink-0">#{row.seed}</span>
              <span className="font-semibold truncate">{row.teamName}</span>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {row.wins}-{row.losses} · {winPct(row.wins, row.losses)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground italic">
        Drag a team onto any bracket slot below. Teams stay listed here so you can drag them again.
      </p>
    </Card>
  );
}

// ─── Slot drop target ──────────────────────────────────────────────────────────

function SlotDropTarget({
  label, teamId, teamName, placeholder, onDrop, onClear,
}: {
  label: string;
  teamId: string | null;
  teamName: string;
  placeholder?: string;
  onDrop: (teamId: string) => void;
  onClear: () => void;
}) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={e => {
        e.preventDefault();
        setIsOver(false);
        const dropped = e.dataTransfer.getData(DRAG_TYPE);
        if (dropped) onDrop(dropped);
      }}
      className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
        isOver ? "border-primary bg-primary/10 ring-2 ring-primary/40" :
        teamId ? "border-border bg-muted/40" : "border-dashed border-muted-foreground/30 bg-muted/10"
      }`}
    >
      <span className="text-xs text-muted-foreground w-5 shrink-0">{label}</span>
      <span className={`flex-1 font-semibold truncate ${teamId ? "" : "text-muted-foreground italic text-xs"}`}>
        {teamId ? teamName : (placeholder ?? "Drop team here")}
      </span>
      {teamId && (
        <button onClick={onClear} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// ─── Match result form (shown when "Set Result" clicked) ────────────────────────

function MatchResultForm({
  match, team1Name, team2Name, seasonId, onClose,
}: {
  match: PlayoffMatch; team1Name: string; team2Name: string;
  seasonId: string; onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [winner,   setWinner]   = useState(match.winner ?? "");
  const [bo3Score, setBo3Score] = useState(match.bo3Score ?? "");
  const [diff1,    setDiff1]    = useState(String(match.team1Diff ?? 0));
  const [diff2,    setDiff2]    = useState(String(match.team2Diff ?? 0));
  const [r1, setR1] = useState(match.replay1 ?? "");
  const [r2, setR2] = useState(match.replay2 ?? "");
  const [r3, setR3] = useState(match.replay3 ?? "");
  const [saved, setSaved] = useState(false);

  function handleDiff1Change(val: string) {
    setDiff1(val);
    const n = parseInt(val);
    if (!isNaN(n)) setDiff2(String(-n));
  }
  function handleDiff2Change(val: string) {
    setDiff2(val);
    const n = parseInt(val);
    if (!isNaN(n)) setDiff1(String(-n));
  }

  function handleSave() {
    const fd = new FormData();
    fd.set("id", match.id);
    fd.set("seasonId", seasonId);
    fd.set("winner", winner);
    fd.set("bo3Score", bo3Score);
    fd.set("team1Diff", diff1);
    fd.set("team2Diff", diff2);
    fd.set("replay1", r1);
    fd.set("replay2", r2);
    fd.set("replay3", r3);
    startTransition(async () => {
      await updatePlayoffMatch(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Winner</label>
          <select value={winner} onChange={e => setWinner(e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
            <option value="">— Select —</option>
            <option value={match.team1Id ?? ""}>{team1Name}</option>
            <option value={match.team2Id ?? ""}>{team2Name}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bo3 Score</label>
          <select value={bo3Score} onChange={e => setBo3Score(e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
            <option value="">— Select —</option>
            <option value="2-0">2-0</option>
            <option value="2-1">2-1</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{team1Name} Diff</label>
          <Input type="number" value={diff1} onChange={e => handleDiff1Change(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{team2Name} Diff</label>
          <Input type="number" value={diff2} onChange={e => handleDiff2Change(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { label: "Game 1 Replay", value: r1, set: setR1 },
          { label: "Game 2 Replay", value: r2, set: setR2 },
          { label: "Game 3 Replay", value: r3, set: setR3 },
        ].map(({ label, value, set }) => (
          <div key={label} className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
            <div className="flex gap-1">
              <Input value={value} onChange={e => set(e.target.value)} placeholder="replay.pokemonshowdown.com/…" className="text-xs" />
              {value && (
                <a href={value} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 rounded-md border bg-muted px-2 flex items-center hover:bg-muted/80">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending}>
          <Save size={14} className="mr-2" />
          {isPending ? "Saving…" : "Save Result"}
        </Button>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
        {saved && <span className="text-xs text-green-400 font-semibold">✓ Saved</span>}
      </div>
    </div>
  );
}

// ─── Bracket slot card ───────────────────────────────────────────────────────

function BracketSlotCard({
  round, slotIndex, team1, team2, match, seasonId, placeholder1, placeholder2,
  onAssign, onClear,
}: {
  round: number; slotIndex: number;
  team1: { id: string | null; name: string };
  team2: { id: string | null; name: string };
  match: PlayoffMatch | undefined;
  seasonId: string;
  placeholder1?: string;
  placeholder2?: string;
  onAssign: (round: number, slotIndex: number, side: 1 | 2, teamId: string) => void;
  onClear: (round: number, slotIndex: number, side: 1 | 2) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const bothFilled = team1.id && team2.id;

  return (
    <Card className={`p-3 space-y-2 ${match?.winner ? "border-primary/30" : ""}`}>
      <SlotDropTarget label="1" teamId={team1.id} teamName={team1.name} placeholder={placeholder1}
        onDrop={tid => onAssign(round, slotIndex, 1, tid)}
        onClear={() => onClear(round, slotIndex, 1)} />
      <p className="text-center text-xs text-muted-foreground">vs</p>
      <SlotDropTarget label="2" teamId={team2.id} teamName={team2.name} placeholder={placeholder2}
        onDrop={tid => onAssign(round, slotIndex, 2, tid)}
        onClear={() => onClear(round, slotIndex, 2)} />

      {bothFilled && match && (
        <div className="pt-1">
          {match.winner ? (
            <button onClick={() => setShowForm(s => !s)}
              className="w-full text-center text-xs font-bold rounded-full bg-primary/10 border border-primary/30 px-2 py-1 text-primary hover:bg-primary/20 transition-colors">
              {match.winner === match.team1Id ? team1.name : team2.name} won {match.bo3Score} — click to edit
            </button>
          ) : (
            <button onClick={() => setShowForm(s => !s)}
              className="w-full text-center text-xs font-semibold rounded-md border border-dashed px-2 py-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">
              Set Result
            </button>
          )}
          {showForm && (
            <MatchResultForm match={match} team1Name={team1.name} team2Name={team2.name} seasonId={seasonId} onClose={() => setShowForm(false)} />
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Main bracket builder ──────────────────────────────────────────────────────

export function PlayoffBracketBuilder({
  standings, playoffMatches, seasonId, teamNameMap,
}: {
  standings: StandingRow[];
  playoffMatches: PlayoffMatch[];
  seasonId: string;
  teamNameMap: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const structure = getBracketStructure(standings.length);
  const seeding   = getBracketSeeding(standings.length);

  // Map seed number -> team name (from current standings)
  function seedTeamName(seed: number | null): string {
    if (seed === null) return "";
    const row = standings.find(s => s.seed === seed);
    return row ? row.teamName : `Seed #${seed}`;
  }

  // Placeholder text for Round 1 slots
  function round1Placeholder(slotIndex: number, side: 1 | 2): string | undefined {
    const info = seeding.round1Seeds.find(r => r.slotIndex === slotIndex);
    if (!info) return undefined;
    const seed = side === 1 ? info.seed1 : info.seed2;
    if (seed !== null) return `Seed #${seed} — ${seedTeamName(seed)}`;
    // This side comes from a play-in winner
    const dest = seeding.playInDestinations.find(d => d.round1SlotIndex === slotIndex && d.side === side);
    if (dest) return `Winner of Play-In ${dest.playInIndex + 1} (#${dest.seed1} vs #${dest.seed2})`;
    return undefined;
  }

  // Placeholder text for Play-In slots
  function playInPlaceholder(playInIndex: number, side: 1 | 2): string | undefined {
    const dest = seeding.playInDestinations.find(d => d.playInIndex === playInIndex);
    if (!dest) return undefined;
    const seed = side === 1 ? dest.seed1 : dest.seed2;
    return `Seed #${seed} — ${seedTeamName(seed)}`;
  }

  // For non-Round-1 rounds (Round 2+), no specific seed placeholder — just generic
  function laterRoundPlaceholder(): string | undefined {
    return "Winner advances here";
  }

  // Local editable state: round -> slotIndex -> { team1Id, team2Id }
  const initial: Record<string, { team1Id: string | null; team2Id: string | null }> = {};
  for (const round of structure) {
    for (let i = 0; i < round.slotCount; i++) {
      const key = `${round.round}-${i}`;
      const existing = playoffMatches.find(m => m.round === round.round && m.slotIndex === i);
      initial[key] = { team1Id: existing?.team1Id ?? null, team2Id: existing?.team2Id ?? null };
    }
  }
  const [slots, setSlots] = useState(initial);

  function getName(teamId: string | null): string {
    if (!teamId) return "";
    return teamNameMap[teamId] ?? teamId;
  }

  function handleAssign(round: number, slotIndex: number, side: 1 | 2, teamId: string) {
    const key = `${round}-${slotIndex}`;
    setSlots(prev => ({
      ...prev,
      [key]: { ...prev[key], [side === 1 ? "team1Id" : "team2Id"]: teamId },
    }));
  }

  function handleClear(round: number, slotIndex: number, side: 1 | 2) {
    const key = `${round}-${slotIndex}`;
    setSlots(prev => ({
      ...prev,
      [key]: { ...prev[key], [side === 1 ? "team1Id" : "team2Id"]: null },
    }));
  }

  function handleSave() {
    const toSave: { round: number; roundName: string; slotIndex: number; team1Id: string | null; team2Id: string | null }[] = [];
    for (const round of structure) {
      for (let i = 0; i < round.slotCount; i++) {
        const key = `${round.round}-${i}`;
        toSave.push({
          round: round.round,
          roundName: round.roundName,
          slotIndex: i,
          team1Id: slots[key]?.team1Id ?? null,
          team2Id: slots[key]?.team2Id ?? null,
        });
      }
    }
    startTransition(async () => {
      await saveBracketSlots(seasonId, toSave);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  // ── Split rounds into left half / right half / final for the converging bracket ──
  const nonPlayInRounds = structure.filter(r => r.round >= 1);
  const playInRound     = structure.find(r => r.round === 0);
  const finalRound      = nonPlayInRounds[nonPlayInRounds.length - 1]; // slotCount === 1

  function renderSlot(round: number, i: number) {
    const key = `${round}-${i}`;
    const slot = slots[key] ?? { team1Id: null, team2Id: null };
    const match = playoffMatches.find(m => m.round === round && m.slotIndex === i);

    let placeholder1: string | undefined;
    let placeholder2: string | undefined;
    if (round === 0) {
      placeholder1 = playInPlaceholder(i, 1);
      placeholder2 = playInPlaceholder(i, 2);
    } else if (round === 1) {
      placeholder1 = round1Placeholder(i, 1);
      placeholder2 = round1Placeholder(i, 2);
    } else {
      placeholder1 = laterRoundPlaceholder();
      placeholder2 = laterRoundPlaceholder();
    }

    return (
      <BracketSlotCard
        key={key}
        round={round}
        slotIndex={i}
        team1={{ id: slot.team1Id, name: getName(slot.team1Id) }}
        team2={{ id: slot.team2Id, name: getName(slot.team2Id) }}
        match={match}
        seasonId={seasonId}
        placeholder1={placeholder1}
        placeholder2={placeholder2}
        onAssign={handleAssign}
        onClear={handleClear}
      />
    );
  }

  // Split slot indices into left half and right half for mirroring
  function halves(round: { round: number; slotCount: number }) {
    const half = round.slotCount / 2;
    const left  = Array.from({ length: half }, (_, i) => i);
    const right = Array.from({ length: half }, (_, i) => i + half);
    return { left, right };
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black">Playoffs</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Drag teams from standings into bracket slots · Single elimination · Bo3 all rounds
        </p>
      </div>

      <MiniStandings standings={standings} />

      {/* Play-In round (if present) — shown above the main bracket */}
      {playInRound && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Shield size={18} className="text-orange-400" /> Play-In Round
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: playInRound.slotCount }).map((_, i) => (
              <div key={i} className="w-full max-w-xs">{renderSlot(0, i)}</div>
            ))}
          </div>
        </div>
      )}

      {/* Converging bracket */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Trophy size={18} className="text-yellow-400" /> Bracket
        </h3>

        <div className="overflow-x-auto pb-4">
          <div className="flex items-center justify-center gap-6 min-w-fit px-2">

            {/* LEFT SIDE */}
            <div className="flex items-center gap-6">
              {nonPlayInRounds.slice(0, -1).map(round => {
                const { left } = halves(round);
                return (
                  <div key={`left-${round.round}`} className="flex flex-col gap-6" style={{ minWidth: "220px" }}>
                    <p className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      {round.roundName}
                    </p>
                    <div className="flex flex-1 flex-col justify-around gap-6">
                      {left.map(i => <div key={i}>{renderSlot(round.round, i)}</div>)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CENTER — Finals */}
            {finalRound && (
              <div className="flex flex-col items-center gap-2" style={{ minWidth: "220px" }}>
                <p className="text-center text-xs font-bold uppercase tracking-wider text-yellow-400 mb-1">
                  🏆 {finalRound.roundName}
                </p>
                {renderSlot(finalRound.round, 0)}
              </div>
            )}

            {/* RIGHT SIDE — mirrored */}
            <div className="flex items-center gap-6">
              {[...nonPlayInRounds.slice(0, -1)].reverse().map(round => {
                const { right } = halves(round);
                return (
                  <div key={`right-${round.round}`} className="flex flex-col gap-6" style={{ minWidth: "220px" }}>
                    <p className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      {round.roundName}
                    </p>
                    <div className="flex flex-1 flex-col justify-around gap-6">
                      {right.map(i => <div key={i}>{renderSlot(round.round, i)}</div>)}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sticky bottom-4">
        <Button onClick={handleSave} disabled={isPending} className="text-base px-6 py-3">
          <Save size={16} className="mr-2" />
          {isPending ? "Saving Bracket…" : "Save Bracket"}
        </Button>
        {saved && <span className="text-sm text-green-400 font-semibold">✓ Bracket saved</span>}
      </div>
    </div>
  );
}
