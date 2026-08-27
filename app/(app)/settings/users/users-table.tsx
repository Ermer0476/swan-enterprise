"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useSortableRows } from "@/lib/use-sortable-rows";
import { formatDate, humanize } from "@/lib/utils";

export type UserRowView = {
  id: string;
  fullName: string;
  email: string;
  department: string;
  rank: string | null;
  roleNames: string[];
  vesselName: string | null;
  active: boolean;
  lastLoginAt: string | null; // ISO
  isSelf: boolean;
};

export function UsersTable({ rows }: { rows: UserRowView[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortableRows<UserRowView>(
    rows,
    (r, key) => {
      switch (key) {
        case "name":
          return r.fullName;
        case "email":
          return r.email;
        case "department":
          return `${humanize(r.department)} ${r.rank ?? ""}`;
        case "roles":
          return r.roleNames.join(", ");
        case "vessel":
          return r.vesselName ?? "";
        case "status":
          // Active first when ascending — the list an admin usually wants.
          return r.active ? 0 : 1;
        case "lastLogin":
          // Never signed in sorts oldest, not as "today".
          return r.lastLoginAt ? new Date(r.lastLoginAt) : new Date(0);
        default:
          return "";
      }
    },
  );

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <SortableHeader label="Name" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Email" sortKey="email" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Department / Rank" sortKey="department" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="System Accesses" sortKey="roles" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Vessel" sortKey="vessel" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Last Sign-in" sortKey="lastLogin" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
          <SortableHeader label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
            <td className="px-4 py-2.5">
              <Link href={`/settings/users/${r.id}`} className="text-accent hover:underline">
                {r.fullName}
              </Link>
              {r.isSelf && (
                <span className="ml-2 text-xs text-muted-foreground">(you)</span>
              )}
            </td>
            <td className="px-4 py-2.5 text-muted-foreground">{r.email}</td>
            <td className="px-4 py-2.5 text-muted-foreground">
              {humanize(r.department)}
              {r.rank ? ` · ${r.rank}` : ""}
            </td>
            <td className="px-4 py-2.5">
              <div className="flex flex-wrap gap-1">
                {r.roleNames.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  r.roleNames.map((n) => (
                    <Badge key={n} tone="accent">{n}</Badge>
                  ))
                )}
              </div>
            </td>
            <td className="px-4 py-2.5 text-muted-foreground">{r.vesselName ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted-foreground">
              {r.lastLoginAt ? formatDate(r.lastLoginAt) : "Never"}
            </td>
            <td className="px-4 py-2.5">
              <Badge tone={r.active ? "success" : "neutral"}>
                {r.active ? "Active" : "Inactive"}
              </Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
