import type { Metadata } from "next";
import { Bebas_Neue, Exo_2 } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { getTeams, getSeasons, getActiveSeason } from "@/lib/data";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const exo2 = Exo_2({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pinheads Draft",
  description: "Pokemon Draft League management for the Pinheads league.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [seasons, activeSeason, teams] = await Promise.all([
    getSeasons(),
    getActiveSeason(),
    getTeams(),
  ]);

  return (
    <html lang="en" className={`${bebasNeue.variable} ${exo2.variable}`}>
      <body className="font-body min-h-screen bg-background text-foreground antialiased">
        <SiteHeader seasons={seasons} activeSeason={activeSeason} teams={teams} />
        <main className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}