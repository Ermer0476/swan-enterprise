"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Menu, X, Moon, Sun, Search, LogOut, Ship } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import { logoutAction } from "@/app/(auth)/actions";

/**
 * App shell — a collapsible sidebar that fully hides (not just an icon rail).
 * Desktop: a persistent sidebar with an arrow (⌃) that hides it; once hidden a
 * hamburger appears in the top bar to bring it back. Touch devices: no persistent
 * sidebar, the hamburger opens a left drawer. Layout mode is decided by pointer
 * type (not width) so a wide phone in landscape still gets the drawer, and the
 * collapsed state is remembered across visits. (House style, ported from the
 * Searchgear app.)
 */
export function AppShell({
  fullName,
  roles,
  permissions,
  children,
}: {
  fullName: string;
  roles: string[];
  permissions: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const perms = new Set(permissions);

  const [collapsed, setCollapsed] = useState(false); // desktop: sidebar hidden
  const [mobileOpen, setMobileOpen] = useState(false); // touch: drawer open
  const [isDesktop, setIsDesktop] = useState(true); // SSR-safe default
  const [dark, setDark] = useState(false);
  // Which nav item's flyout submenu is open (by href), Searchgear-CRM-style.
  // The flyout itself is rendered via a portal to document.body — the
  // sidebar's <nav> has overflow-y-auto, and per the CSS overflow spec,
  // setting only one axis forces the other to "auto" too, so anything
  // absolutely positioned past the nav's right edge gets silently clipped
  // unless it escapes that scroll container entirely.
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [submenuPos, setSubmenuPos] = useState<{ top: number; left: number } | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (localStorage.getItem("swan-sidebar-collapsed") === "1") setCollapsed(true);
    setIsDesktop(!window.matchMedia("(pointer: coarse)").matches);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function closeSubmenu() {
    setOpenSubmenu(null);
    setSubmenuPos(null);
  }

  // Close the flyout on outside click (but not on a click inside the
  // portaled flyout itself, which lives outside navRef), and on route change.
  useEffect(() => {
    if (!openSubmenu) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Element;
      if (navRef.current?.contains(target) || target.closest("[data-nav-flyout]")) return;
      closeSubmenu();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openSubmenu]);

  useEffect(() => {
    closeSubmenu();
  }, [pathname]);

  function toggleDesktop() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("swan-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

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

  const brand = (
    <div className="flex min-w-0 items-center gap-2.5">
      <Ship className="h-6 w-6 shrink-0 text-accent" />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-sidebar-foreground">SWAN Enterprise</div>
        <div className="truncate text-[10px] text-sidebar-muted">Maritime Management</div>
      </div>
    </div>
  );

  const navLinks = (onNavigate?: () => void) => (
    <nav ref={navRef} className="flex-1 overflow-y-auto px-2 py-3">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.permission || perms.has(i.permission));
        if (items.length === 0) return null;
        return (
          <div key={group.title} className="mb-4">
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
              {group.title}
            </div>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                const base = "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors";
                if (item.soon) {
                  return (
                    <li key={item.href}>
                      <span className={cn(base, "cursor-not-allowed text-sidebar-muted/70")}>
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-sidebar-muted">
                          Soon
                        </span>
                      </span>
                    </li>
                  );
                }
                if (item.children) {
                  const submenuOpen = openSubmenu === item.href;
                  return (
                    <li key={item.href} className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          if (submenuOpen) {
                            closeSubmenu();
                            return;
                          }
                          const rect = e.currentTarget.closest("li")!.getBoundingClientRect();
                          setSubmenuPos({ top: rect.top, left: rect.right + 4 });
                          setOpenSubmenu(item.href);
                        }}
                        aria-label={`${submenuOpen ? "Close" : "Open"} ${item.label} submenu`}
                        aria-expanded={submenuOpen}
                        className={cn(
                          base,
                          "w-full",
                          active
                            ? "bg-accent/90 text-accent-foreground"
                            : "text-sidebar-foreground hover:bg-white/5",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", submenuOpen && "rotate-90")} />
                      </button>
                      {submenuOpen && submenuPos && typeof document !== "undefined" && createPortal(
                        <div
                          data-nav-flyout
                          style={{ position: "fixed", top: submenuPos.top, left: submenuPos.left }}
                          className="z-50 w-56 rounded-md bg-accent p-1.5 shadow-xl"
                        >
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                prefetch={false}
                                onClick={() => {
                                  closeSubmenu();
                                  onNavigate?.();
                                }}
                                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-accent-foreground hover:bg-white/10"
                              >
                                <ChildIcon className="h-4 w-4 shrink-0" />
                                <span className="truncate">{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>,
                        document.body,
                      )}
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        base,
                        active
                          ? "bg-accent/90 text-accent-foreground"
                          : "text-sidebar-foreground hover:bg-white/5",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* Desktop sidebar (fully hidden when collapsed) */}
      {isDesktop && !collapsed && (
        <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground print:hidden">
          <div className="flex h-14 items-center justify-between border-b border-white/5 px-4">
            {brand}
            <button
              type="button"
              onClick={toggleDesktop}
              title="Hide menu"
              aria-label="Hide menu"
              className="rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-white/5 hover:text-sidebar-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          {navLinks()}
        </aside>
      )}

      {/* Mobile drawer + backdrop */}
      {!isDesktop && mobileOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-white/5 px-4">
              {brand}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                title="Close menu"
                aria-label="Close menu"
                className="rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-white/5 hover:text-sidebar-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {navLinks(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur print:hidden sm:px-5">
          {/* Hamburger — touch always; desktop only when the sidebar is hidden */}
          {(!isDesktop || collapsed) && (
            <button
              type="button"
              onClick={() => (isDesktop ? toggleDesktop() : setMobileOpen(true))}
              aria-label="Open menu"
              title="Show menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

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

        <main className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">{children}</main>
      </div>
    </div>
  );
}
