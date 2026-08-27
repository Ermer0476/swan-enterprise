"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { allocateRefNo } from "@/lib/ref-sequence";
import type { IncidentStatus } from "@/lib/generated/prisma";
import {
  createIncidentSchema,
  investigationSchema,
  INCIDENT_STATUSES,
  INCIDENT_TYPE_LABELS,
  buildSofRows,
  positionsFor,
  type IncidentTypeValue,
} from "./schema";
import { getReferenceListValues } from "@/lib/reference-list";
import { incidentSubcategoryKey } from "@/lib/reference-registry";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

/** Next status in the investigation lifecycle, or null if already CLOSED. */
function nextStatus(current: IncidentStatus): IncidentStatus | null {
  const i = INCIDENT_STATUSES.indexOf(current);
  return (INCIDENT_STATUSES[i + 1] as IncidentStatus | undefined) ?? null;
}

/** Generate the next reference number, e.g. INC-2026-0007 for a
 * shore-originated report, or SWA-INC-2026-0003 once a vessel is named —
 * so two ships' Nth incident of the year never look alike. */
async function nextRefNo(companyId: string, vesselCode: string | null): Promise<string> {
  const year = new Date().getFullYear();
  return allocateRefNo(companyId, vesselCode ? `${vesselCode}-INC-${year}` : `INC-${year}`);
}

export async function createIncidentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("incident:create");
  const parsed = createIncidentSchema.safeParse({
    title: formData.get("title"),
    reporterName: formData.get("reporterName"),
    reporterPosition: formData.get("reporterPosition"),
    types: formData.getAll("types").map(String),
    vesselId: formData.get("vesselId"),
    occurredAt: formData.get("occurredAt"),
    location: formData.get("location"),
    description: formData.get("description"),
    sofTime: formData.getAll("sofTime").map(String),
    sofEvent: formData.getAll("sofEvent").map(String),
    immediateAction: formData.get("immediateAction"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  // Position options are department-scoped (ship ranks vs office positions —
  // never mixed); re-check server-side since the client list is just the UI.
  if (!positionsFor(user.department).includes(d.reporterPosition)) {
    return fail("Select a valid position for your department");
  }

  // Each selected Type has its own sub-category list — parsed here from
  // `sub_<TYPE>` form fields rather than a single static Zod field, since the
  // allowed values differ per type.
  const typeEntries: { type: IncidentTypeValue; subCategory: string }[] = [];
  for (const t of d.types) {
    const type = t as IncidentTypeValue;
    const subCategory = String(formData.get(`sub_${type}`) ?? "").trim();
    const allowed = await getReferenceListValues(user.companyId, incidentSubcategoryKey(type));
    if (!subCategory || !allowed.has(subCategory)) {
      return fail(`Select the sub-category for ${INCIDENT_TYPE_LABELS[type]}`);
    }
    typeEntries.push({ type, subCategory });
  }

  // "Save as Draft" is available to anyone who can create an incident —
  // shipboard AND office (own drafts stay visible to their creator, see
  // queries.ts).
  const status: IncidentStatus = formData.get("intent") === "draft" ? "DRAFT" : "REPORTED";

  let vesselCode: string | null = null;
  if (d.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: d.vesselId, companyId: user.companyId },
      select: { code: true },
    });
    if (!vessel) return fail("Vessel not found");
    vesselCode = vessel.code;
  }

  const incident = await prisma.incident.create({
    data: {
      companyId: user.companyId,
      // A draft hasn't been reported yet, so it doesn't burn a ref number —
      // one is assigned only when reportDraftIncidentAction moves it to
      // REPORTED (or immediately below, for a non-draft submission).
      refNo: status === "REPORTED" ? await nextRefNo(user.companyId, vesselCode) : null,
      title: d.title,
      reporterName: d.reporterName,
      reporterPosition: d.reporterPosition,
      status,
      vesselId: d.vesselId || null,
      occurredAt: new Date(d.occurredAt),
      location: d.location || null,
      description: d.description,
      immediateAction: d.immediateAction || null,
      typeEntries: {
        create: typeEntries.map((e, i) => ({
          type: e.type,
          subCategory: e.subCategory,
          order: i,
        })),
      },
      // Severity / root cause / human factors are unset at report time — the
      // office fills these in during investigation via saveInvestigationAction.
      reportedById: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  const sofRows = buildSofRows(d.sofTime, d.sofEvent);
  if (sofRows.length > 0) {
    await prisma.incidentSofEntry.createMany({
      data: sofRows.map((r, i) => ({
        incidentId: incident.id,
        time: r.time,
        event: r.event,
        order: i,
      })),
    });
  }

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "Incident",
    entityId: incident.id,
    summary:
      status === "REPORTED"
        ? `Reported incident ${incident.refNo} — ${incident.title}`
        : `Saved draft — ${incident.title}`,
  });

  revalidatePath("/incidents");
  redirect(`/incidents/${incident.id}`);
}

