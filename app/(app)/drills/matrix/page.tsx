import Link from "next/link";
import { ArrowLeft, Plus, ClipboardList } from "lucide-react";
import { requirePermission, can } from "@/lib/rbac";
import { listVesselOptions } from "@/features/drills/queries";
import { buildScheduleMatrix } from "@/features/schedule/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MatrixTable } from "@/components/schedule/matrix-table";
import type { ScheduleItemKind } from "@/lib/generated/prisma";

export default async function DrillMatrixPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("drill:read");
  const sp = await searchParams;
  const isShipboard = user.department === "SHIPBOARD";
  const canCreate = can(user, "drill:create");
  const canEditApplicability = can(user, "drill:close");
  const canEditFrequency = can(user, "schedule:manage");

  const vessels = await listVesselOptions(user.companyId);
  const vesselId = isShipboard ? user.vesselId : (sp.vesselId || vessels[0]?.id || null);
  const vesselName = vessels.find((v) => v.id === vesselId)?.name ?? null;

  const currentYear = new Date().getFullYear();
  const year = sp.year ? Number(sp.year) : currentYear;
  const tab: ScheduleItemKind = sp.tab === "familiarization" ? "FAMILIARIZATION" : "DRILL";

  const rows = vesselId ? await buildScheduleMatrix(user.companyId, vesselId, tab, year) : [];

  const tabHref = (t: "drill" | "familiarization") => {
    const params = new URLSearchParams();
    if (!isShipboard && vesselId) params.set("vesselId", vesselId);
    params.set("year", String(year));
    params.set("tab", t);
    return `/drills/matrix?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/drills" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Emergency Drills
      </Link>

      <PageHeader
        title="Drill & Familiarization Matrix"
        description="Compliance schedule per SMS A-EMP-01 (drills) and CK-047(b) (familiarization) — office use only unless viewing your own vessel."
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        {!isShipboard && (
          <div className="w-64 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Vessel</label>
            <Select name="vesselId" defaultValue={vesselId ?? ""}>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </Select>
          </div>
        )}
        <input type="hidden" name="tab" value={tab === "FAMILIARIZATION" ? "familiarization" : "drill"} />
        <div className="w-32 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Year</label>
          <Select name="year" defaultValue={String(year)}>
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Link href={tabHref("drill")}>
            <Button type="button" variant={tab === "DRILL" ? "default" : "outline"} size="sm">Emergency Drills</Button>
          </Link>
          <Link href={tabHref("familiarization")}>
            <Button type="button" variant={tab === "FAMILIARIZATION" ? "default" : "outline"} size="sm">Familiarization</Button>
          </Link>
          <Link href={vesselId ? `/drills/crew-familiarization/matrix?vesselId=${vesselId}` : "/drills/crew-familiarization/matrix"}>
            <Button type="button" variant="outline" size="sm">LSA/FFE Familiarization</Button>
          </Link>
        </div>
        {tab === "DRILL" && (
          <div className="flex items-center gap-2">
            <Link href="/drills">
              <Button type="button" variant="outline" size="sm">
                <ClipboardList className="h-4 w-4" /> See Records
              </Button>
            </Link>
            {canCreate && vesselId && (
              <Link href="/drills/new">
                <Button size="sm"><Plus className="h-4 w-4" /> Record Drill</Button>
              </Link>
            )}
          </div>
        )}
        {tab === "FAMILIARIZATION" && (
          <div className="flex items-center gap-2">
            <Link href={vesselId ? `/drills/familiarization?vesselId=${vesselId}` : "/drills/familiarization"}>
              <Button type="button" variant="outline" size="sm">
                <ClipboardList className="h-4 w-4" /> See Records
              </Button>
            </Link>
            {canCreate && vesselId && (
              <Link href={`/drills/matrix/log-familiarization?vesselId=${vesselId}`}>
                <Button size="sm"><Plus className="h-4 w-4" /> Log Familiarization</Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {!vesselId ? (
        <p className="text-sm text-muted-foreground">No vessel available.</p>
      ) : (
        <>
          <p className="mb-3 text-sm font-medium">{vesselName}</p>
          <MatrixTable
            rows={rows}
            year={year}
            vesselId={vesselId ?? undefined}
            canEditApplicability={canEditApplicability}
            canEditFrequency={canEditFrequency}
            recordHref={tab === "DRILL" ? (id) => `/drills/${id}` : undefined}
          />
        </>
      )}
    </div>
  );
}
