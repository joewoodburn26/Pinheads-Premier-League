"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, KeyRound, LogIn, LogOut, Menu, UserCircle, X } from "lucide-react";
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
  // Phones: links live in a menu that opens under the header
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMenuOpen(false), [pathname]);
  const settingsLinks = user?.role === "owner" ? [...settingsNav, ["Members", "/settings/members"]] : settingsNav;

  return (
    <header className="sticky top-0 z-30 border-b bg-background/86 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 max-md:py-2.5 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-black tracking-wide">
          Pinheads Draft
        </Link>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm md:hidden"
          aria-expanded={menuOpen}
          aria-label="Menu"
        >
          {menuOpen ? <X size={16} /> : <Menu size={16} />} Menu
        </button>
        <nav className="ml-auto flex flex-wrap items-center justify-end gap-2 text-sm max-md:hidden">
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
          {nav.flatMap(([label, href]) => [
            // Prep (signed-in members only) sits just left of Draft
            ...(href === "/draft" && user
              ? [
                  <Link key="/prep" href="/prep" className="rounded-md px-3 py-2 hover:bg-muted">
                    Prep
                  </Link>,
                ]
              : []),
            <Link key={href} href={href} className="rounded-md px-3 py-2 hover:bg-muted">
              {label}
            </Link>,
          ])}

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

      {/* ── Phone menu ─────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="max-h-[calc(100dvh-56px)] overflow-y-auto border-t bg-background px-4 pb-6 pt-2 md:hidden">
          <div className="grid grid-cols-2 gap-1">
            {nav.flatMap(([label, href]) => [
              ...(href === "/draft" && user ? [["Prep", "/prep"]] : []),
              [label, href],
            ]).map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-2.5 text-sm font-semibold ${pathname === href ? "bg-primary/15 text-primary" : "hover:bg-muted"}`}
              >
                {label}
              </Link>
            ))}
          </div>

          <p className="mt-4 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Teams</p>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {teams.map((team) => (
              <Link key={team.id} href={`/teams/${team.id}`} className="truncate rounded-md px-3 py-2 text-sm hover:bg-muted">
                {team.teamName}
              </Link>
            ))}
          </div>

          {canSeeSettings && (
            <>
              <p className="mt-4 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Settings</p>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {settingsLinks.map(([label, href]) => (
                  <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm hover:bg-muted">{label}</Link>
                ))}
              </div>
            </>
          )}

          <div className="mt-4 border-t pt-3">
            {user ? (
              <div className="space-y-1">
                <p className="px-3 text-sm font-semibold">{user.name} <span className="text-xs font-normal text-muted-foreground">· {ROLE_LABEL[user.role]}</span></p>
                <Link href="/account/password" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
                  <KeyRound size={14} /> Change password
                </Link>
                <form action={signOut}>
                  <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
                    <LogOut size={14} /> Sign out
                  </button>
                </form>
              </div>
            ) : (
              <Link href="/login" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
                <LogIn size={15} /> Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
