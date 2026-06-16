"use client";

import { useState, useTransition } from "react";
import { Zap, X, CheckCircle, AlertCircle, Loader, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseAndSaveReplayStats, resetReplayStats } from "@/lib/replay-stats-actions";

interface ParseReplayButtonProps {
  replayUrl: string;
  replayLabel: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  isParsed: boolean; // passed from parent based on replay_imports
}

interface StatRow {
  name: string; player: string; gamesPlayed: number;
  kos: number; deaths: number; movesUsed: string[]; matched: boolean;
}

export function ParseReplayButton({
  replayUrl, replayLabel, seasonId, homeTeamId, awayTeamId, isParsed,
}: ParseReplayButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isResetting, startReset] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [parsed, setParsed] = useState(isParsed);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean; error?: string; alreadyParsed?: boolean;
    parsed?: { p1: string; p2: string; winner: string; gameCount: number; pokemonStats: StatRow[] };
  } | null>(null);

  function handleParse() {
    setShowModal(true);
    setResult(null);
    startTransition(async () => {
      const res = await parseAndSaveReplayStats(replayUrl, seasonId, homeTeamId, awayTeamId);
      setResult(res);
      if (res.ok) setParsed(true);
    });
  }

  function handleReset() {
    startReset(async () => {
      const res = await resetReplayStats(replayUrl, seasonId, homeTeamId, awayTeamId);
      if (res.ok) { setParsed(false); setResetConfirm(false); }
    });
  }

  return (
    <>
      <div className="flex items-center gap-1 mt-1">
        {/* Parse button */}
        <button
          onClick={handleParse}
          disabled={isPending || !replayUrl || parsed}
          title={parsed ? "Already parsed" : `Parse ${replayLabel} stats`}
          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors
            ${parsed
              ? "border-green-500/40 bg-green-500/10 text-green-400 cursor-default"
              : "bg-muted hover:bg-primary/10 hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
        >
          {parsed ? <CheckCircle size={11} /> : <Zap size={11} />}
          {parsed ? `${replayLabel} ✓` : replayLabel}
        </button>

        {/* Reset button — only show if parsed */}
        {parsed && (
          <>
            {resetConfirm ? (
              <div className="flex items-center gap-1">
                <button onClick={handleReset} disabled={isResetting}
                  className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors">
                  {isResetting ? "Resetting…" : "Confirm Reset"}
                </button>
                <button onClick={() => setResetConfirm(false)}
                  className="rounded-md border bg-muted px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted/80">
                  ✕
                </button>
              </div>
            ) : (
              <button onClick={() => setResetConfirm(true)}
                title={`Reset ${replayLabel} stats`}
                className="rounded-md border bg-muted px-1.5 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors">
                <RotateCcw size={11} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Results modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl mt-8 mb-8">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Zap size={18} className="text-yellow-400" />
                Replay Parser — {replayLabel}
              </h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1.5 hover:bg-muted">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {isPending && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader size={32} className="animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Fetching and parsing replay…</p>
                  <p className="text-xs text-muted-foreground">{replayUrl}</p>
                </div>
              )}

              {result && !result.ok && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-400">
                      {result.alreadyParsed ? "Already Parsed" : "Parse Failed"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{result.error}</p>
                  </div>
                </div>
              )}

              {result?.ok && result.parsed && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 flex items-center gap-3">
                    <CheckCircle size={18} className="text-green-400 shrink-0" />
                    <div className="text-sm">
                      <span className="font-bold text-green-400">Stats saved!</span>
                      <span className="text-muted-foreground ml-2">
                        {result.parsed.p1} vs {result.parsed.p2} · Winner: <strong>{result.parsed.winner}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="p-2 text-left">Pokémon</th>
                          <th className="p-2 text-left">Player</th>
                          <th className="p-2 text-center">Games</th>
                          <th className="p-2 text-center">KOs</th>
                          <th className="p-2 text-center">Deaths</th>
                          <th className="p-2 text-left">Moves</th>
                          <th className="p-2 text-center">Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.parsed.pokemonStats.map((mon, i) => (
                          <tr key={i} className={`border-t ${!mon.matched ? "opacity-50" : ""}`}>
                            <td className="p-2 font-semibold">{mon.name}</td>
                            <td className="p-2 text-muted-foreground text-xs">
                              {mon.player === "p1" ? result.parsed!.p1 : result.parsed!.p2}
                            </td>
                            <td className="p-2 text-center">{mon.gamesPlayed}</td>
                            <td className="p-2 text-center font-bold text-green-400">{mon.kos}</td>
                            <td className="p-2 text-center font-bold text-red-400">{mon.deaths}</td>
                            <td className="p-2 text-xs text-muted-foreground">{mon.movesUsed.join(", ") || "—"}</td>
                            <td className="p-2 text-center">
                              {mon.matched ? <span className="text-green-400">✓</span> : <span className="text-yellow-400">?</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ✓ matched to roster · ? not found (nickname or team mismatch)
                  </p>
                  <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
