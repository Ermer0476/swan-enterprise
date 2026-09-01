"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import nodePath from "path";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { PermissionKey } from "@/lib/permissions";
import { saveAttachmentFile, deleteAttachmentFile } from "./storage";
import { ALLOWED_MIME_TYPES, MAX_ATTACHMENT_SIZE } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * Registry mapping an entityType to the permission that gates uploads/deletes
 * and the page to revalidate — same entity-agnostic pattern as the CAPA
 * tracker. Register a new module here when it adopts attachments.
 *
 * `permission` is usually a single key, but Near Miss genuinely has two
 * separate roles that may each edit the record at different lifecycle
 * stages (the vessel holds `nm:create`, not `nm:update`, while drafting/
 * reporting; the office holds `nm:update` while reviewing) — an array means
 * "any one of these", so the same registry entry covers both.
 */
const REGISTRY: Record<
  string,
  { permission: PermissionKey | PermissionKey[]; pagePath: (id: string) => string | Promise<string> }
> = {
  Incident: { permission: "incident:update", pagePath: (id) => `/incidents/${id}` },
  // A SIRE observation has no page of its own — it lives inside its parent
  // inspection — so the path has to be looked up rather than derived from
  // the entityId directly.
  SireObservation: {
    permission: "sire:update",
    pagePath: async (observationId) => {
      const obs = await prisma.sireObservation.findUnique({
        where: { id: observationId },
        select: { inspectionId: true },
      });
      return `/sire/${obs?.inspectionId ?? ""}`;
    },
  },
  NonConformity: { permission: "ncr:update", pagePath: (id) => `/non-conformities/${id}` },
  // The inspection/audit's own report document (e.g. the PSC report form,
  // the audit report itself) — distinct from PscDeficiency/*Finding below,
  // which are per-finding evidence. Both scopes coexist on the same page.
  PscInspection: { permission: "psc:update", pagePath: (id) => `/psc/${id}` },
  InternalAudit: { permission: "iaudit:update", pagePath: (id) => `/internal-audits/${id}` },
  ExternalAudit: { permission: "eaudit:update", pagePath: (id) => `/external-audits/${id}` },
  FlagInspection: { permission: "flaginsp:update", pagePath: (id) => `/flag-inspections/${id}` },
  PscDeficiency: {
    permission: "psc:update",
    pagePath: async (deficiencyId) => {
      const def = await prisma.pscDeficiency.findUnique({
        where: { id: deficiencyId },
        select: { inspectionId: true },
      });
      return `/psc/${def?.inspectionId ?? ""}`;
    },
  },
  InternalAuditFinding: {
    permission: "iaudit:update",
    pagePath: async (findingId) => {
      const finding = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
        select: { auditId: true },
      });
      return `/internal-audits/${finding?.auditId ?? ""}`;
    },
  },
  ExternalAuditFinding: {
    permission: "eaudit:update",
    pagePath: async (findingId) => {
      const finding = await prisma.externalAuditFinding.findUnique({
        where: { id: findingId },
        select: { auditId: true },
      });
      return `/external-audits/${finding?.auditId ?? ""}`;
    },
  },
  FlagInspectionFinding: {
    permission: "flaginsp:update",
    pagePath: async (findingId) => {
      const finding = await prisma.flagInspectionFinding.findUnique({
        where: { id: findingId },
        select: { auditId: true },
      });
      return `/flag-inspections/${finding?.auditId ?? ""}`;
    },
  },
  RiskAssessmentDocument: { permission: "risk-doc:update", pagePath: (id) => `/risk/${id}` },
  Defect: { permission: "defect:update", pagePath: (id) => `/defects/${id}` },
  NearMiss: { permission: ["nm:create", "nm:update"], pagePath: (id) => `/near-miss/${id}` },
  CommitteeMeeting: { permission: "meeting:update", pagePath: (id) => `/meetings/${id}` },
  EmergencyDrill: { permission: "drill:update", pagePath: (id) => `/drills/${id}` },
  CdiObservation: {
    permission: "cdi:update",
    pagePath: async (observationId) => {
      const obs = await prisma.cdiObservation.findUnique({
        where: { id: observationId },
        select: { inspectionId: true },
      });
      return `/cdi/${obs?.inspectionId ?? ""}`;
    },
  },
  CompanyInspectionObservation: {
    permission: "cinsp:update",
    pagePath: async (observationId) => {
      const obs = await prisma.companyInspectionObservation.findUnique({
        where: { id: observationId },
        select: { inspectionId: true },
      });
      return `/company-inspections/${obs?.inspectionId ?? ""}`;
    },
  },
  Circular: { permission: "circular:update", pagePath: (id) => `/circulars/${id}` },
  VesselDocument: {
    permission: "vesseldoc:update",
    pagePath: async (id) => {
      const doc = await prisma.vesselDocument.findUnique({
        where: { id },
        select: { vesselId: true },
      });
      return doc?.vesselId ? "/documents/vessel" : "/documents/company";
    },
  },
  // A superseded/old version of a VesselDocument's certificate — a second,
  // separate attachment slot on the same record (entityId), not a revision
  // history of the "VesselDocument" slot above.
  VesselDocumentArchive: {
    permission: "vesseldoc:update",
    pagePath: async (id) => {
      const doc = await prisma.vesselDocument.findUnique({
        where: { id },
        select: { vesselId: true },
      });
      return doc?.vesselId ? "/documents/vessel" : "/documents/company";
    },
  },
};

