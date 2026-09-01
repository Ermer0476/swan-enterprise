"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { createVesselDocumentSchema, updateVesselDocumentSchema, cloneVesselDocumentsSchema } from "./schema";

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

// Copies every distinct (type, name) pair from one vessel's document
// register onto another vessel — or, when no target is given, onto every
// other ACTIVE vessel — as blank entries (no Ref/Issuing Body/Cert No./
// dates, since those are specific to the vessel's own real certificate).
// Skips pairs the target already has, so it's safe to re-run (e.g. after
// the source vessel's register grows, or a new vessel is added later).
export async function cloneVesselDocumentsAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("vesseldoc:create");
  const parsed = cloneVesselDocumentsSchema.safeParse({
    sourceVesselId: formData.get("sourceVesselId"),
    targetVesselId: formData.get("targetVesselId"),
  });
  if (!parsed.success) return fail("Invalid input");
  const d = parsed.data;

  const sourceVessel = await prisma.vessel.findFirst({
    where: { id: d.sourceVesselId, companyId: user.companyId, deletedAt: null },
  });
  if (!sourceVessel) return fail("Source vessel not found");

  const sourceDocs = await prisma.vesselDocument.findMany({
    where: { companyId: user.companyId, vesselId: d.sourceVesselId, deletedAt: null },
    select: { type: true, name: true },
    distinct: ["type", "name"],
  });
  if (sourceDocs.length === 0) return fail("Source vessel has no documents to copy");

  const targetVessels = d.targetVesselId
    ? await prisma.vessel.findMany({ where: { id: d.targetVesselId, companyId: user.companyId, deletedAt: null } })
    : await prisma.vessel.findMany({
        where: { companyId: user.companyId, deletedAt: null, status: "ACTIVE", id: { not: d.sourceVesselId } },
      });
  if (targetVessels.length === 0) return fail("No target vessel(s) found");

  let created = 0;
  for (const vessel of targetVessels) {
    const existing = await prisma.vesselDocument.findMany({
      where: { companyId: user.companyId, vesselId: vessel.id, deletedAt: null },
      select: { type: true, name: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.type.toLowerCase()}|||${e.name.toLowerCase()}`));
    const toCreate = sourceDocs.filter((s) => !existingKeys.has(`${s.type.toLowerCase()}|||${s.name.toLowerCase()}`));
    if (toCreate.length === 0) continue;
    await prisma.vesselDocument.createMany({
      data: toCreate.map((s) => ({
        companyId: user.companyId,
        vesselId: vessel.id,
        type: s.type,
        name: s.name,
        createdBy: user.id,
        updatedBy: user.id,
      })),
    });
    created += toCreate.length;
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "VesselDocument",
    entityId: sourceVessel.id,
    summary: `Copied ${created} document entries from ${sourceVessel.name} to ${targetVessels.length} vessel(s)`,
  });

  revalidatePath("/documents/vessel");
  return OK;
}
