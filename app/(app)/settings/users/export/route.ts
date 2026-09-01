import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { buildUsersExport } from "@/features/users/export";

/**
 * Employee Masterlist export (E2) — streams the current user list as an .xlsx.
 *
 * Read-only, so it is gated on `admin:manage-users` and nothing more (the
 * shore-only rule guards writes, not reads). The search / status filter is
 * read from the query string so the download matches exactly what the admin is
 * looking at on the list page — the same mapping page.tsx uses, kept in step by
 * reading the identical `q` / `status` params.
 */
export async function GET(req: Request): Promise<Response> {
  const actor = await requirePermission("admin:manage-users");

  const url = new URL(req.url);
  const search = url.searchParams.get("q") || undefined;
  const status = url.searchParams.get("status");
  const active = status === "active" ? true : status === "inactive" ? false : undefined;

  const { buffer, rowCount } = await buildUsersExport(actor.companyId, { search, active });

  const filterLabel = status === "active" ? "active only" : status === "inactive" ? "inactive only" : "all statuses";
  await writeAudit({
    actor,
    action: "EXPORT",
    entityType: "User",
    summary:
      `${actor.fullName} exported ${rowCount} user row(s) to Excel` +
      ` (${filterLabel}${search ? `, search "${search}"` : ""})`,
    metadata: { rowCount, filter: { search: search ?? null, status: status ?? null } },
  });

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `swan-users-${stamp}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
