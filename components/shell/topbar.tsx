"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Search, LogOut } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";

export function Topbar({
  fullName,
  roles,
}: {
  fullName: string;
  roles: string[];
}) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    localStorage.setItem("swan-theme", next ? "dark" : "light");
    setDark(next);
  }

  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-5 backdrop-blur print:hidden">
      {/* Global search (UI shell — wired to the search service in a later phase) */}
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search documents, incidents, crew, vessels…"
          className="h-9 w-full rounded-md border border-input bg-muted/40 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="flex items-center gap-2.5 pl-2">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-tight">{fullName}</div>
            <div className="text-[11px] leading-tight text-muted-foreground">
              {roles.join(", ") || "No role"}
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </div>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
