import { BookOpen } from "lucide-react";
import { RulesEditor, type BannedMon } from "@/components/rules-editor";
import { Card } from "@/components/ui/card";
import { getActiveSeason, getPokemon, getRulesDoc, getSchedule, getTeams } from "@/lib/data";
import { parseRules } from "@/lib/rules";
import type { Pokemon } from "@/lib/types";

export const revalidate = 0;

const FORMAT_LABELS: Record<string, string> = {
  all: "All Pokémon",
  gen9: "Gen 9 National Dex",
  champs: "Pokémon Champions",
};

function formatLabel(format?: string) {
  if (!format) return null;
  if (FORMAT_LABELS[format]) return FORMAT_LABELS[format];
  const gen = /^gen(\d+)$/.exec(format);
  return gen ? `Gen ${gen[1]} National Dex` : format;
}

function bannedCategory(p: Pokemon): BannedMon["category"] {
  if (p.mythical) return "Mythical";
  if (p.legendary) return "Legendary";
  if (p.paradox) return "Paradox";
  if (p.ultraBeast) return "Ultra Beast";
  return "Other";
}

export default async function RulesPage() {
  const season = await getActiveSeason();
  const [doc, teams, matches, allPokemon] = await Promise.all([
    getRulesDoc(),
    getTeams(season?.id),
    getSchedule(season?.id ?? ""),
    getPokemon(),
  ]);

  const sections = parseRules(doc.content);

  const weeks = matches.reduce((max, m) => Math.max(max, m.week), 0);
  const facts = [
    season?.draftBudget ? { label: "Draft Budget", value: `${season.draftBudget} pts` } : null,
    season?.rosterSize ? { label: "Roster Size", value: `${season.rosterSize} Pokémon` } : null,
    formatLabel(season?.format) ? { label: "Format", value: formatLabel(season?.format)! } : null,
    teams.length > 0 ? { label: "Teams", value: String(teams.length) } : null,
    weeks > 0 ? { label: "Regular Season", value: `${weeks} weeks` } : null,
  ].filter((f): f is { label: string; value: string } => f !== null);

  const banned: BannedMon[] = allPokemon
    .filter((p) => p.banned)
    .sort((a, b) => a.dexNumber - b.dexNumber)
    .map((p) => ({ id: p.id, name: p.name, spriteUrl: p.spriteUrl, category: bannedCategory(p) }));

  const updated = doc.updatedAt
    ? new Date(doc.updatedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="pokeball-bg relative overflow-hidden rounded-2xl border border-white/5 px-6 py-10 sm:px-10">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10" />
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-blue-600/80 p-3 shadow-lg">
            <BookOpen size={28} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.3em] text-blue-300/80">
              Pinheads Premier League
            </p>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">League Rules</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {season?.name}
              {updated ? ` · Last updated ${updated}` : ""}
            </p>
          </div>
        </div>
      </section>

      {/* ── Quick facts ───────────────────────────────────────────────────── */}
      {facts.length > 0 && (
        <section className="flex flex-wrap gap-3">
          {facts.map((f) => (
            <Card key={f.label} className="min-w-[140px] flex-1 border-blue-500/20 bg-blue-500/5 p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{f.label}</p>
              <p className="mt-1 text-xl font-black">{f.value}</p>
            </Card>
          ))}
        </section>
      )}

      {/* key forces a fresh client state whenever the saved rules change */}
      <RulesEditor key={doc.updatedAt ?? "initial"} sections={sections} banned={banned} />
    </div>
  );
}
