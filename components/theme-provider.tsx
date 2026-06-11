"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function getThemeClass(pathname: string): string {
  if (pathname === "/") return "theme-home";
  if (pathname.startsWith("/settings")) return "theme-settings";
  if (pathname.startsWith("/rosters") || pathname.startsWith("/draft")) return "theme-league";
  return "";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const body = document.body;
    // Remove all theme classes first
    body.classList.remove("theme-home", "theme-settings", "theme-league");
    // Add the correct one
    const theme = getThemeClass(pathname);
    if (theme) body.classList.add(theme);
  }, [pathname]);

  return <>{children}</>;
}
