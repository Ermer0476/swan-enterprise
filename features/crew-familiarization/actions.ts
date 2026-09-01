"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { allocateRefNo } from "@/lib/ref-sequence";
import { createAndLogFamiliarizationSchema } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string, vesselCode: string): Promise<string> {
  return allocateRefNo(companyId, `${vesselCode}-CF-${new Date().getFullYear()}`);
}

// One familiarization session = one record, exactly like an Emergency Drill
// record: pick the vessel, week, date, who attended and the items covered, and
// save. Reuses the drill:* permission keys — same audience as Emergency Drills.
export async function createAndLogFamiliarizationAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("drill:create");
  const parsed = createAndLogFamiliarizationSchema.safeParse({
    vesselId: formData.get("vesselId"),
    attendees: formData.get("attendees"),
    supervisedBy: formData.get("supervisedBy") ?? "",
    details: formData.get("details") ?? "",
    cycleStartDate: formData.get("cycleStartDate"),
    week: formData.get("week"),
    completedDate: formData.get("completedDate") ?? "",
    checkedItemIds: formData.getAll("checkedItemIds"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const vessel = await prisma.vessel.findFirst({
    where: { id: d.vesselId, companyId: user.companyId, deletedAt: null },
    select: { code: true },
  });
  if (!vessel) return fail("Vessel not found");

  // Only accept ids that are real catalog items scheduled for the week logged.
  const weekItems = await prisma.lsaFfeItem.findMany({
    where: {
      companyId: user.companyId,
      active: true,
      suggestedWeek: d.week,
      id: { in: d.checkedItemIds },
    },
    select: { id: true },
  });
  if (weekItems.length === 0) return fail("Tick at least one item covered this week");

  const date = new Date(d.completedDate);
  const record = await prisma.crewFamiliarization.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId, vessel.code),
      vesselId: d.vesselId,
      week: d.week,
      attendees: d.attendees,
      cycleStartDate: new Date(d.cycleStartDate),
      supervisedBy: d.supervisedBy || null,
      details: d.details || null,
      createdBy: user.id,
      updatedBy: user.id,
      records: {
        create: weekItems.map((i) => ({
          companyId: user.companyId,
          lsaFfeItemId: i.id,
          completedDate: date,
          createdBy: user.id,
          updatedBy: user.id,
        })),
      },
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "CrewFamiliarization",
    entityId: record.id,
    summary: `Logged LSA/FFE familiarization ${record.refNo} — WK${d.week} (${weekItems.length} item(s))`,
  });

  revalidatePath("/drills/crew-familiarization");
  redirect(`/drills/crew-familiarization/${record.id}`);
}

export async function deleteCrewFamiliarizationAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("drill:delete");
  const id = String(formData.get("crewFamiliarizationId") ?? "");
  const record = await prisma.crewFamiliarization.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!record) return fail("Familiarization record not found");

  await prisma.crewFamiliarization.update({
    where: { id: record.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "CrewFamiliarization",
    entityId: record.id,
    summary: `Deleted LSA/FFE familiarization ${record.refNo}`,
  });

  revalidatePath("/drills/crew-familiarization");
  redirect("/drills/crew-familiarization");
}
