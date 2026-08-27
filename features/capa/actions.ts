"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { requireUser, type SessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { PermissionKey } from "@/lib/permissions";
import { addCapaSchema, updateCapaSchema, CAPA_PREFIX } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * Registry mapping an entityType to the permission that gates edits and the
 * page to revalidate. The CAPA tracker is entity-agnostic (like Attachment /
 * Comment) — register a new module here when it adopts the tracker, no schema
 * change needed. `guard` is an optional extra check beyond the permission —
 * used when the permission alone is shared more broadly than who should
 * actually be editing (e.g. Near Miss's corrective actions are vessel-only,
 * but `nm:create` is also held by office roles).
 *
 * `respondPermission`/`vesselIdOf` are an optional, narrower access path:
 * a shipboard user who holds `respondPermission` (but not `permission`) may
 * update ONLY the `status`/`closedDate` of an EXISTING CAPA item on their own
 * vessel (resolved via `vesselIdOf`) — they can't add, delete, or edit the
 * action text/responsible/target date, which stay office-authored. Only the
 * "lives inside a parent inspection" entity types register this; Incident/
 * NearMiss/NonConformity keep their existing office-only (or Administrator-
 * only) editing policy unchanged.
 */
const REGISTRY: Record<
  string,
  {
    permission: PermissionKey;
    path: (id: string) => string | Promise<string>;
    guard?: (user: SessionUser) => boolean;
    respondPermission?: PermissionKey;
    vesselIdOf?: (id: string) => Promise<string | null>;
  }
> = {
  Incident: { permission: "incident:update", path: (id) => `/incidents/${id}` },
  // Corrective actions can only be edited/closed by the Administrator role —
  // other roles (including the vessel itself) hold `nm:create` too (to
  // report near misses) but shouldn't be able to edit CAPA.
  NearMiss: {
    permission: "nm:create",
    path: (id) => `/near-miss/${id}`,
    guard: (user) => user.roles.includes("Administrator"),
  },
  NonConformity: { permission: "ncr:update", path: (id) => `/non-conformities/${id}` },
  // A deficiency has no page of its own — it lives inside its parent PSC
  // inspection — so the path has to be looked up rather than derived from
  // the entityId directly.
  PscDeficiency: {
    permission: "psc:update",
    path: async (deficiencyId) => {
      const def = await prisma.pscDeficiency.findUnique({
        where: { id: deficiencyId },
        select: { inspectionId: true },
      });
      return `/psc/${def?.inspectionId ?? ""}`;
    },
    respondPermission: "capa:respond",
    vesselIdOf: async (deficiencyId) => {
      const def = await prisma.pscDeficiency.findUnique({
        where: { id: deficiencyId },
        select: { inspection: { select: { vesselId: true } } },
      });
      return def?.inspection.vesselId ?? null;
    },
  },
  // Same "lives inside its parent" shape as PscDeficiency, one per audit type.
  InternalAuditFinding: {
    permission: "iaudit:update",
    path: async (findingId) => {
      const f = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
        select: { auditId: true },
      });
      return `/internal-audits/${f?.auditId ?? ""}`;
    },
    respondPermission: "capa:respond",
    vesselIdOf: async (findingId) => {
      const f = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
        select: { audit: { select: { vesselId: true } } },
      });
      return f?.audit.vesselId ?? null;
    },
  },
  ExternalAuditFinding: {
    permission: "eaudit:update",
    path: async (findingId) => {
      const f = await prisma.externalAuditFinding.findUnique({
        where: { id: findingId },
        select: { auditId: true },
      });
      return `/external-audits/${f?.auditId ?? ""}`;
    },
    respondPermission: "capa:respond",
    vesselIdOf: async (findingId) => {
      const f = await prisma.externalAuditFinding.findUnique({
        where: { id: findingId },
        select: { audit: { select: { vesselId: true } } },
      });
      return f?.audit.vesselId ?? null;
    },
  },
  CompanyInspectionObservation: {
    permission: "cinsp:update",
    path: async (observationId) => {
      const o = await prisma.companyInspectionObservation.findUnique({
        where: { id: observationId },
        select: { inspectionId: true },
      });
      return `/company-inspections/${o?.inspectionId ?? ""}`;
    },
    respondPermission: "capa:respond",
    vesselIdOf: async (observationId) => {
      const o = await prisma.companyInspectionObservation.findUnique({
        where: { id: observationId },
        select: { inspection: { select: { vesselId: true } } },
      });
      return o?.inspection.vesselId ?? null;
    },
  },
};

