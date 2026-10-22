import type { Metadata } from "next";
import { Exo_2 } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTeams, getSeasons, getActiveSeason } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

const exo2 = Exo_2({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pinheads Premier League",
  description: "Pokemon Draft League management for the Pinheads league.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [seasons, activeSeason, teams, user] = await Promise.all([
    getSeasons(),
    getActiveSeason(),
    getTeams(),
    getCurrentUser(),
  ]);

  // Members still on the starting password must choose their own first
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (user?.mustChangePassword && pathname !== "/account/password") {
    redirect("/account/password");
  }

  const headerUser = user ? { name: user.name, role: user.role } : null;

  return (
    <html lang="en" className={exo2.variable}>
      <body className="font-body min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <SiteHeader seasons={seasons} activeSeason={activeSeason} teams={teams} user={headerUser} />
          <main className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
