"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Ship } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";

export function Sidebar({ permissions }: { permissions: string[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const perms = new Set(permissions);

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 print:hidden",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-white/5 px-4">
        <Ship className="h-6 w-6 shrink-0 text-accent" />
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">SWAN Enterprise</div>
            <div className="truncate text-[10px] text-sidebar-muted">
              Maritime Management
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((group) => {
          const items = group.items.filter(
            (i) => !i.permission || perms.has(i.permission),
          );
          if (items.length === 0) return null;
          return (
            <div key={group.title} className="mb-4">
              {!collapsed && (
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {group.title}
                </div>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  const content = (
                    <>
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {!collapsed && item.soon && (
                        <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-sidebar-muted">
                          Soon
                        </span>
                      )}
                    </>
                  );
                  const base =
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors";
                  if (item.soon) {
                    return (
                      <li key={item.href}>
                        <span
                          className={cn(
                            base,
                            "cursor-not-allowed text-sidebar-muted/70",
                          )}
                          title={collapsed ? `${item.label} (soon)` : undefined}
                        >
                          {content}
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          base,
                          active
                            ? "bg-accent/90 text-accent-foreground"
                            : "text-sidebar-foreground hover:bg-white/5",
                        )}
                      >
                        {content}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex h-11 items-center gap-2 border-t border-white/5 px-4 text-sidebar-muted transition-colors hover:text-sidebar-foreground"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4 transition-transform",
            collapsed && "rotate-180",
          )}
        />
        {!collapsed && <span className="text-xs">Collapse</span>}
      </button>
    </aside>
  );
}
