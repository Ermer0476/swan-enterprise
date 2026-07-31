import Link from "next/link";
import { Plus, Megaphone } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listCirculars } from "@/features/circulars/queries";
import { CIRCULAR_CATEGORIES } from "@/features/circulars/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate, humanize } from "@/lib/utils";
import type { CircularCategory } from "@/lib/generated/prisma";

export default async function CircularsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("circular:read");
  const sp = await searchParams;
  const rows = await listCirculars(user.companyId, {
    search: sp.q || undefined,
    category: (sp.category as CircularCategory) || undefined,
  });
  const canCreate = can(user, "circular:create");

  return (
    <>
      <PageHeader
        title="Circulars"
        description="Office notices and instructions issued to the fleet."
        actions={
          canCreate ? (
            <Link href="/circulars/new">
              <Button><Plus className="h-4 w-4" /> Issue Circular</Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input name="q" placeholder="Search by ref or title…" defaultValue={sp.q ?? ""} />
        </div>
        <Select name="category" defaultValue={sp.category ?? ""} className="w-44">
          <option value="">Any category</option>
          {CIRCULAR_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Megaphone className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No circulars found</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canCreate ? "Issue a circular to notify the fleet or a specific vessel." : "No circulars match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ref</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Distribution</th>
                  <th className="px-4 py-2.5 font-medium">Issued</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/circulars/${r.id}`} className="text-accent hover:underline">{r.refNo}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/circulars/${r.id}`} className="hover:underline">{r.title}</Link>
                    </td>
                    <td className="px-4 py-2.5"><Badge tone="accent">{humanize(r.category)}</Badge></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.vessel?.name ?? "Fleet-wide"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.issueDate)}</td>
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
