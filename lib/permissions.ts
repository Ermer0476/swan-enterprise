// ─── Permission catalog ────────────────────────────────────────────────────
//  Permission keys follow the pattern "<module>:<action>". This catalog is the
//  single source of truth; the seed script inserts these into the Permission
//  table, and roles are granted subsets of them. Add a module's keys here when
//  you build the module.

export const PERMISSIONS = {
  // Platform administration
  "admin:manage-users": "Create, edit and deactivate users",
  "admin:manage-roles": "Create roles and assign permissions",
  "admin:manage-workflows": "Configure approval workflows",
  "admin:view-audit": "View the audit trail",

  // SMS Manual module
  "sms:read": "View SMS documents",
  "sms:create": "Create SMS documents and revisions",
  "sms:update": "Edit SMS documents and revisions",
  "sms:submit": "Submit an SMS revision for approval",
  "sms:approve": "Approve or reject SMS revisions",
  "sms:delete": "Archive/soft-delete SMS documents",

  // Incident Management module
  "incident:read": "View incidents",
  "incident:create": "Report incidents",
  "incident:update": "Investigate incidents and record CAPA",
  "incident:close": "Close investigated incidents",
  "incident:delete": "Delete incidents",

  // Near Miss module
  "nm:read": "View near misses",
  "nm:create": "Report near misses",
  "nm:update": "Review near misses and record actions",
  "nm:close": "Close near misses",
  "nm:delete": "Delete near misses",

  // Hazard Observation (HOR) module
  "hazard:read": "View hazard observations",
  "hazard:create": "Submit hazard observations",
  "hazard:update": "Action hazard observations",
  "hazard:close": "Close hazard observations",
  "hazard:delete": "Delete hazard observations",

  // Non-Conformity (NCR) module
  "ncr:read": "View non-conformities",
  "ncr:create": "Raise non-conformities",
  "ncr:update": "Record root cause and corrective action",
  "ncr:close": "Verify and close non-conformities",
  "ncr:delete": "Delete non-conformities",

  // SIRE Inspection module
  "sire:read": "View SIRE inspections",
  "sire:create": "Record SIRE inspections",
  "sire:update": "Manage SIRE observations and responses",
  "sire:close": "Close SIRE inspections",
  "sire:delete": "Delete SIRE inspections",

  // PSC Inspection module
  "psc:read": "View PSC inspections",
  "psc:create": "Record PSC inspections",
  "psc:update": "Manage PSC deficiencies and rectifications",
  "psc:close": "Close PSC inspections",
  "psc:delete": "Delete PSC inspections",

  // CDI Inspection module
  "cdi:read": "View CDI inspections",
  "cdi:create": "Record CDI inspections",
  "cdi:update": "Manage CDI observations and responses",
  "cdi:close": "Close CDI inspections",
  "cdi:delete": "Delete CDI inspections",

  // Internal Audit module
  "iaudit:read": "View internal audits",
  "iaudit:create": "Plan and record internal audits",
  "iaudit:update": "Manage internal audit findings",
  "iaudit:close": "Close internal audits",
  "iaudit:delete": "Delete internal audits",

  // External Audit module
  "eaudit:read": "View external audits",
  "eaudit:create": "Record external audits",
  "eaudit:update": "Manage external audit findings",
  "eaudit:close": "Close external audits",
  "eaudit:delete": "Delete external audits",

  // Vessel Master module — fleet particulars referenced by every safety module
  "vessel:read": "View vessel particulars",
  "vessel:create": "Add vessels to the fleet",
  "vessel:update": "Edit vessel particulars",
  "vessel:delete": "Remove vessels from the fleet",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

/** All permission keys as an array (used by the seed script). */
export const ALL_PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

/** Derive the module segment from a permission key. */
export function permissionModule(key: PermissionKey): string {
  return key.split(":")[0] ?? "";
}
