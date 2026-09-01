import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/rbac";
import { DEFAULT_CREW_MANNING, DEFAULT_CREW_NATIONALITY, DEFAULT_CREW_ITF, DEFAULT_CREW_NOTES } from "../../defaults";
import CrewingParticularsEditor from "./CrewingParticularsEditor";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };
type CrewData = { nationality: string; itf: string; manning: { count: number; position: string }[]; notes: string };

export default async function CrewingParticularsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("budget:read");
  const sp = await searchParams;
  const vesselId = typeof sp.vessel === "string" ? sp.vessel : "";
  const year = typeof sp.year === "string" && /^\d{4}$/.test(sp.year) ? Number(sp.year) : new Date().getUTCFullYear() + 1;

  const vessel = vesselId ? await prisma.vessel.findFirst({ where: { id: vesselId, companyId: user.companyId }, select: { id: true, name: true } }) : null;
  if (!vessel) notFound();

  // Load this year's crewing particulars; if none, carry from the latest prior
  // year; else fall back to the standard template.
  const rows = await prisma.budgetOpex.findMany({ where: { companyId: user.companyId, vesselId: vessel.id, category: "Crewing", subItem: "__crewparticulars__" }, select: { monthYear: true, basis: true } });
  const parse = (b: string | null): CrewData | null => { try { return b ? JSON.parse(b) : null; } catch { return null; } };
  let data: CrewData | null = parse(rows.find((r) => r.monthYear === `PROP-${year}`)?.basis ?? null);
  if (!data) {
    const prior = rows
      .map((r) => ({ y: Number(/^PROP-(\d{4})$/.exec(r.monthYear)?.[1] ?? 0), d: parse(r.basis) }))
      .filter((x) => x.y && x.y < year && x.d)
      .sort((a, b) => b.y - a.y)[0];
    data = prior?.d ?? null;
  }
  const initial: CrewData = data ?? { nationality: DEFAULT_CREW_NATIONALITY, itf: DEFAULT_CREW_ITF, manning: DEFAULT_CREW_MANNING, notes: DEFAULT_CREW_NOTES };

  const backHref = `/budget-proposal/build/category?vessel=${vessel.id}&year=${year}&cat=${encodeURIComponent("Crewing")}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to Crewing · {vessel.name}
      </Link>
      <PageHeader title={`Crewing Particulars · ${vessel.name}`} description={`FY ${year} — manning list and notes shown in the owner report. Editable; update when the crew changes.`} />
      <CrewingParticularsEditor vesselId={vessel.id} year={year} initial={initial} backHref={backHref} />
    </div>
  );
}
