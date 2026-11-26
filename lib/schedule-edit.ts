// Schedule editing rules shared by the Schedule page (live warnings) and the
// save action (what to change in the database). No database code here.

/** A game as the editor sends it: id for an existing game, none for a new one. */
export type EditedGame = { id?: string; week: number; home: string; away: string };

/** A game as it is saved now. */
export type SavedGame = {
  id: string;
  week: number;
  home: string;
  away: string;
  played: boolean;
  replays: string[];
  homeDiff: number;
  awayDiff: number;
};

const MAX_WEEK = 52;
const samePair = (a: { home: string; away: string }, b: { home: string; away: string }) =>
  (a.home === b.home && a.away === b.away) || (a.home === b.away && a.away === b.home);

/** Errors that stop a save (the editor shows the same list). */
export function scheduleErrors(games: EditedGame[], teamIds: Set<string>): string[] {
  const errors: string[] = [];
  for (const g of games) {
    if (!Number.isInteger(g.week) || g.week < 1 || g.week > MAX_WEEK) errors.push(`A game has an invalid week (${g.week}).`);
    if (!g.home || !g.away) errors.push(`Week ${g.week}: pick both teams for every game.`);
    else if (g.home === g.away) errors.push(`Week ${g.week}: a team can't play itself.`);
    else if (!teamIds.has(g.home) || !teamIds.has(g.away)) errors.push(`Week ${g.week}: a game has a team that isn't in this season.`);
  }
  return [...new Set(errors)];
}

export type ScheduleWarning = { week?: number; text: string };

/** Things worth a second look that don't stop a save. */
export function scheduleWarnings(
  games: EditedGame[],
  teams: { id: string; name: string }[],
): ScheduleWarning[] {
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "A team";
  const out: ScheduleWarning[] = [];
  const weeks = [...new Set(games.map((g) => g.week))].sort((a, b) => a - b);
  const expectedOff = teams.length % 2;

  for (const w of weeks) {
    const wg = games.filter((g) => g.week === w && g.home && g.away && g.home !== g.away);
    const count = new Map<string, number>();
    for (const g of wg) for (const t of [g.home, g.away]) count.set(t, (count.get(t) ?? 0) + 1);
    for (const [t, n] of count) if (n > 1) out.push({ week: w, text: `${name(t)} plays ${n} times in week ${w}.` });
    const off = teams.filter((t) => !count.has(t.id));
    if (off.length > expectedOff) {
      out.push({ week: w, text: `Week ${w}: ${off.map((t) => t.name).join(", ")} ${off.length === 1 ? "has" : "have"} no game.` });
    }
  }

  // Same two teams more than once in the season
  const seen: EditedGame[] = [];
  const repeats = new Set<string>();
  for (const g of [...games].sort((a, b) => a.week - b.week)) {
    if (!g.home || !g.away || g.home === g.away) continue;
    const earlier = seen.find((s) => samePair(s, g));
    if (earlier) {
      const key = [g.home, g.away].sort().join("|");
      if (!repeats.has(key)) {
        repeats.add(key);
        out.push({ week: g.week, text: `${name(g.home)} and ${name(g.away)} play twice (weeks ${earlier.week} and ${g.week}).` });
      }
    }
    seen.push(g);
  }
  return out;
}

/** Does saving this edit remove the game's result? (The teams changed.) */
export function editClearsResult(before: { home: string; away: string; played: boolean }, after: { home: string; away: string }) {
  return before.played && !samePair(before, after);
}

/** Work out the inserts, updates and deletes needed to turn `saved` into `edited`. */
export function planScheduleSave(saved: SavedGame[], edited: EditedGame[], teamIds: Set<string>) {
  const empty = { insert: [] as EditedGame[], update: [] as Update[], remove: [] as SavedGame[] };
  const errors = scheduleErrors(edited, teamIds);
  if (errors.length) return { ...empty, error: errors[0] };

  const byId = new Map(saved.map((g) => [g.id, g]));
  const used = new Set<string>();
  const insert: EditedGame[] = [];
  const update: Update[] = [];

  for (const g of edited) {
    const before = g.id ? byId.get(g.id) : undefined;
    if (g.id && !before) return { ...empty, error: "The schedule changed since you opened it. Reload the page and try again." };
    if (!before) {
      insert.push(g);
      continue;
    }
    if (used.has(before.id)) return { ...empty, error: "The same game was sent twice. Reload the page and try again." };
    used.add(before.id);
    if (before.week === g.week && before.home === g.home && before.away === g.away) continue;
    update.push({
      id: before.id,
      week: g.week,
      home: g.home,
      away: g.away,
      before,
      clearResult: editClearsResult(before, g),
      sidesSwapped: before.home === g.away && before.away === g.home,
    });
  }
  const remove = saved.filter((g) => !used.has(g.id));
  return { insert, update, remove, error: undefined as string | undefined };
}

type Update = {
  id: string;
  week: number;
  home: string;
  away: string;
  before: SavedGame;
  clearResult: boolean;
  sidesSwapped: boolean;
};
