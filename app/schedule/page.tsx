import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { updateMatch } from "@/lib/actions";
import { getActiveSeason, getSchedule, getTeams } from "@/lib/data";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const season = await getActiveSeason();
  const [matches, teams] = await Promise.all([getSchedule(season.id), getTeams(season.id)]);
  const weeks = [...new Set(matches.map((match) => match.week))].sort((a, b) => a - b);
  const requested = Number((await searchParams).week ?? weeks[0] ?? 1);
  const teamName = (id: string | null) => teams.find((team) => team.id === id)?.teamName ?? "TBD";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Schedule</h1>
        <div className="flex gap-2">
          {weeks.map((week) => (
            <Link key={week} href={`/schedule?week=${week}`} className={`rounded-md px-3 py-2 text-sm ${requested === week ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              Week {week}
            </Link>
          ))}
        </div>
      </div>
      <div className="grid gap-4">
        {matches.filter((match) => match.week === requested).map((match) => (
          <form key={match.id} action={updateMatch} className="grid gap-3 rounded-lg border bg-card p-4 lg:grid-cols-[1fr_180px_1fr_120px]">
            <input type="hidden" name="id" value={match.id} />
            <div className="font-semibold">{teamName(match.homeTeam)} vs {teamName(match.awayTeam)}</div>
            <Select name="winner" defaultValue={match.winner ?? ""}>
              <option value="">No winner</option>
              <option value={match.homeTeam}>{teamName(match.homeTeam)}</option>
              <option value={match.awayTeam}>{teamName(match.awayTeam)}</option>
            </Select>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input name="replay1" defaultValue={match.replay1 ?? ""} placeholder="Replay 1" />
              <Input name="replay2" defaultValue={match.replay2 ?? ""} placeholder="Replay 2" />
              <Input name="replay3" defaultValue={match.replay3 ?? ""} placeholder="Replay 3" />
            </div>
            <Button>Save</Button>
          </form>
        ))}
      </div>
    </div>
  );
}