function registryFor(entityType: string) {
  const entry = REGISTRY[entityType];
  if (!entry) {
    throw new Error(`Attachments are not registered for entityType "${entityType}"`);
  }
  return entry;
}

function hasAny(user: { permissions: Set<PermissionKey> }, permission: PermissionKey | PermissionKey[]): boolean {
  return Array.isArray(permission)
    ? permission.some((p) => user.permissions.has(p))
    : user.permissions.has(permission);
}

export async function uploadAttachmentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const entityType = String(formData.get("entityType") ?? "");
  const entityId = String(formData.get("entityId") ?? "");
  const { permission, pagePath } = registryFor(entityType);
  const user = Array.isArray(permission)
    ? await requireUser()
    : await requirePermission(permission);
  if (!hasAny(user, permission)) {
    throw new Error("FORBIDDEN");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Choose a file to upload");
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return fail(`File is too large (max ${Math.round(MAX_ATTACHMENT_SIZE / (1024 * 1024))}MB)`);
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return fail("File type is not supported");
  }
  // Certificate registers scan/file PDFs only — a Word/Excel/zip here can't
  // be previewed inline like the rest of the register expects.
  if ((entityType === "VesselDocument" || entityType === "VesselDocumentArchive") && file.type !== "application/pdf") {
    return fail("Only PDF files are allowed for certificate attachments");
  }

  // A VesselDocument's "current" slot holds exactly one file — uploading a
  // replacement pushes whatever was there into the Archived slot instead of
  // just piling up, so the register's Attachment column always shows the
  // live certificate and Archived accumulates the superseded ones.
  if (entityType === "VesselDocument") {
    await prisma.attachment.updateMany({
      where: { companyId: user.companyId, entityType: "VesselDocument", entityId, deletedAt: null },
      data: { entityType: "VesselDocumentArchive" },
    });
  }

  const ext = nodePath.extname(file.name).slice(0, 20);
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileKey = await saveAttachmentFile(user.companyId, entityType, entityId, storedName, buffer);

  const attachment = await prisma.attachment.create({
    data: {
      companyId: user.companyId,
      entityType,
      entityId,
      fileName: file.name,
      fileKey,
      mimeType: file.type,
      sizeBytes: file.size,
      createdBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPLOAD",
    entityType: "Attachment",
    entityId: attachment.id,
    summary: `Uploaded ${attachment.fileName} to ${entityType} ${entityId}`,
  });

  revalidatePath(await pagePath(entityId));
  return OK;
}

export async function deleteAttachmentAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const existing = await prisma.attachment.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!existing) return fail("Attachment not found");

  const { permission, pagePath } = registryFor(existing.entityType);
  if (!hasAny(user, permission)) {
    return fail("You don't have permission to delete this attachment");
  }

  await prisma.attachment.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });
  await deleteAttachmentFile(existing.fileKey);

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "Attachment",
    entityId: existing.id,
    summary: `Deleted attachment ${existing.fileName} from ${existing.entityType} ${existing.entityId}`,
  });

  revalidatePath(await pagePath(existing.entityId));
  return OK;
}