export async function saveInvestigationAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("incident:update");
  const parsed = investigationSchema.safeParse({
    incidentId: formData.get("incidentId"),
    investigationDetails: formData.get("investigationDetails"),
    severity: formData.get("severity"),
    rootCauseCategory: formData.get("rootCauseCategory"),
    rootCauseSubCategory: formData.get("rootCauseSubCategory"),
    rootCause: formData.get("rootCause"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const incident = await prisma.incident.findFirst({
    where: { id: d.incidentId, companyId: user.companyId, deletedAt: null },
  });
  if (!incident) return fail("Incident not found");
  if (incident.status === "CLOSED") return fail("Closed incidents are read-only");

  await prisma.incident.update({
    where: { id: incident.id },
    data: {
      investigationDetails: d.investigationDetails,
      severity: d.severity,
      rootCauseCategory: d.rootCauseCategory,
      rootCauseSubCategory: d.rootCauseSubCategory,
      rootCause: d.rootCause || null,
      // Recording findings moves a freshly reported incident into investigation.
      status: incident.status === "REPORTED" ? "UNDER_INVESTIGATION" : incident.status,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Incident",
    entityId: incident.id,
    summary: `Updated investigation for ${incident.refNo}`,
  });

  revalidatePath(`/incidents/${incident.id}`);
  return OK;
}

/** Advance the incident to the next lifecycle status. */
export async function advanceStatusAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("incident:update");
  const incidentId = String(formData.get("incidentId") ?? "");

  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, companyId: user.companyId, deletedAt: null },
  });
  if (!incident) return fail("Incident not found");
  // A draft never advances through this generic path — it has no refNo yet,
  // and this action doesn't assign one. Use reportDraftIncidentAction.
  if (incident.status === "DRAFT") return fail("Report this draft first");

  const next = nextStatus(incident.status);
  if (!next) return fail("Incident is already closed");

  // Closing requires the dedicated permission — that permission holder IS the
  // "Management verification" this SMS's workflow requires, so closing and
  // verifying are the same act (captured below, never a typed-in name).
  if (next === "CLOSED" && !user.permissions.has("incident:close")) {
    return fail("You don't have permission to close incidents");
  }
  if (next === "CLOSED" && !incident.rootCause) {
    return fail("Record a root cause before closing the incident");
  }

  // The date of verification is entered manually by whoever is closing —
  // the actual sign-off may have happened before today, so it's not just
  // stamped with the server clock like verifiedById/verifiedByName are.
  const verifiedAtInput = String(formData.get("verifiedAt") ?? "");
  if (next === "CLOSED") {
    if (!verifiedAtInput || Number.isNaN(Date.parse(verifiedAtInput))) {
      return fail("Enter the date Management verified this incident");
    }
  }

  if (next === "CLOSED") {
    const openCapaCount = await prisma.capaAction.count({
      where: {
        companyId: user.companyId,
        entityType: "Incident",
        entityId: incident.id,
        deletedAt: null,
        status: { not: "CLOSED" },
      },
    });
    if (openCapaCount > 0) {
      return fail(
        `Close all CAPA items before closing the incident (${openCapaCount} still open).`,
      );
    }
  }

  await prisma.incident.update({
    where: { id: incident.id },
    data: {
      status: next,
      closedAt: next === "CLOSED" ? new Date() : incident.closedAt,
      verifiedById: next === "CLOSED" ? user.id : incident.verifiedById,
      verifiedByName: next === "CLOSED" ? user.fullName : incident.verifiedByName,
      verifiedAt: next === "CLOSED" ? new Date(verifiedAtInput) : incident.verifiedAt,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: next === "CLOSED" ? "APPROVE" : "UPDATE",
    entityType: "Incident",
    entityId: incident.id,
    summary: `${incident.refNo} advanced to ${next}`,
  });

  revalidatePath(`/incidents/${incident.id}`);
  return OK;
}

export async function deleteIncidentAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("incident:delete");
  const incidentId = String(formData.get("incidentId") ?? "");

  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, companyId: user.companyId, deletedAt: null },
  });
  if (!incident) return fail("Incident not found");

  await prisma.incident.update({
    where: { id: incident.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "Incident",
    entityId: incident.id,
    summary: `Deleted incident ${incident.refNo}`,
  });

  revalidatePath("/incidents");
  redirect("/incidents");
}

/** Submits a Draft for office review — DRAFT → REPORTED. Any shipboard
 * user may report their vessel's draft; an office-raised draft can only be
 * reported by its creator. */
export async function reportDraftIncidentAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("incident:create");
  const id = String(formData.get("incidentId") ?? "");
  const incident = await prisma.incident.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!incident) return fail("Draft not found");
  if (user.department !== "SHIPBOARD" && incident.createdBy !== user.id) {
    return fail("Only the report's creator (or the vessel) can report this draft");
  }

  let vesselCode: string | null = null;
  if (incident.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: incident.vesselId, companyId: user.companyId },
      select: { code: true },
    });
    vesselCode = vessel?.code ?? null;
  }
  const refNo = await nextRefNo(user.companyId, vesselCode);

  await prisma.incident.update({
    where: { id: incident.id },
    data: { status: "REPORTED", refNo, updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Incident",
    entityId: incident.id,
    summary: `Reported incident ${refNo} to the office`,
  });

  revalidatePath(`/incidents/${incident.id}`);
  revalidatePath("/incidents");
  return OK;
}

