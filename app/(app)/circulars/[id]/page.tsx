import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { getCircular } from "@/features/circulars/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/utils";
import { CircularActions } from "./circular-actions";

export default async function CircularDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("circular:read");
  const { id } = await params;
  const circular = await getCircular(user.companyId, id);
  if (!circular) notFound();

  const canDelete = can(user, "circular:delete");

  const meta = [
    { label: "Category", value: humanize(circular.category) },
    { label: "Distribution", value: circular.vessel?.name ?? "Fleet-wide" },
    { label: "Issued", value: formatDate(circular.issueDate) },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/circulars" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Circulars
      </Link>

      <PageHeader
        title={`${circular.refNo} — ${circular.title}`}
        actions={<Badge tone="accent">{humanize(circular.category)}</Badge>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {meta.map((m) => (
          <div key={m.label}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-0.5 text-sm font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Content</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm">{circular.body}</p></CardContent>
      </Card>

      <CircularActions circularId={circular.id} canDelete={canDelete} />
    </div>
  );
}
