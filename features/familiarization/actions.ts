"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { allocateRefNo } from "@/lib/ref-sequence";
import { logFamiliarizationBatchSchema } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

// Reuses the drill:* permission keys — familiarization logging shares the
// exact same audience and workflow as drills (office full CRUD, Ship
// Officer logs/edits their own vessel), so a separate permission namespace
// would just duplicate every role grant for no behavioral difference.
//
// One session logs every topic it actually covered in a single submit — a
// crew induction routinely touches several SMS plans in one sitting, and
// forcing a separate form submission per topic just meant re-entering the
// same date/noted-by five or six times.
export async function createFamiliarizationBatchAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("drill:create");
  const parsed = logFamiliarizationBatchSchema.safeParse({
    vesselId: formData.get("vesselId"),
    scheduleItemIds: formData.getAll("scheduleItemIds"),
    completedDate: formData.get("completedDate"),
    notedBy: formData.get("notedBy"),
    remarks: formData.get("remarks"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const vessel = await prisma.vessel.findFirst({
    where: { id: d.vesselId, companyId: user.companyId, deletedAt: null },
    select: { code: true },
  });
  if (!vessel) return fail("Vessel not found");

  // One session = one drill-style record, covering every topic touched this
  // sitting (each linked as a FamiliarizationRecord).
  const date = new Date(d.completedDate);
  const refNo = await allocateRefNo(user.companyId, `${vessel.code}-FAM-${new Date().getFullYear()}`);
  const session = await prisma.familiarizationSession.create({
    data: {
      companyId: user.companyId,
      refNo,
      vesselId: d.vesselId,
      sessionDate: date,
      notedBy: d.notedBy || null,
      remarks: d.remarks || null,
      createdBy: user.id,
      updatedBy: user.id,
      records: {
        create: d.scheduleItemIds.map((scheduleItemId) => ({
          companyId: user.companyId,
          vesselId: d.vesselId,
          scheduleItemId,
          completedDate: date,
          notedBy: d.notedBy || null,
          remarks: d.remarks || null,
          createdBy: user.id,
          updatedBy: user.id,
        })),
      },
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "FamiliarizationSession",
    entityId: session.id,
    summary: `Logged familiarization ${session.refNo} — ${d.scheduleItemIds.length} topic${d.scheduleItemIds.length === 1 ? "" : "s"}`,
  });

  revalidatePath("/drills/matrix");
  redirect(`/drills/familiarization/${session.id}`);
}

export async function deleteFamiliarizationSessionAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("drill:delete");
  const id = String(formData.get("sessionId") ?? "");
  const session = await prisma.familiarizationSession.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!session) return fail("Familiarization record not found");

  const now = new Date();
  await prisma.$transaction([
    prisma.familiarizationSession.update({
      where: { id: session.id },
      data: { deletedAt: now, deletedBy: user.id },
    }),
    // Soft-delete the topic completions too, so the matrix's Last/Next stops
    // counting this session.
    prisma.familiarizationRecord.updateMany({
      where: { familiarizationSessionId: session.id, deletedAt: null },
      data: { deletedAt: now, deletedBy: user.id },
    }),
  ]);

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "FamiliarizationSession",
    entityId: session.id,
    summary: `Deleted familiarization ${session.refNo}`,
  });

  revalidatePath("/drills/matrix");
  redirect("/drills/familiarization");
}

export async function deleteFamiliarizationRecordAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("drill:delete");
  const id = String(formData.get("recordId") ?? "");
  const record = await prisma.familiarizationRecord.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!record) return fail("Record not found");

  await prisma.familiarizationRecord.update({
    where: { id: record.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "FamiliarizationRecord",
    entityId: record.id,
    summary: "Deleted a familiarization completion",
  });

  revalidatePath("/drills/matrix");
  return OK;
}
