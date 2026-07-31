"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import type { IncidentStatus } from "@/lib/generated/prisma";
import {
  createIncidentSchema,
  investigationSchema,
  INCIDENT_STATUSES,
  INCIDENT_SUBCATEGORIES,
  INCIDENT_TYPE_LABELS,
  buildSofRows,
  positionsFor,
  type IncidentTypeValue,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

/** Next status in the investigation lifecycle, or null if already CLOSED. */
function nextStatus(current: IncidentStatus): IncidentStatus | null {
  const i = INCIDENT_STATUSES.indexOf(current);
  return (INCIDENT_STATUSES[i + 1] as IncidentStatus | undefined) ?? null;
}

/** Generate the next per-company reference number, e.g. INC-2026-0007. */
async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INC-${year}-`;
  const count = await prisma.incident.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
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
    if (!subCategory || !INCIDENT_SUBCATEGORIES[type].includes(subCategory)) {
      return fail(`Select the sub-category for ${INCIDENT_TYPE_LABELS[type]}`);
    }
    typeEntries.push({ type, subCategory });
  }

  const incident = await prisma.incident.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      title: d.title,
      reporterName: d.reporterName,
      reporterPosition: d.reporterPosition,
      status: "REPORTED",
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
    summary: `Reported incident ${incident.refNo} — ${incident.title}`,
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
