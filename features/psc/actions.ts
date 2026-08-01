"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  createPscSchema,
  addDeficiencySchema,
  deficiencyRootCauseSchema,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PSC-${year}-`;
  const count = await prisma.pscInspection.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createPscAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("psc:create");
  const parsed = createPscSchema.safeParse({
    vesselId: formData.get("vesselId"),
    authority: formData.get("authority"),
    mouRegion: formData.get("mouRegion"),
    port: formData.get("port"),
    inspectionDate: formData.get("inspectionDate"),
    detained: formData.get("detained") ?? "",
    summary: formData.get("summary"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const insp = await prisma.pscInspection.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      vesselId: d.vesselId || null,
      authority: d.authority,
      mouRegion: d.mouRegion || null,
      port: d.port || null,
      inspectionDate: new Date(d.inspectionDate),
      detained: d.detained === "on",
      summary: d.summary || null,
      status: "OPEN",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "PscInspection",
    entityId: insp.id,
    summary: `Recorded PSC inspection ${insp.refNo}${insp.detained ? " (DETAINED)" : ""}`,
  });

  revalidatePath("/psc");
  redirect(`/psc/${insp.id}`);
}

export async function addDeficiencyAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("psc:update");
  const parsed = addDeficiencySchema.safeParse({
    inspectionId: formData.get("inspectionId"),
    natureCode: formData.get("natureCode"),
    reference: formData.get("reference"),
    actionCode: formData.get("actionCode"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const insp = await prisma.pscInspection.findFirst({
    where: { id: d.inspectionId, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  if (insp.status === "CLOSED") return fail("Inspection is closed");

  await prisma.pscDeficiency.create({
    data: {
      companyId: user.companyId,
      inspectionId: insp.id,
      natureCode: d.natureCode || null,
      reference: d.reference || null,
      actionCode: d.actionCode || null,
      description: d.description,
      createdBy: user.id,
    },
  });
  if (insp.status === "OPEN") {
    await prisma.pscInspection.update({
      where: { id: insp.id },
      data: { status: "IN_PROGRESS", updatedBy: user.id },
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "PscDeficiency",
    entityId: insp.id,
    summary: `Added deficiency to ${insp.refNo}`,
  });

  revalidatePath(`/psc/${insp.id}`);
  return OK;
}

export async function saveDeficiencyRootCauseAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("psc:update");
  const parsed = deficiencyRootCauseSchema.safeParse({
    deficiencyId: formData.get("deficiencyId"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    rootCause: formData.get("rootCause"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const def = await prisma.pscDeficiency.findFirst({
    where: { id: d.deficiencyId, companyId: user.companyId, deletedAt: null },
  });
  if (!def) return fail("Deficiency not found");

  await prisma.pscDeficiency.update({
    where: { id: def.id },
    data: {
      rootCauseCategory: d.rootCauseCategory,
      rootCauseSubCategory: d.rootCauseSubCategory,
      rootCause: d.rootCause || null,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "PscDeficiency",
    entityId: def.id,
    summary: `Recorded root cause for a deficiency on ${def.inspectionId}`,
  });

  revalidatePath(`/psc/${def.inspectionId}`);
  return OK;
}

export async function deleteDeficiencyAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("psc:update");
  const id = String(formData.get("deficiencyId") ?? "");
  const def = await prisma.pscDeficiency.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!def) return fail("Deficiency not found");
  await prisma.pscDeficiency.update({
    where: { id: def.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/psc/${def.inspectionId}`);
  return OK;
}

export async function closePscAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("psc:close");
  const id = String(formData.get("inspectionId") ?? "");
  const insp = await prisma.pscInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  if (insp.status === "CLOSED") return fail("Inspection is already closed");

  const deficiencies = await prisma.pscDeficiency.findMany({
    where: { inspectionId: insp.id, deletedAt: null },
    select: { id: true },
  });
  // A deficiency is only "rectified" once it has at least one CAPA row and
  // every one of them is Closed — a deficiency with no recorded corrective
  // action at all is still pending, not just one with open CAPA rows. A
  // deficiency raised into an NCR moves its CAPA rows under entityType
  // "NonConformity" (entityId = the NCR's id, not the deficiency's) — the
  // NCR becomes the single source of truth (see createNcrAction).
  let unresolvedCount = 0;
  for (const def of deficiencies) {
    const linkedNcr = await prisma.nonConformity.findFirst({
      where: { companyId: user.companyId, sourceEntityId: def.id, deletedAt: null },
      select: { id: true },
    });
    const capaWhere = linkedNcr
      ? { entityType: "NonConformity", entityId: linkedNcr.id }
      : { entityType: "PscDeficiency", entityId: def.id };
    const [total, open] = await Promise.all([
      prisma.capaAction.count({ where: { companyId: user.companyId, deletedAt: null, ...capaWhere } }),
      prisma.capaAction.count({ where: { companyId: user.companyId, deletedAt: null, status: { not: "CLOSED" }, ...capaWhere } }),
    ]);
    if (total === 0 || open > 0) unresolvedCount++;
  }
  if (unresolvedCount > 0) {
    return fail(
      `Close all CAPA items before closing the inspection (${unresolvedCount} deficienc${unresolvedCount === 1 ? "y" : "ies"} still pending).`,
    );
  }

  await prisma.pscInspection.update({
    where: { id: insp.id },
    data: { status: "CLOSED", closedAt: new Date(), updatedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "PscInspection",
    entityId: insp.id,
    summary: `Closed PSC inspection ${insp.refNo}`,
  });

  revalidatePath(`/psc/${insp.id}`);
  return OK;
}

export async function deletePscAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("psc:delete");
  const id = String(formData.get("inspectionId") ?? "");
  const insp = await prisma.pscInspection.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!insp) return fail("Inspection not found");
  await prisma.pscInspection.update({
    where: { id: insp.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "PscInspection",
    entityId: insp.id,
    summary: `Deleted PSC inspection ${insp.refNo}`,
  });
  revalidatePath("/psc");
  redirect("/psc");
}
