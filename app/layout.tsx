import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { getActiveSeason, getSeasons, getTeams } from "@/lib/data";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pinheads Draft",
  description: "Pokemon Draft League management for the Pinheads league."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [seasons, activeSeason] = await Promise.all([getSeasons(), getActiveSeason()]);
  const teams = await getTeams(activeSeason?.id);

  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SiteHeader seasons={seasons} activeSeason={activeSeason} teams={teams} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
