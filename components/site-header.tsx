"use client";

import Link from "next/link";
import { ChevronDown, KeyRound, LogIn, LogOut, UserCircle } from "lucide-react";
import type { Season, Team } from "@/lib/types";
import { signOut } from "@/lib/auth-actions";

const nav = [
  ["Schedule",    "/schedule"],
  ["Rosters",     "/rosters"],
  ["Draft",       "/draft"],
  ["Randomizer",  "/randomizer"],
  ["Type Chart",  "/type-chart"],
  ["Calculator",  "/damage-calculator"],
  ["Stats",       "/stats"],
  ["Rules",       "/rules"],
];

const settingsNav = [
  ["Point Restructure",        "/settings/point-restructure"],
  ["Season & Team Management", "/settings/seasons"],
  ["Pokédex",                  "/settings/pokedex"],
];

type HeaderUser = { name: string; role: "owner" | "admin" | "coach" } | null;

const ROLE_LABEL = { owner: "Owner", admin: "Admin", coach: "Coach" } as const;

export function SiteHeader({
  teams,
  user,
}: {
  seasons?: Season[];
  activeSeason?: Season;
  teams: Team[];
  user?: HeaderUser;
}) {
  const canSeeSettings = user?.role === "owner" || user?.role === "admin";
  const settingsLinks = user?.role === "owner" ? [...settingsNav, ["Members", "/settings/members"]] : settingsNav;

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

          {/* Settings dropdown (admins + owner only) */}
          {canSeeSettings && (
          <div className="group relative">
            <button className="flex h-9 items-center gap-1 rounded-md px-3 hover:bg-muted">
              Settings <ChevronDown size={14} />
            </button>
            <div className="invisible absolute right-0 top-9 w-56 rounded-md border bg-card p-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
              {settingsLinks.map(([label, href]) => (
                <Link key={href} href={href} className="block rounded px-3 py-2 hover:bg-muted">
                  {label}
                </Link>
              ))}
            </div>
          </div>
          )}

          {/* Regular nav */}
          {nav.map(([label, href]) => (
            <Link key={href} href={href} className="rounded-md px-3 py-2 hover:bg-muted">
              {label}
            </Link>
          ))}

          {/* Account */}
          {user ? (
            <div className="group relative">
              <button className="flex h-9 items-center gap-1.5 rounded-md border px-3 hover:bg-muted">
                <UserCircle size={16} />
                <span className="max-w-[9rem] truncate">{user.name.split(" ")[0]}</span>
                <ChevronDown size={14} />
              </button>
              <div className="invisible absolute right-0 top-9 w-56 rounded-md border bg-card p-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</p>
                </div>
                <div className="my-1 h-px bg-border" />
                <Link href="/account/password" className="flex items-center gap-2 rounded px-3 py-2 hover:bg-muted">
                  <KeyRound size={14} /> Change password
                </Link>
                <form action={signOut}>
                  <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-muted">
                    <LogOut size={14} /> Sign out
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <Link href="/login" className="flex h-9 items-center gap-1.5 rounded-md border px-3 hover:bg-muted">
              <LogIn size={15} /> Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
