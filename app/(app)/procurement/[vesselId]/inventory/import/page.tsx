import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getVessel } from "@/features/vessels/queries";
import { PageHeader } from "@/components/ui/page-header";
import { ImportInventoryForm } from "./import-inventory-form";

export default async function ImportInventoryPage({ params }: { params: Promise<{ vesselId: string }> }) {
  const user = await requirePermission("procurement:create");
  const { vesselId } = await params;
  const vessel = await getVessel(user.companyId, vesselId);
  if (!vessel) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/procurement/${vesselId}/inventory`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        ← Back to Inventory Ledger
      </Link>
      <PageHeader title={`${vessel.name} — Import Inventory from Excel`} description="Upload a spreadsheet, review what was found, then save." />
      <ImportInventoryForm vesselId={vesselId} />
    </div>
  );
}
