import Link from "next/link";
import { ArrowLeft, Plus, ClipboardList } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import {
  listLsaFfeCatalog,
  getVesselLsaFfeCoverage,
  type LsaFfeChecklistRow,
} from "@/features/crew-familiarization/queries";
import { listVesselOptions } from "@/features/drills/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LsaFfeMatrix } from "@/components/crew-familiarization/lsa-ffe-matrix";
import { MatrixVesselPicker } from "@/components/crew-familiarization/matrix-vessel-picker";

// The LSA/FFE matrix — by default the reference WK1–WK8 schedule (which items
// are covered in which week). Pick a vessel to overlay that vessel's current-
// cycle records, so each item's cell shows the actual date it was familiarized.
export default async function ReferenceMatrixPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("drill:read");
  const sp = await searchParams;
  // Shipboard crew are locked to their own vessel — no picker, and they can
  // never see another ship's records. Office/admin pick any vessel.
  const isShipboard = user.department === "SHIPBOARD";
  const selectedVesselId = isShipboard ? (user.vesselId ?? "") : sp.vesselId || "";

  const [catalog, vessels] = await Promise.all([
    listLsaFfeCatalog(user.companyId),
    listVesselOptions(user.companyId),
  ]);
  const canCreate = can(user, "drill:create");

  // Default: blank reference rows (no dates). If a vessel is picked and it has a
  // current familiarization, swap in that vessel's live checklist (with dates).
  let rows: LsaFfeChecklistRow[] = catalog.map((c) => ({
    id: c.id,
    category: c.category,
    itemNo: c.itemNo,
    name: c.name,
    completedDate: null,
    suggestedWeek: c.suggestedWeek,
    actualWeek: null,
    dueStatus: "upcoming",
  }));
  let hasRecord = false;

  if (selectedVesselId) {
    // Aggregate every session this vessel has logged — each item shows the
    // latest date it was familiarized.
    rows = await getVesselLsaFfeCoverage(user.companyId, selectedVesselId);
    hasRecord = rows.some((r) => r.completedDate);
  }

  const selectedVesselName = vessels.find((v) => v.id === selectedVesselId)?.name ?? null;
  const lsa = rows.filter((r) => r.category === "LSA");
  const ffe = rows.filter((r) => r.category === "FFE");

  const description = selectedVesselName
    ? hasRecord
      ? `Latest familiarization date recorded per item for ${selectedVesselName} (across all sessions).`
      : `No familiarization recorded yet for ${selectedVesselName} — items still outstanding are marked red.`
    : isShipboard
      ? "Reference schedule (CK-047(a)) — which items are covered in which week of the 8-week cycle."
      : "Reference schedule (CK-047(a)) — which items are covered in which week of the 8-week cycle. Pick a vessel to see its recorded dates.";

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/drills/crew-familiarization"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to LSA/FFE Familiarization
      </Link>

      <PageHeader
        title="LSA/FFE Familiarization Matrix"
        description={description}
        actions={
          <div className="flex items-center gap-2">
            <Link href={selectedVesselId ? `/drills/crew-familiarization?vesselId=${selectedVesselId}` : "/drills/crew-familiarization"}>
              <Button type="button" variant="outline" size="sm">
                <ClipboardList className="h-4 w-4" /> See Records
              </Button>
            </Link>
            {canCreate && (
              <Link href="/drills/crew-familiarization/new">
                <Button size="sm"><Plus className="h-4 w-4" /> New Familiarization</Button>
              </Link>
            )}
          </div>
        }
      />

      {!isShipboard && (
        <div className="mb-4">
          <MatrixVesselPicker vessels={vessels} selected={selectedVesselId} />
        </div>
      )}

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Life Saving Appliances</CardTitle>
            <span className="text-xs tabular-nums text-muted-foreground">{lsa.length} items</span>
          </CardHeader>
          <CardContent className="p-0">
            <LsaFfeMatrix items={lsa} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Fire Fighting Equipment</CardTitle>
            <span className="text-xs tabular-nums text-muted-foreground">{ffe.length} items</span>
          </CardHeader>
          <CardContent className="p-0">
            <LsaFfeMatrix items={ffe} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
