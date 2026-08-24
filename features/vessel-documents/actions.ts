"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { createVesselDocumentSchema, updateVesselDocumentSchema } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

function parseForm(formData: FormData) {
  return {
    vesselId: formData.get("vesselId"),
    type: formData.get("type"),
    refNo: formData.get("refNo"),
    name: formData.get("name"),
    issuingBody: formData.get("issuingBody"),
    certNo: formData.get("certNo"),
    interval: formData.get("interval"),
    issuedDate: formData.get("issuedDate"),
    expiredDate: formData.get("expiredDate"),
    remarks: formData.get("remarks"),
  };
}

export async function createVesselDocumentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("vesseldoc:create");
  const parsed = createVesselDocumentSchema.safeParse(parseForm(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  if (d.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: d.vesselId, companyId: user.companyId },
    });
    if (!vessel) return fail("Vessel not found");
  }

  const doc = await prisma.vesselDocument.create({
    data: {
      companyId: user.companyId,
      vesselId: d.vesselId || null,
      type: d.type,
      refNo: d.refNo || null,
      name: d.name,
      issuingBody: d.issuingBody || null,
      certNo: d.certNo || null,
      interval: d.interval || null,
      issuedDate: d.issuedDate ? new Date(d.issuedDate) : null,
      expiredDate: d.expiredDate ? new Date(d.expiredDate) : null,
      remarks: d.remarks || null,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "VesselDocument",
    entityId: doc.id,
    summary: `Added ${doc.vesselId ? "vessel" : "company"} document — ${doc.name}`,
  });

  const listPath = d.vesselId
    ? `/documents/vessel?vesselId=${d.vesselId}`
    : "/documents/company";
  revalidatePath(listPath);
  redirect(listPath);
}

export async function updateVesselDocumentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("vesseldoc:update");
  const parsed = updateVesselDocumentSchema.safeParse({
    id: formData.get("id"),
    ...parseForm(formData),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const existing = await prisma.vesselDocument.findFirst({
    where: { id: d.id, companyId: user.companyId, deletedAt: null },
  });
  if (!existing) return fail("Document not found");

  if (d.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: d.vesselId, companyId: user.companyId },
    });
    if (!vessel) return fail("Vessel not found");
  }

  await prisma.vesselDocument.update({
    where: { id: existing.id },
    data: {
      vesselId: d.vesselId || null,
      type: d.type,
      refNo: d.refNo || null,
      name: d.name,
      issuingBody: d.issuingBody || null,
      certNo: d.certNo || null,
      interval: d.interval || null,
      issuedDate: d.issuedDate ? new Date(d.issuedDate) : null,
      expiredDate: d.expiredDate ? new Date(d.expiredDate) : null,
      remarks: d.remarks || null,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "VesselDocument",
    entityId: existing.id,
    summary: `Updated ${existing.vesselId ? "vessel" : "company"} document — ${d.name}`,
  });

  const listPath = d.vesselId
    ? `/documents/vessel?vesselId=${d.vesselId}`
    : "/documents/company";
  revalidatePath(listPath);
  redirect(listPath);
}

export async function deleteVesselDocumentAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("vesseldoc:delete");
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.vesselDocument.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!existing) return fail("Document not found");

  await prisma.vesselDocument.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "VesselDocument",
    entityId: existing.id,
    summary: `Deleted document — ${existing.name}`,
  });

  const listPath = existing.vesselId
    ? `/documents/vessel?vesselId=${existing.vesselId}`
    : "/documents/company";
  revalidatePath(listPath);
  redirect(listPath);
}

// Administrator-only, same reasoning as schedule:manage — a fleet-wide
// setting, not something any office role should be able to change.
export async function setDocumentExpiryWarningMonthsAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("schedule:manage");
  const raw = String(formData.get("months") ?? "").trim();
  const months = Number(raw);
  if (!Number.isInteger(months) || months <= 0) {
    return fail("Enter a positive whole number of months");
  }

  await prisma.company.update({
    where: { id: user.companyId },
    data: { documentExpiryWarningMonths: months },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Company",
    entityId: user.companyId,
    summary: `Set document expiry warning to ${months} month(s)`,
  });

  revalidatePath("/documents/vessel");
  revalidatePath("/documents/company");
  return OK;
}