/** Full edit of its own incident report — everything except status. Only
 * ever while status = DRAFT. Any shipboard user may edit their vessel's
 * draft; an office-raised draft can only be edited by its creator. */
export async function updateDraftIncidentAction(
  incidentId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("incident:create");
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!incident) return fail("Draft not found");
  if (user.department !== "SHIPBOARD" && incident.createdBy !== user.id) {
    return fail("Only the report's creator (or the vessel) can edit this draft");
  }

  const parsed = createIncidentSchema.safeParse({
    title: formData.get("title"),
    reporterName: formData.get("reporterName"),
    reporterPosition: formData.get("reporterPosition"),
    types: formData.getAll("types").map(String),
    vesselId: formData.get("vesselId"),
    occurredAt: formData.get("occurredAt"),
    location: formData.get("location"),
    description: formData.get("description"),
    sofTime: formData.getAll("sofTime").map(String),
    sofEvent: formData.getAll("sofEvent").map(String),
    immediateAction: formData.get("immediateAction"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  if (!positionsFor(user.department).includes(d.reporterPosition)) {
    return fail("Select a valid position for your department");
  }

  // Load the sub-category already persisted per type so re-saving a draft that
  // holds a value the office has since hidden never fails validation.
  const existingEntries = await prisma.incidentTypeEntry.findMany({
    where: { incidentId: incident.id },
    select: { type: true, subCategory: true },
  });
  const persistedByType = new Map(existingEntries.map((e) => [e.type, e.subCategory]));

  const typeEntries: { type: IncidentTypeValue; subCategory: string }[] = [];
  for (const t of d.types) {
    const type = t as IncidentTypeValue;
    const subCategory = String(formData.get(`sub_${type}`) ?? "").trim();
    const allowed = await getReferenceListValues(user.companyId, incidentSubcategoryKey(type));
    const persisted = persistedByType.get(type);
    if (!subCategory || (!allowed.has(subCategory) && subCategory !== persisted)) {
      return fail(`Select the sub-category for ${INCIDENT_TYPE_LABELS[type]}`);
    }
    typeEntries.push({ type, subCategory });
  }

  let vesselId = incident.vesselId; // vessel is locked once created — never resubmitted
  if (d.vesselId && d.vesselId !== incident.vesselId) {
    // Only reachable for an office-raised draft, where the vessel picker is
    // actually editable (see edit-draft-form.tsx).
    const vessel = await prisma.vessel.findFirst({
      where: { id: d.vesselId, companyId: user.companyId },
      select: { id: true },
    });
    if (!vessel) return fail("Vessel not found");
    vesselId = vessel.id;
  }

  const sofRows = buildSofRows(d.sofTime, d.sofEvent);

  await prisma.$transaction([
    prisma.incidentTypeEntry.deleteMany({ where: { incidentId: incident.id } }),
    prisma.incidentSofEntry.deleteMany({ where: { incidentId: incident.id } }),
    prisma.incident.update({
      where: { id: incident.id },
      data: {
        title: d.title,
        reporterName: d.reporterName,
        reporterPosition: d.reporterPosition,
        vesselId,
        occurredAt: new Date(d.occurredAt),
        location: d.location || null,
        description: d.description,
        immediateAction: d.immediateAction || null,
        updatedBy: user.id,
        typeEntries: {
          create: typeEntries.map((e, i) => ({ type: e.type, subCategory: e.subCategory, order: i })),
        },
        sofEntries: {
          create: sofRows.map((r, i) => ({ time: r.time, event: r.event, order: i })),
        },
      },
    }),
  ]);

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Incident",
    entityId: incident.id,
    summary: `Updated draft — ${d.title}`,
  });

  revalidatePath(`/incidents/${incident.id}`);
  return OK;
}

/** Deletes its own Draft — never a REPORTED/CLOSED record (use
 * deleteIncidentAction for those, office-only). Any shipboard user may
 * delete their vessel's draft; an office-raised draft can only be deleted
 * by its creator. */
export async function deleteDraftIncidentAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("incident:create");
  const id = String(formData.get("incidentId") ?? "");
  const incident = await prisma.incident.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!incident) return fail("Draft not found");
  if (user.department !== "SHIPBOARD" && incident.createdBy !== user.id) {
    return fail("Only the report's creator (or the vessel) can delete this draft");
  }

  await prisma.incident.update({
    where: { id: incident.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "Incident",
    entityId: incident.id,
    summary: `Deleted draft — ${incident.title}`,
  });

  revalidatePath("/incidents");
  redirect("/incidents");
}
