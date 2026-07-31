import Link from "next/link";
import { Plus, FolderOpen } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listDocuments } from "@/features/documents/queries";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES } from "@/features/documents/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate, humanize } from "@/lib/utils";
import type { ControlledDocStatus, DocumentCategory } from "@/lib/generated/prisma";

function statusTone(s: string) {
  if (s === "APPROVED") return "success";
  if (s === "SUPERSEDED") return "danger";
  return "warning"; // DRAFT
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("doc:read");
  const sp = await searchParams;
  const rows = await listDocuments(user.companyId, {
    search: sp.q || undefined,
    status: (sp.status as ControlledDocStatus) || undefined,
    category: (sp.category as DocumentCategory) || undefined,
  });
  const canCreate = can(user, "doc:create");

  return (
    <>
      <PageHeader
        title="Documents"
        description="Controlled forms, checklists, certificates, manuals and procedures."
        actions={
          canCreate ? (
            <Link href="/documents/new">
              <Button><Plus className="h-4 w-4" /> Add Document</Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by number or title…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="category" defaultValue={sp.category ?? ""} className="w-44">
          <option value="">Any category</option>
          {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-36">
          <option value="">All statuses</option>
          {DOCUMENT_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No documents found</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate ? "Add a controlled document to the register." : "No documents match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">No.</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Vessel</th>
                  <th className="px-4 py-2.5 font-medium">Issued</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/documents/${r.id}`} className="text-accent hover:underline">{r.docNumber}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/documents/${r.id}`} className="hover:underline">{r.title}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{humanize(r.category)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.vessel?.name ?? "Fleet-wide"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.issueDate)}</td>
                    <td className="px-4 py-2.5"><Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge></td>
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