function registryFor(entityType: string) {
  const entry = REGISTRY[entityType];
  if (!entry) {
    throw new Error(`CAPA tracker is not registered for entityType "${entityType}"`);
  }
  return entry;
}

export async function addCapaAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const entityType = String(formData.get("entityType") ?? "");
  // Validate against the known registry keys first — registryFor throws a raw
  // Error for an unknown type, which (running before requirePermission and the
  // schema parse) surfaced as an uncaught 500 on bad input. Return a clean fail
  // instead; the known-type flow below is unchanged.
  if (!(entityType in REGISTRY)) return fail("Invalid input");
  const { permission, path, guard } = registryFor(entityType);
  const user = await requirePermission(permission);
  if (guard && !guard(user)) {
    return fail("You don't have permission to edit this CAPA item");
  }

  const parsed = addCapaSchema.safeParse({
    entityType,
    entityId: formData.get("entityId"),
    kind: formData.get("kind"),
    action: formData.get("action"),
    // Quick-add only asks for Action; Responsible/Target Date are set later
    // via the row's inline edit, so these fields may be absent from the form.
    responsible: formData.get("responsible") || undefined,
    targetDate: formData.get("targetDate") || undefined,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  // Numbered per (entity, kind): CA-01, CA-02, … / PA-01, PA-02, …
  const count = await prisma.capaAction.count({
    where: {
      companyId: user.companyId,
      entityType: d.entityType,
      entityId: d.entityId,
      kind: d.kind,
    },
  });
  const code = `${CAPA_PREFIX[d.kind]}-${String(count + 1).padStart(2, "0")}`;

  const row = await prisma.capaAction.create({
    data: {
      companyId: user.companyId,
      entityType: d.entityType,
      entityId: d.entityId,
      kind: d.kind,
      code,
      action: d.action,
      responsible: d.responsible || null,
      targetDate: d.targetDate ? new Date(d.targetDate) : null,
      status: "OPEN",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "CapaAction",
    entityId: row.id,
    summary: `Added ${row.code} to ${d.entityType} ${d.entityId}`,
  });

  revalidatePath(await path(d.entityId));
  return OK;
}

export async function updateCapaAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const existing = await prisma.capaAction.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!existing) return fail("CAPA item not found");

  const { permission, path, guard, respondPermission, vesselIdOf } = registryFor(existing.entityType);
  const hasFullAccess = user.permissions.has(permission) && (!guard || guard(user));

  // Narrower path: the vessel can mark an item done/not done on its own
  // vessel's inspection, without the full edit permission. Checked only when
  // full access is absent, since full access is always allowed to do
  // everything respond access can.
  let hasRespondAccess = false;
  if (!hasFullAccess && respondPermission && vesselIdOf && user.permissions.has(respondPermission)) {
    const entityVesselId = await vesselIdOf(existing.entityId);
    hasRespondAccess = entityVesselId !== null && entityVesselId === user.vesselId;
  }

  if (!hasFullAccess && !hasRespondAccess) {
    return fail("You don't have permission to edit this CAPA item");
  }

  const parsed = updateCapaSchema.safeParse({
    id,
    action: formData.get("action"),
    responsible: formData.get("responsible"),
    targetDate: formData.get("targetDate"),
    status: formData.get("status"),
    closedDate: formData.get("closedDate"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  // Respond-only access may change status/closedDate alone — action text,
  // responsible, and target date stay whatever office last set them to,
  // regardless of what the request body carries.
  await prisma.capaAction.update({
    where: { id: existing.id },
    data: hasFullAccess
      ? {
          action: d.action,
          responsible: d.responsible || null,
          targetDate: d.targetDate ? new Date(d.targetDate) : null,
          status: d.status,
          closedDate: d.closedDate ? new Date(d.closedDate) : null,
          updatedBy: user.id,
        }
      : {
          status: d.status,
          closedDate: d.closedDate ? new Date(d.closedDate) : null,
          updatedBy: user.id,
        },
  });

  revalidatePath(await path(existing.entityId));
  return OK;
}

export async function deleteCapaAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const existing = await prisma.capaAction.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!existing) return fail("CAPA item not found");

  const { permission, path, guard } = registryFor(existing.entityType);
  if (!user.permissions.has(permission) || (guard && !guard(user))) {
    return fail("You don't have permission to delete this CAPA item");
  }

  await prisma.capaAction.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "CapaAction",
    entityId: existing.id,
    summary: `Removed ${existing.code} from ${existing.entityType} ${existing.entityId}`,
  });

  revalidatePath(await path(existing.entityId));
  return OK;
}
