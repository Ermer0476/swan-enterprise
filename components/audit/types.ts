// Shared types + helpers for the Internal and External Audit modules, which
// have an identical structure. The two modules pass their own server actions
// into the shared client components below.

export type AuditActionResult = { ok: boolean; error: string | null };

export type AuditFindingCategory = "MAJOR_NC" | "MINOR_NC" | "OBSERVATION";

export type AuditFindingView = {
  id: string;
  category: AuditFindingCategory;
  reference: string | null;
  description: string;
  status: "OPEN" | "CLOSED";
};

// Context needed to build a "Raise NCR" prefill link from a finding —
// internal/external audits have no "port" equivalent, unlike PSC.
export type AuditNcrContext = {
  vesselId: string | null;
  reportRefNo: string;
  raisedAt: string; // yyyy-mm-dd
  source: "INTERNAL_AUDIT" | "EXTERNAL_AUDIT";
};

// A finding's own entity type ("InternalAuditFinding" / "ExternalAuditFinding")
// — used as the CAPA entityType when a finding has no linked NCR yet.
export type AuditFindingEntityType = "InternalAuditFinding" | "ExternalAuditFinding";

export type RootCauseValue = { category: string | null; subCategory: string | null };
export type CapaEntityRef = { entityType: string; entityId: string };

export const AUDIT_FINDING_CATEGORIES: AuditFindingCategory[] = [
  "MAJOR_NC",
  "MINOR_NC",
  "OBSERVATION",
];

export const AUDIT_STANDARDS = [
  "ISM Code",
  "ISO 9001",
  "ISO 14001",
  "ISO 45001",
  "MLC 2006",
  "TMSA",
  "ISPS Code",
  "Other",
] as const;

export function auditCategoryLabel(c: AuditFindingCategory): string {
  return c === "MAJOR_NC"
    ? "Major NC"
    : c === "MINOR_NC"
      ? "Minor NC"
      : "Observation";
}

export function auditCategoryTone(
  c: AuditFindingCategory,
): "danger" | "warning" | "accent" {
  return c === "MAJOR_NC" ? "danger" : c === "MINOR_NC" ? "warning" : "accent";
}
