import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import { hasPostedOpeningStockTake } from "@/features/procurement/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { NewRequisitionForm } from "./new-requisition-form";

export default async function NewRequisitionPage({ params }: { params: Promise<{ vesselId: string }> }) {
  const user = await requirePermission("procurement:create");
  const { vesselId } = await params;
  const vessel = await getVessel(user.companyId, vesselId);
  if (!vessel) notFound();

  const posted = await hasPostedOpeningStockTake(user.companyId, vesselId);

  return (
    <div className="mx-auto max-w-lg">
      <Link href={`/procurement/${vesselId}/requisitions`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        ← Back to Requisitions
      </Link>
      <PageHeader title={`${vessel.name} — New Requisition`} description="Choose a category. Lines are added on the next page." />

      {!posted ? (
        <p className="text-sm text-warning">
          Post the{" "}
          <Link href={`/procurement/${vesselId}/opening-stock-take`} className="underline">
            Opening Stock Take
          </Link>{" "}
          before creating requisitions.
        </p>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <NewRequisitionForm vesselId={vesselId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
