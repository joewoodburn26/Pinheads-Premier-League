"use client";

import { useState, useTransition } from "react";
import { Zap, X, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseAndSaveReplayStats } from "@/lib/replay-stats-actions";

interface ParseReplayButtonProps {
  replayUrl: string;
  replayLabel: string; // e.g. "Game 1"
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  matchId: string;
}

interface StatRow {
  name: string;
  player: string;
  gamesPlayed: number;
  kos: number;
  deaths: number;
  movesUsed: string[];
  matched: boolean;
}

export function ParseReplayButton({
  replayUrl, replayLabel, seasonId, homeTeamId, awayTeamId,
  homeTeamName, awayTeamName, matchId,
}: ParseReplayButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean; error?: string;
    parsed?: { p1: string; p2: string; winner: string; gameCount: number; pokemonStats: StatRow[] };
  } | null>(null);

  function handleParse() {
    setShowModal(true);
    setResult(null);
    startTransition(async () => {
      const res = await parseAndSaveReplayStats(replayUrl, seasonId, homeTeamId, awayTeamId, matchId);
      setResult(res);
    });
  }

  return (
    <>
      <button
        onClick={handleParse}
        disabled={isPending || !replayUrl}
        title={`Parse ${replayLabel} stats`}
        className="flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs font-medium hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Zap size={11} />
        {replayLabel}
      </button>

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
              {/* Loading */}
              {isPending && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader size={32} className="animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Fetching and parsing replay…</p>
                  <p className="text-xs text-muted-foreground">{replayUrl}</p>
                </div>
              )}

              {/* Error */}
              {result && !result.ok && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-400">Parse failed</p>
                    <p className="text-sm text-muted-foreground mt-1">{result.error}</p>
                  </div>
                </div>
              )}

              {/* Success */}
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

                  {/* Stats table */}
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="p-2 text-left">Pokémon</th>
                          <th className="p-2 text-left">Team</th>
                          <th className="p-2 text-center">Games</th>
                          <th className="p-2 text-center">KOs</th>
                          <th className="p-2 text-center">Deaths</th>
                          <th className="p-2 text-left">Moves Used</th>
                          <th className="p-2 text-center">Matched</th>
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
                              {mon.matched
                                ? <span className="text-green-400">✓</span>
                                : <span className="text-yellow-400" title="Not found in roster">?</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    ✓ = matched to your roster and saved · ? = found in replay but not on either roster (nickname or team sheet mismatch)
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
