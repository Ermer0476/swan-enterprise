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

  // Near Miss / Hazard Observation (HOR) module — merged: one report kind,
  // Near Miss or HOR, tagged via NearMiss.kind.
  "nm:read": "View near misses / hazard observations",
  "nm:create": "Report near misses / hazard observations",
  "nm:update": "Review near misses / hazard observations and record actions",
  "nm:close": "Close near misses / hazard observations",
  "nm:delete": "Delete near misses / hazard observations",

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
  "sire:manage-targets": "Set the Average Observations KPI dashboard target",

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
  // Narrower than cdi:update — lets the vessel mark its own observations'
  // response/status without granting the ability to add/edit/delete
  // observations themselves (office-authored).
  "cdi:respond": "Update response/status on your own vessel's CDI observations",

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

  // Company Inspection module
  "cinsp:read": "View company inspections",
  "cinsp:create": "Record company inspections",
  "cinsp:update": "Manage company inspection observations",
  "cinsp:close": "Close company inspections",
  "cinsp:delete": "Delete company inspections",
  "cinsp:manage-targets": "Set the Average Observations KPI dashboard target",

  // Narrower than {psc,iaudit,eaudit,cinsp}:update — lets the vessel mark an
  // existing corrective/preventive action's status/closed date on its own
  // vessel's PSC deficiencies / audit findings / company inspection
  // observations, without granting the ability to add, edit the action text
  // of, or delete CAPA items (office-authored, office-owned).
  "capa:respond": "Update status/closed date on your own vessel's corrective actions",

  // SIRE 2.0 Questionnaire (reference data) — versioned VIQ upload, used to
  // suggest chapter/question numbers on Company Inspection observations
  "sire-questionnaire:manage": "Upload and manage SIRE 2.0 Questionnaire versions",

  // Vessel Master module — fleet particulars referenced by every safety module
  "vessel:read": "View vessel particulars",
  "vessel:create": "Add vessels to the fleet",
  "vessel:update": "Edit vessel particulars",
  "vessel:delete": "Remove vessels from the fleet",

  // Committee Meetings module (ADM-04 / RC-013)
  "meeting:read": "View committee meetings",
  "meeting:create": "Record committee meetings",
  "meeting:update": "Edit committee meeting minutes and reply as shore",
  "meeting:close": "Close out a reported committee meeting once shore has commented",
  "meeting:delete": "Delete committee meetings",

  // Emergency Drills module — also gates Familiarization logging (CK-047(b)),
  // which shares the same audience/workflow rather than its own key set.
  "drill:read": "View emergency drills and familiarization records",
  "drill:create": "Record emergency drills and familiarization completions",
  "drill:update": "Edit drill records and observations",
  "drill:close": "Close emergency drills",
  "drill:delete": "Delete emergency drills and familiarization records",
  // Administrator-only (not granted to QHSE Manager / Marine Superintendent
  // like the rest of drill:*) — the required interval is a fixed SMS
  // schedule fact shared by the whole fleet, so only the platform admin
  // changes it, never a vessel.
  "schedule:manage": "Edit the fleet-wide drill/familiarization frequency schedule",

  // Controlled Documents module
  "doc:read": "View controlled documents",
  "doc:create": "Add controlled documents",
  "doc:update": "Edit or approve controlled documents",
  "doc:delete": "Delete controlled documents",

  // Circulars module
  "circular:read": "View circulars",
  "circular:create": "Issue circulars",
  "circular:update": "Edit circulars",
  "circular:delete": "Delete circulars",

  // Risk Assessments module (controlled document library)
  "risk-doc:read": "View risk assessments",
  "risk-doc:create": "Create risk assessment documents",
  "risk-doc:update": "Edit draft revisions and submit for approval",
  "risk-doc:approve": "Approve or reject risk assessment revisions",
  "risk-doc:archive": "Archive risk assessment documents",
  "risk-doc:execute": "Execute an approved risk assessment against a job",
  "risk-doc:request-revision": "Submit a revision request for a risk assessment",

  // Defect List module
  "defect:read": "View equipment defects",
  "defect:create": "Report equipment defects",
  "defect:update": "Update defect status and rectification",
  "defect:delete": "Delete defect records",

  // Vessel Tracker (daily voyage log)
  "vtracker:read": "View the vessel voyage/performance tracker",
  "vtracker:create": "Add daily voyage log entries",
  "vtracker:update": "Edit voyage log entries",
  "vtracker:delete": "Delete voyage log entries",

  // Environment Records (monthly garbage/discharge reporting)
  "environment:read": "View environment (garbage/discharge) records",
  "environment:create": "Add monthly environment records",
  "environment:update": "Edit environment records",
  "environment:delete": "Delete environment records",
  "environment:manage-units": "Manage the controlled Unit Master (conversion factors) for environmental reporting",

  // TMSA Hub (office-only — never granted to Ship Officer/SHIPBOARD)
  "tmsa:read": "View the TMSA score matrix and audit CAP tracker",
  "tmsa:update-kpi": "Edit TMSA KPI compliance status and company response narrative",
  "tmsa:manage-cap": "Create, edit, and delete TMSA audit findings (CAP)",

  // Procurement (Stage A — Item Master, Opening Stock Take, Inventory, Requisitions)
  "procurement:read": "View procurement — catalogues, inventory, requisitions",
  "procurement:manage-catalogue": "Add/edit Stores and Spares catalogue items",
  "procurement:opening-stock-take": "Build and post a vessel's one-time opening stock take",
  "procurement:create": "Create/edit draft requisitions and log manual inventory issue/adjustment",
  "procurement:approve": "Approve a requisition as vessel Master (locks it, assigns the requisition number)",
  "procurement:office-review": "Cancel or revise requisition lines once a requisition reaches the office",
  "procurement:manage-thresholds": "Set procurement approval routing thresholds",

  // Vessel Documentation / Company Documents (certificate expiry register)
  "vesseldoc:read": "View vessel and company document/certificate registers",
  "vesseldoc:create": "Add certificates/documents to the register",
  "vesseldoc:update": "Edit certificate/document records and their attachments",
  "vesseldoc:delete": "Delete certificate/document records",

  // Exposure Hours module (monthly LTI/TRC safety statistics per vessel)
  "exposure:read": "View exposure hours records and fleet summary",
  "exposure:create": "Add monthly exposure hours records",
  "exposure:update": "Edit exposure hours records",
  "exposure:delete": "Delete exposure hours records",
  "exposure:manage-targets": "Set LTIF/TRCF KPI dashboard targets",

  // Reference Lists (office-editable option lists behind pickers)
  "reference:read": "View the office-editable reference lists",
  "reference:manage": "Add, edit, reorder and deactivate reference list options",

  // Operational settings (company-wide timing windows and defaults)
  "settings:manage-windows": "Set operational timing windows (overdue / due-soon days)",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

/** All permission keys as an array (used by the seed script). */
export const ALL_PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

/** Derive the module segment from a permission key. */
export function permissionModule(key: PermissionKey): string {
  return key.split(":")[0] ?? "";
}
