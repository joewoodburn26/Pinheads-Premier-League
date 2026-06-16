"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { Season, Team } from "@/lib/types";

const nav = [
  ["Schedule", "/schedule"],
  ["Rosters",  "/rosters"],
  ["Draft",    "/draft"],
  ["Type Chart",   "/type-chart"],
  ["Calculator",   "/damage-calculator"],
  ["Stats",        "/stats"],
  ["Rules",        "/rules"],
];

const settingsNav = [
  ["Point Restructure", "/settings/point-restructure"],
  ["Season & Team Management", "/settings/seasons"],
];

export function SiteHeader({
  teams,
}: {
  seasons?: Season[];
  activeSeason?: Season;
  teams: Team[];
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/86 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-black tracking-wide">
          Pinheads Draft
        </Link>
        <nav className="ml-auto flex flex-wrap items-center justify-end gap-2 text-sm">
          {/* Teams dropdown */}
          <div className="group relative">
            <button className="flex h-9 items-center gap-1 rounded-md px-3 hover:bg-muted">
              Teams <ChevronDown size={14} />
            </button>
            <div className="invisible absolute right-0 top-9 w-56 rounded-md border bg-card p-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
              {teams.map(team => (
                <Link key={team.id} href={`/teams/${team.id}`} className="block rounded px-3 py-2 hover:bg-muted">
                  {team.teamName}
                </Link>
              ))}
            </div>
          </div>

          {/* Settings dropdown */}
          <div className="group relative">
            <button className="flex h-9 items-center gap-1 rounded-md px-3 hover:bg-muted">
              Settings <ChevronDown size={14} />
            </button>
            <div className="invisible absolute right-0 top-9 w-56 rounded-md border bg-card p-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
              {settingsNav.map(([label, href]) => (
                <Link key={href} href={href} className="block rounded px-3 py-2 hover:bg-muted">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Regular nav */}
          {nav.map(([label, href]) => (
            <Link key={href} href={href} className="rounded-md px-3 py-2 hover:bg-muted">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
