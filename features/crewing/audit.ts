/**
 * What this module may and may not write into `AuditLog.metadata`.
 *
 * ── WHY THIS FILE EXISTS ──
 * `AuditLog` is never pruned, `redactSeafarerAction` (batch 5) does not touch
 * it, and QHSE Manager, DPA and General Manager can all read it through
 * `admin:view-audit`. So an ordinary before/after diff on this module's tables
 * is a SECOND, UNREDACTABLE COPY of the personal data — created by following
 * the house pattern exactly, with no code that looks wrong.
 * docs/plans/crewing.md §3.7.
 *
 * The list lives here rather than in lib/audit-diff.ts on the same reasoning
 * that file gives for `changedLabels`: these are column names of one module —
 * module vocabulary, not shared vocabulary.
 */

/**
 * Columns whose VALUES must never reach `AuditLog.metadata`. Passed as
 * `diffFields(existing, data, { exclude: CREW_AUDIT_EXCLUDE })`.
 *
 * The diff still records THAT each of these changed, by name and with no
 * values, so "somebody edited this man's date of birth on 3 March, and it was
 * Ana at the crewing desk" survives in full. What does not survive is the old
 * date and the new one.
 *
 * Every column here is Sensitive-class under §3.1 and is exactly the set
 * `SEAFARER_RESTRICTED_SELECT` adds over `SEAFARER_OPERATIONAL_SELECT`
 * (queries.ts) minus `redactedAt`, which is a fact about the record rather
 * than a fact about the person. Adding a Sensitive column to `Seafarer`
 * without adding it here is the defect this file exists to prevent — the two
 * lists are meant to be read side by side.
 */
export const CREW_AUDIT_EXCLUDE: ReadonlySet<string> = new Set([
  "nationality",
  "dateOfBirth",
  "contactPhone",
  "contactEmail",
  "nextOfKinName",
  "nextOfKinRelationship",
  "nextOfKinPhone",
  // Assignment free text (batch 2+). Both columns carry a UI warning that they
  // are for operational notes only, and neither is on the ship's list — but a
  // warning is not a control, and "repatriated — hypertension" typed into one
  // of them must not be copied into a table nothing can redact.
  "vesselRemarks",
  "shoreRemarks",
]);

/**
 * Human labels for the fields this module diffs — including the excluded ones,
 * which is the point: `changedLabels` renders "Date of birth" for a withheld
 * change, so the audit summary reads "changed Rank, Date of birth" and the
 * metadata carries a value for the first and none for the second.
 */
export const CREW_DIFF_LABELS: Record<string, string> = {
  crewCode: "Crew code",
  lastName: "Surname",
  firstName: "First name",
  middleName: "Middle name",
  suffix: "Suffix",
  nationality: "Nationality",
  dateOfBirth: "Date of birth",
  contactPhone: "Contact phone",
  contactEmail: "Contact email",
  nextOfKinName: "Next of kin",
  nextOfKinRelationship: "Next of kin relationship",
  nextOfKinPhone: "Next of kin phone",
  active: "In the manning pool",
};
