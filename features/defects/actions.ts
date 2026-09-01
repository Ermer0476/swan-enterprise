"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { allocateRefNo } from "@/lib/ref-sequence";
import { createDefectSchema, updateDefectSchema, defectRemarksSchema } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string, vesselCode: string): Promise<string> {
  return allocateRefNo(companyId, `${vesselCode}-DEF-${new Date().getFullYear()}`);
}

export async function createDefectAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("defect:create");
  const parsed = createDefectSchema.safeParse({
    vesselId: formData.get("vesselId"),
    equipment: formData.get("equipment"),
    description: formData.get("description"),
    severity: formData.get("severity"),
    dateRaised: formData.get("dateRaised"),
    targetRectificationDate: formData.get("targetRectificationDate"),
    raisedBy: formData.get("raisedBy"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const vessel = await prisma.vessel.findFirst({
    where: { id: d.vesselId, companyId: user.companyId },
    select: { code: true },
  });
  if (!vessel) return fail("Vessel not found");

  const defect = await prisma.defect.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId, vessel.code),
      vesselId: d.vesselId,
      equipment: d.equipment,
      description: d.description,
      severity: d.severity,
      dateRaised: new Date(d.dateRaised),
      targetRectificationDate: d.targetRectificationDate ? new Date(d.targetRectificationDate) : null,
      raisedBy: d.raisedBy || null,
      status: "OPEN",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "Defect",
    entityId: defect.id,
    summary: `Reported defect ${defect.refNo} — ${defect.equipment}`,
  });

  revalidatePath("/defects");
  redirect(`/defects/${defect.id}`);
}

export async function updateDefectAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("defect:update");
  const parsed = updateDefectSchema.safeParse({
    defectId: formData.get("defectId"),
    status: formData.get("status"),
    actionTaken: formData.get("actionTaken"),
    targetRectificationDate: formData.get("targetRectificationDate"),
    rectifiedAt: formData.get("rectifiedAt"),
  });
  if (!parsed.success) return fail("Invalid input");
  const d = parsed.data;

  const defect = await prisma.defect.findFirst({
    where: { id: d.defectId, companyId: user.companyId, deletedAt: null },
  });
  if (!defect) return fail("Defect not found");

  // A Rectified (closed-out) defect is a closed record — status, action
  // taken and target date freeze at whatever they were when it closed,
  // same as CAPA/NCR closure elsewhere. The client already hides the form
  // once closed; this is the server-side backstop against a bypassed UI.
  if (defect.status === "RECTIFIED") {
    return fail("This defect is already closed (Rectified) and can no longer be changed.");
  }
  // Date rectified is entered manually (the actual day the work was done),
  // not auto-stamped to today — required the moment the defect is closed.
  if (d.status === "RECTIFIED" && !d.rectifiedAt) {
    return fail("Enter the date this defect was rectified");
  }

  await prisma.defect.update({
    where: { id: defect.id },
    data: {
      status: d.status,
      actionTaken: d.actionTaken || null,
      targetRectificationDate: d.targetRectificationDate ? new Date(d.targetRectificationDate) : null,
      rectifiedAt: d.status === "RECTIFIED" ? new Date(d.rectifiedAt!) : null,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Defect",
    entityId: defect.id,
    summary: `${defect.refNo} set to ${d.status}`,
  });

  revalidatePath(`/defects/${defect.id}`);
  return OK;
}

// Ship- or office-side remarks — updates ONLY the one column named by `kind`,
// so vessel remarks, office remarks and the structured status/actionTaken can
// never clobber each other (each has its own save).
export async function saveDefectRemarksAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("defect:update");
  const parsed = defectRemarksSchema.safeParse({
    defectId: formData.get("defectId"),
    kind: formData.get("kind"),
    value: formData.get("value"),
  });
  if (!parsed.success) return fail("Invalid input");
  const d = parsed.data;

  // Each side only ever writes its own box — a shipboard session can never
  // save Office remarks, and an office session can never save Vessel
  // remarks, regardless of what the UI shows. `defect:update` alone can't
  // tell the two apart since both Ship Officer and office roles hold it.
  const isShipboard = user.department === "SHIPBOARD";
  if (d.kind === "office" && isShipboard) return fail("Only office can update Office remarks");
  if (d.kind === "vessel" && !isShipboard) return fail("Only the vessel can update Vessel remarks");

  const defect = await prisma.defect.findFirst({
    where: { id: d.defectId, companyId: user.companyId, deletedAt: null },
  });
  if (!defect) return fail("Defect not found");

  const value = d.value || null;
  const data = d.kind === "office" ? { officeRemarks: value } : { vesselRemarks: value };
  await prisma.defect.update({
    where: { id: defect.id },
    data: { ...data, updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Defect",
    entityId: defect.id,
    summary: `${defect.refNo} ${d.kind} remarks updated`,
  });

  revalidatePath(`/defects/${defect.id}`);
  return OK;
}

export async function deleteDefectAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("defect:delete");
  const id = String(formData.get("defectId") ?? "");
  const defect = await prisma.defect.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!defect) return fail("Defect not found");

  await prisma.defect.update({
    where: { id: defect.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "Defect",
    entityId: defect.id,
    summary: `Deleted defect ${defect.refNo}`,
  });

  revalidatePath("/defects");
  redirect("/defects");
}
