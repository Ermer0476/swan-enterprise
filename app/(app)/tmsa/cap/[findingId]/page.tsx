import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getFinding } from "@/features/tmsa/queries";
import { updateFindingAction } from "@/features/tmsa/actions";
import { TMSA_FINDING_STATUSES, TMSA_FINDING_STATUS_LABELS } from "@/features/tmsa/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function EditFindingPage({ params }: { params: Promise<{ findingId: string }> }) {
  const user = await requirePermission("tmsa:manage-cap");
  const { findingId } = await params;
  const f = await getFinding(user.companyId, findingId);
  if (!f) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${f.code}`} description={`Element ${f.elementCode} · Stage/Q ${f.stageQ} · Source: ${f.source}`} />

      <Link href="/tmsa/cap" className="mb-4 inline-block text-sm text-accent hover:underline">
        ← Back to CAP tracker
      </Link>

      <Card className="mb-5">
        <CardContent className="pt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observation ({f.source})</p>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{f.observation}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <form action={updateFindingAction} className="space-y-5">
            <input type="hidden" name="id" value={f.id} />

            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={f.status}>
                {TMSA_FINDING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TMSA_FINDING_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="correctiveAction">Corrective Action</Label>
              <Textarea id="correctiveAction" name="correctiveAction" defaultValue={f.correctiveAction} rows={6} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="responsible">Responsible</Label>
                <Input id="responsible" name="responsible" defaultValue={f.responsible} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target">Target</Label>
                <Input id="target" name="target" defaultValue={f.target} placeholder="e.g. Jun 2026, Q3 2026, COMPLETED" />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit">Save changes</Button>
              <Link href="/tmsa/cap">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
