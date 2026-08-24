"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  addCrewEntrySchema,
  updateCrewEntrySchema,
  addInjuryCaseSchema,
  updateInjuryCaseSchema,
  updateKpiTargetsSchema,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

// A vessel that has left the fleet (sold — Vessel.archivedAt set) is
// read-only: its crew roster and injury cases are frozen as of the date it
// left, so no new entries can be logged against it.
async function assertNotArchived(companyId: string, vesselId: string): Promise<string | null> {
  const vessel = await prisma.vessel.findFirst({ where: { id: vesselId, companyId }, select: { archivedAt: true } });
  if (vessel?.archivedAt) return "This vessel is archived — exposure hours are read-only";
  return null;
}

async function guardVesselAccess(companyId: string, vesselId: string, userVesselId: string | null, isShipboard: boolean) {
  if (isShipboard && userVesselId !== vesselId) {
    return { vessel: null, error: "You can only manage exposure hours for your own vessel" };
  }
  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, companyId, deletedAt: null },
  });
  if (!vessel) return { vessel: null, error: "Vessel not found" };
  if (vessel.archivedAt) return { vessel: null, error: "This vessel is archived — exposure hours are read-only" };
  return { vessel, error: null };
}

// ─── Crew roster ────────────────────────────────────────────────────────────
// A crew-count change, effective from a given date — total exposure hours
// are derived from these entries, never entered directly. See
// computeHoursFromCrewEntries in schema.ts.
export async function addCrewEntryAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("exposure:create");
  const parsed = addCrewEntrySchema.safeParse({
    vesselId: formData.get("vesselId"),
    crew: formData.get("crew"),
    effectiveFrom: formData.get("effectiveFrom"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const { vessel, error } = await guardVesselAccess(
    user.companyId,
    d.vesselId,
    user.vesselId,
    user.department === "SHIPBOARD",
  );
  if (!vessel) return fail(error ?? "Vessel not found");

  const entry = await prisma.exposureCrewEntry.create({
    data: {
      companyId: user.companyId,
      vesselId: d.vesselId,
      crew: d.crew,
      effectiveFrom: new Date(d.effectiveFrom),
      enteredBy: user.department === "SHIPBOARD" ? "VESSEL" : "OFFICE",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "ExposureCrewEntry",
    entityId: entry.id,
    summary: `Logged crew count of ${d.crew} for ${vessel.name} effective ${d.effectiveFrom}`,
  });

  revalidatePath(`/exposure-hours/${d.vesselId}`);
  revalidatePath("/exposure-hours");
  return OK;
}

export async function updateCrewEntryAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("exposure:update");
  const parsed = updateCrewEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    crew: formData.get("crew"),
    effectiveFrom: formData.get("effectiveFrom"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const entry = await prisma.exposureCrewEntry.findFirst({
    where: { id: d.entryId, companyId: user.companyId, deletedAt: null },
  });
  if (!entry) return fail("Crew entry not found");
  if (user.department === "SHIPBOARD" && user.vesselId !== entry.vesselId) {
    return fail("You can only manage exposure hours for your own vessel");
  }
  const archivedError = await assertNotArchived(user.companyId, entry.vesselId);
  if (archivedError) return fail(archivedError);

  await prisma.exposureCrewEntry.update({
    where: { id: entry.id },
    data: { crew: d.crew, effectiveFrom: new Date(d.effectiveFrom), updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "ExposureCrewEntry",
    entityId: entry.id,
    summary: `Updated crew count entry to ${d.crew} effective ${d.effectiveFrom}`,
  });

  revalidatePath(`/exposure-hours/${entry.vesselId}`);
  revalidatePath("/exposure-hours");
  return OK;
}

export async function deleteCrewEntryAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("exposure:delete");
  const id = String(formData.get("entryId") ?? "");
  const entry = await prisma.exposureCrewEntry.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!entry) return fail("Crew entry not found");
  if (user.department === "SHIPBOARD" && user.vesselId !== entry.vesselId) {
    return fail("You can only manage exposure hours for your own vessel");
  }
  const archivedError = await assertNotArchived(user.companyId, entry.vesselId);
  if (archivedError) return fail(archivedError);

  await prisma.exposureCrewEntry.update({
    where: { id: entry.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "ExposureCrewEntry",
    entityId: entry.id,
    summary: `Deleted crew count entry (${entry.crew} effective ${entry.effectiveFrom.toISOString().slice(0, 10)})`,
  });

  revalidatePath(`/exposure-hours/${entry.vesselId}`);
  revalidatePath("/exposure-hours");
  return OK;
}

// ─── Injury cases ───────────────────────────────────────────────────────────
// Each case gets exactly one final classification — see the hierarchy note
// in schema.ts. There's no "edit the count" here; correcting a case means
// changing its single classification, which the tally then reflects.
export async function addInjuryCaseAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("exposure:update");
  const parsed = addInjuryCaseSchema.safeParse({
    vesselId: formData.get("vesselId"),
    classification: formData.get("classification"),
    description: formData.get("description"),
    occurredOn: formData.get("occurredOn"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const { vessel, error } = await guardVesselAccess(
    user.companyId,
    d.vesselId,
    user.vesselId,
    user.department === "SHIPBOARD",
  );
  if (!vessel) return fail(error ?? "Vessel not found");

  const injuryCase = await prisma.exposureInjuryCase.create({
    data: {
      companyId: user.companyId,
      vesselId: d.vesselId,
      classification: d.classification,
      description: d.description || null,
      occurredOn: new Date(d.occurredOn),
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "ExposureInjuryCase",
    entityId: injuryCase.id,
    summary: `Logged ${d.classification} injury case for ${vessel.name} on ${d.occurredOn}`,
  });

  revalidatePath(`/exposure-hours/${d.vesselId}`);
  revalidatePath("/exposure-hours");
  return OK;
}

export async function updateInjuryCaseAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("exposure:update");
  const parsed = updateInjuryCaseSchema.safeParse({
    caseId: formData.get("caseId"),
    classification: formData.get("classification"),
    description: formData.get("description"),
    occurredOn: formData.get("occurredOn"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const injuryCase = await prisma.exposureInjuryCase.findFirst({
    where: { id: d.caseId, companyId: user.companyId, deletedAt: null },
  });
  if (!injuryCase) return fail("Case not found");
  if (user.department === "SHIPBOARD" && user.vesselId !== injuryCase.vesselId) {
    return fail("You can only manage cases for your own vessel");
  }
  const archivedError = await assertNotArchived(user.companyId, injuryCase.vesselId);
  if (archivedError) return fail(archivedError);

  await prisma.exposureInjuryCase.update({
    where: { id: injuryCase.id },
    data: {
      classification: d.classification,
      description: d.description || null,
      occurredOn: new Date(d.occurredOn),
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "ExposureInjuryCase",
    entityId: injuryCase.id,
    summary: `Updated injury case classification to ${d.classification}`,
  });

  revalidatePath(`/exposure-hours/${injuryCase.vesselId}`);
  revalidatePath("/exposure-hours");
  return OK;
}

export async function deleteInjuryCaseAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("exposure:update");
  const id = String(formData.get("caseId") ?? "");
  const injuryCase = await prisma.exposureInjuryCase.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!injuryCase) return fail("Case not found");
  if (user.department === "SHIPBOARD" && user.vesselId !== injuryCase.vesselId) {
    return fail("You can only manage cases for your own vessel");
  }
  const archivedError = await assertNotArchived(user.companyId, injuryCase.vesselId);
  if (archivedError) return fail(archivedError);

  await prisma.exposureInjuryCase.update({
    where: { id: injuryCase.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "ExposureInjuryCase",
    entityId: injuryCase.id,
    summary: `Deleted ${injuryCase.classification} injury case (${injuryCase.occurredOn.toISOString().slice(0, 10)})`,
  });

  revalidatePath(`/exposure-hours/${injuryCase.vesselId}`);
  revalidatePath("/exposure-hours");
  return OK;
}

// ─── KPI dashboard targets ──────────────────────────────────────────────────
export async function updateKpiTargetsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("exposure:manage-targets");
  const parsed = updateKpiTargetsSchema.safeParse({
    ltifTarget: formData.get("ltifTarget"),
    trcfTarget: formData.get("trcfTarget"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  await prisma.company.update({
    where: { id: user.companyId },
    data: { ltifTarget: d.ltifTarget, trcfTarget: d.trcfTarget },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Company",
    entityId: user.companyId,
    summary: `Set Exposure Hours KPI targets to LTIF ≤ ${d.ltifTarget}, TRCF ≤ ${d.trcfTarget}`,
  });

  revalidatePath("/exposure-hours/kpi");
  revalidatePath("/settings/exposure-kpi");
  return OK;
}
