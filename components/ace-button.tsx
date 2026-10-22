"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { setTeamAce } from "@/lib/actions";

export function AceButton({
  teamId,
  pokemonId,
  pokemonName,
  isChosenAce,
}: {
  teamId: string;
  pokemonId: string;
  pokemonName: string;
  /** true only when the coach explicitly picked this Pokémon */
  isChosenAce: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function toggle() {
    setError("");
    startTransition(async () => {
      try {
        await setTeamAce(teamId, isChosenAce ? null : pokemonId);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setError(!msg || msg.includes("Server Components render") ? "Couldn't save the ace. Try again." : msg);
      }
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        title={isChosenAce ? `Remove ${pokemonName} as ace` : `Make ${pokemonName} the team's ace`}
        aria-label={isChosenAce ? `Remove ${pokemonName} as ace` : `Make ${pokemonName} the team's ace`}
        className={`rounded-full p-1.5 transition-colors disabled:opacity-50 ${
          isChosenAce
            ? "text-yellow-400 hover:bg-yellow-400/10"
            : "text-muted-foreground/60 hover:bg-muted hover:text-yellow-300"
        }`}
      >
        <Star size={20} fill={isChosenAce ? "currentColor" : "none"} className={isPending ? "animate-pulse" : ""} />
      </button>
      {error && <p className="max-w-40 text-right text-[10px] leading-tight text-red-400">{error}</p>}
    </div>
  );
}
