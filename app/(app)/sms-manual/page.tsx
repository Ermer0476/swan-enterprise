import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { can } from "@/lib/rbac";
import { listDocuments } from "@/features/sms-manual/queries";
import { DEPARTMENTS } from "@/features/sms-manual/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { DocumentStatus } from "@/lib/generated/prisma";

const STATUSES: DocumentStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "ARCHIVED",
];

export default async function SmsManualPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("sms:read");
  const sp = await searchParams;

  const docs = await listDocuments(user.companyId, {
    search: sp.q || undefined,
    status: (sp.status as DocumentStatus) || undefined,
    department: sp.dept || undefined,
  });

  const canCreate = can(user, "sms:create");

  return (
    <>
      <PageHeader
        title="SMS Manual"
        description="Controlled Ship Management System documents — versioned and approval-tracked."
        actions={
          canCreate ? (
            <Link href="/sms-manual/new">
              <Button>
                <Plus className="h-4 w-4" /> New Document
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* Filters */}
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input
            name="q"
            placeholder="Search by code or title…"
            defaultValue={sp.q ?? ""}
          />
        </div>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-44">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </Select>
        <Select name="dept" defaultValue={sp.dept ?? ""} className="w-44">
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {docs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No documents found</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate
              ? "Create the first controlled document to start building the SMS Manual."
              : "No SMS documents match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Code</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 font-medium">Department</th>
                  <th className="px-4 py-2.5 font-medium">Rev</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Owner</th>
                  <th className="px-4 py-2.5 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link
                        href={`/sms-manual/${d.id}`}
                        className="text-accent hover:underline"
                      >
                        {d.code}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/sms-manual/${d.id}`}
                        className="hover:underline"
                      >
                        {d.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {d.department}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                      {d.currentRevision?.revisionNo ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={statusTone(d.status)}>
                        {d.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {d.owner?.fullName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {formatDate(d.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
