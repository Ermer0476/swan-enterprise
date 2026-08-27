import { z } from "zod";
import { isValidDate, isNotFuture } from "@/features/shared/date-rules";
import { SHIP_POSITIONS } from "@/lib/crew-ranks";
import { CREW_ID_RE, CREW_ID_FORMAT_MESSAGE } from "./crew-id";

/**
 * Crewing — the seafarer register. docs/plans/crewing.md §12.2.
 *
 * ── WHAT IS NOT HERE, AND WHY ──
 * No wages, allotment or remittance. No SSS / Pag-IBIG / PhilHealth / TIN. No
 * medical detail. No marital status, religion or gender. No home address. And
 * NO FREE-TEXT `remarks` FIELD ON A SEAFARER — §3.2: an unstructured note on a
 * person record is where undeclared sensitive data ends up ("repatriated —
 * hypertension"), which reclassifies the whole table with no schema change and
 * no review. Operational notes belong on the assignment.
 *
 * The cheapest data-protection control available to this module is not
 * collecting the data. Adding a field here is a classification decision, not a
 * UI convenience: state it in §3.1 first.
 */

/** Blank optional text field — "" and absent both mean "not given". */
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

/**
 * ── THE CREW ID, ON THE TWO FORMS ──
 *
 * The crew ID is MANDATORY on the register — every seafarer ends up with one —
 * but "mandatory" is satisfied by AUTO-ISSUE, not by forcing the clerk to type
 * a value. So a blank crewCode on the CREATE form is legitimate and means
 * "assign the next 2026-#####"; createSeafarerAction mints it inside the
 * create transaction (see mintCrewId). What is NOT legitimate is a MALFORMED
 * manual value: if the clerk types something, it must be a real `YYYY-99999`.
 * That is the only rule the schema can enforce without the database — the
 * mandatory-ness lives in the action, where the mint happens.
 */
const createCrewCodeField = z
  .string()
  .trim()
  .max(40)
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || CREW_ID_RE.test(v), CREW_ID_FORMAT_MESSAGE);

/**
 * The EDIT form tolerates a legacy value. Before this module minted crew IDs,
 * crewCode was free text ("the manning agent's own number"), so the register
 * holds stored values that predate the `YYYY-99999` shape. Re-saving such a man
 * — even editing only his surname — must not be refused because his old crew
 * code doesn't match today's format. The schema therefore only bounds the
 * length here; updateSeafarerAction enforces the format on a CHANGED, non-empty
 * value, exactly the retired-but-owned tolerance features/users applies to
 * employeeId (an existing value survives; a newly typed one must be well
 * formed). The DB comparison the "changed" test needs can only happen in the
 * action, which is the one place that holds the stored row.
 */
const legacyCrewCodeField = optionalText(40);

const seafarerFields = {
  // Four name columns, not one. Philippine names are surname-first on every
  // official document, the middle name is the mother's maiden surname and is
  // load-bearing for identification, and the suffix distinguishes father from
  // son — who do sail for the same company.
  lastName: z.string().trim().min(1, "Surname is required").max(100),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  middleName: optionalText(100),
  suffix: optionalText(20),

  // ── SENSITIVE from here down (§3.1) ──
  nationality: optionalText(60),
  dateOfBirth: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidDate(v), "Invalid date")
    // A date of birth in the future is always a typo. There is deliberately no
    // minimum-age rule: the MLC one is real, but enforcing an age the register
    // has no other use for would turn a data-entry guard into a compliance
    // claim this module cannot stand behind.
    .refine((v) => !v || isNotFuture(v), "Date of birth can't be in the future"),
  contactPhone: optionalText(40),
  contactEmail: z
    .string()
    .trim()
    .max(200)
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),

  // The next of kin is a SEPARATE DATA SUBJECT who never dealt with this
  // company (§3.6). Emergency use only, and never on a ship's crew list.
  nextOfKinName: optionalText(150),
  nextOfKinRelationship: optionalText(60),
  nextOfKinPhone: optionalText(40),
};

/**
 * ── THE FIRST ASSIGNMENT, AND WHY IT LIVES ON THE CREATE FORM ──
 *
 * The register's answer to "which ship is he on" is a `CrewAssignment`, never a
 * column on `Seafarer` (§5.1, and the schema comment on the model). But a man
 * is almost always registered *because* he is joining a ship, and a register
 * that cannot say which one on the day he is entered is the complaint this
 * block answers: *"pag nag-create ng crew, nandoon na vessel name, vessel code
 * niya."*
 *
 * ── EVERY FIELD HERE IS OPTIONAL, AND THAT IS THE DESIGN ──
 * A man in the shore pool between contracts is a real and common state. Forcing
 * a vessel at creation would make the register unable to hold him, and the
 * alternative the schema forbids anyway — an assignment row with a null vessel
 * — does not exist: `CrewAssignment.vesselId` is required. No vessel chosen
 * means NO ASSIGNMENT ROW, not an empty one.
 *
 * What is not here: sign-off, ports, relief links and remarks. Those belong to
 * the assignment's own form (batch 2/3); this block records a join, and only a
 * join.
 */
const firstAssignmentFields = {
  // Blank = he is not joining a ship today. A uuid that is not a vessel of this
  // company is refused by resolveVesselForActor in the action — this only
  // decides the shape.
  vesselId: z.string().uuid("Choose a vessel from the list").optional().or(z.literal("")),

  // The app's ONE rank vocabulary (lib/crew-ranks.ts). The form shows
  // "Chief Engineer" and stores "C/Engr": z.enum is what makes the stored value
  // a code and not whatever the browser posted.
  rankCode: z.enum(SHIP_POSITIONS).optional().or(z.literal("")),

  // Required BY THE MODEL whenever an assignment exists (`plannedSignOnDate
  // DateTime`), which is why the requirement is expressed in the superRefine
  // below rather than here: on its own, this field is as optional as the block.
  // Deliberately NOT `isNotFuture` — a planned join is normally in the future,
  // which is the entire point of the planned/actual split.
  plannedSignOnDate: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidDate(v), "Invalid date"),

  // Only if he has already joined. Absent = PLANNED, present = ABOARD — the
  // discriminator features/crewing/status.ts derives everything from.
  actualSignOnDate: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidDate(v), "Invalid date")
    // A future "actual" is a contradiction: he has not joined yet, so that date
    // is the planned one. Rejecting it here keeps a man off a crew list he is
    // not on.
    .refine((v) => !v || isNotFuture(v), "He hasn't joined yet — put a future date in Planned sign-on"),
};

/**
 * The create form: the person, plus an optional first assignment.
 *
 * The superRefine exists for the PARTIALLY FILLED block — a rank and a date
 * typed with no vessel chosen. Ignoring those silently would drop what somebody
 * deliberately entered and leave the register saying he is in the pool; so the
 * form asks for the missing piece instead. All-blank is untouched and is the
 * shore-pool case.
 */
export const createSeafarerSchema = z
  .object({ crewCode: createCrewCodeField, ...seafarerFields, ...firstAssignmentFields })
  .superRefine((d, ctx) => {
    const started = Boolean(d.vesselId || d.rankCode || d.plannedSignOnDate || d.actualSignOnDate);
    if (!started) return;

    if (!d.vesselId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vesselId"],
        message: "Choose the vessel he is joining, or clear the rank and dates to leave him in the pool.",
      });
    }
    if (!d.rankCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rankCode"],
        message: "Choose the rank he signs on in.",
      });
    }
    if (!d.plannedSignOnDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["plannedSignOnDate"],
        message: "Enter the date he is planned to join.",
      });
    }
  });

/**
 * The edit form. `updatedAt` carries the optimistic lock — the value the form
 * was rendered with, compared against the row before the write so a second
 * editor gets STALE_RECORD_MESSAGE rather than silently overwriting the first.
 */
export const updateSeafarerSchema = z.object({
  seafarerId: z.string().uuid(),
  updatedAt: z.string().min(1),
  crewCode: legacyCrewCodeField,
  ...seafarerFields,
});

/**
 * `active` moves through its own action, not through the edit form: "no longer
 * in the manning pool" is a decision about a man's employment, not a checkbox
 * beside his middle name. It is also NOT a delete and NOT a redaction — three
 * states, three meanings (§3.5).
 */
export const deactivateSeafarerSchema = z.object({
  seafarerId: z.string().uuid(),
  active: z.enum(["true", "false"]),
  updatedAt: z.string().min(1),
});

export const deleteSeafarerSchema = z.object({
  seafarerId: z.string().uuid(),
});

/**
 * ── SIGN-OFF REASONS — CONSTRAINED ON PURPOSE (docs/plans/crewing.md §3.3) ──
 *
 * An app list, NOT a database enum: adding a value must never be a migration,
 * because the whole point is that the list can be argued about without a schema
 * change. `CrewAssignment.signOffReason` is a plain nullable String; this array
 * is the only thing that validates it.
 *
 * `MEDICAL_REPATRIATION` and `DISMISSAL` are DELIBERATELY ABSENT — the first is
 * health data, the second disciplinary data, and either RECLASSIFIES the column
 * and every list that renders it (§3.3, §15 Q3). Adding one here is a
 * data-classification decision with a permission consequence, not a new option.
 */
export const SIGN_OFF_REASONS = [
  "CONTRACT_COMPLETION",
  "RELIEF",
  "COMPANY_REQUEST",
  "TRANSFER",
  "OTHER",
] as const;
export type SignOffReason = (typeof SIGN_OFF_REASONS)[number];
export const SIGN_OFF_REASON_LABELS: Record<SignOffReason, string> = {
  CONTRACT_COMPLETION: "Contract completion",
  RELIEF: "Relief",
  COMPANY_REQUEST: "Company request",
  TRANSFER: "Transfer to another vessel",
  OTHER: "Other",
};

// ─── Crew-change schemas (B1): embark / disembark / transfer / planned relief ──
//
// Every cross-field issue passes an explicit `path` so failFromZod attributes
// it to an input rather than leaving it floating at the top of the form — the
// same rule createSeafarerSchema's superRefine follows.

/**
 * The optimistic-lock token every crew-change form carries — the row's
 * `updatedAt` at render time, compared against the database before the write,
 * exactly as updateSeafarerSchema does. STALE_RECORD_MESSAGE when it no longer
 * matches. It locks the CrewAssignment row for actions that load one
 * (sign-on-existing, sign-off, transfer) and the Seafarer row for the ones that
 * create against a man (plan, create-and-join).
 */
const updatedAtLock = z.string().min(1);

/** A REQUIRED calendar date that must ALREADY have happened — an "actual"
 *  sign-on or sign-off records a thing that occurred, so a future value is a
 *  typo (isNotFuture allows a one-day timezone tolerance; see date-rules.ts). */
const actualDate = (required: string) =>
  z
    .string()
    .trim()
    .min(1, required)
    .refine((v) => isValidDate(v), "Invalid date")
    .refine((v) => isNotFuture(v), "That date is in the future");

/** A REQUIRED planned date. Deliberately NOT isNotFuture — a planned join is
 *  normally ahead, which is the entire point of the planned/actual split. */
const plannedDate = (required: string) =>
  z
    .string()
    .trim()
    .min(1, required)
    .refine((v) => isValidDate(v), "Invalid date");

/** An OPTIONAL "actual" date — blank means "leave it planned". */
const optionalActualDate = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || isValidDate(v), "Invalid date")
  .refine((v) => !v || isNotFuture(v), "That date is in the future");

/** A nullable relief link / assignment id from a form — "" and absent both
 *  mean "not given". Resolved against the caller's boundary in the action; a
 *  uuid that is not one of his assignments is refused there, never trusted. */
const optionalAssignmentId = z.string().uuid().optional().or(z.literal(""));

const rankCodeField = z.enum(SHIP_POSITIONS);

/**
 * `planAssignmentAction` — file a PLANNED future assignment (a berth the desk
 * intends), optionally linked to the assignment it relieves. `actualSignOnDate`
 * is optional: present, it turns the plan into an immediate sign-on, and only
 * then does the action run the one-live-assignment check.
 */
export const planAssignmentSchema = z.object({
  seafarerId: z.string().uuid(),
  updatedAt: updatedAtLock,
  vesselId: z.string().uuid("Choose a vessel from the list"),
  rankCode: rankCodeField,
  plannedSignOnDate: plannedDate("Enter the planned sign-on date"),
  actualSignOnDate: optionalActualDate,
  signOnPort: optionalText(120),
  reliefForAssignmentId: optionalAssignmentId,
});

/**
 * `signOnAction` (embark) — TWO modes in one schema:
 *  - MODE A: activate an existing PLANNED row (`assignmentId` set). Nothing else
 *    beyond the sign-on date is required — the vessel and rank are already on it.
 *  - MODE B: create-and-join in one step (no `assignmentId`). Then the man, a
 *    vessel, a rank and a planned date are all required — the superRefine asks
 *    for whichever is missing.
 * Either way `actualSignOnDate` is required: a sign-on is, by definition, a join
 * that happened.
 */
export const signOnSchema = z
  .object({
    assignmentId: optionalAssignmentId,
    seafarerId: optionalAssignmentId,
    updatedAt: updatedAtLock,
    vesselId: z.string().uuid().optional().or(z.literal("")),
    rankCode: z.enum(SHIP_POSITIONS).optional().or(z.literal("")),
    plannedSignOnDate: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || isValidDate(v), "Invalid date"),
    actualSignOnDate: actualDate("Enter the date he signed on"),
    signOnPort: optionalText(120),
    reliefForAssignmentId: optionalAssignmentId,
  })
  .superRefine((d, ctx) => {
    if (d.assignmentId) return; // Mode A — the row carries the rest.
    // Mode B — create-and-join needs the man and a full first berth.
    if (!d.seafarerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["seafarerId"], message: "Choose the seafarer." });
    }
    if (!d.vesselId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["vesselId"], message: "Choose the vessel he is joining." });
    }
    if (!d.rankCode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rankCode"], message: "Choose the rank he signs on in." });
    }
    if (!d.plannedSignOnDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["plannedSignOnDate"], message: "Enter the planned sign-on date." });
    }
  });

/**
 * `signOffAction` (disembark) — close an ABOARD row. The action refuses unless
 * the derived status is ABOARD and unless the sign-off falls on or after the
 * sign-on; those checks need the loaded row and live in the action, not here.
 */
export const signOffSchema = z.object({
  assignmentId: z.string().uuid(),
  updatedAt: updatedAtLock,
  actualSignOffDate: actualDate("Enter the date he signed off"),
  signOffPort: optionalText(120),
  signOffReason: z.enum(SIGN_OFF_REASONS),
});

/**
 * `transferAction` — disembark from one vessel and embark onto another in a
 * single transaction. Carries both halves: the sign-off of the current berth
 * (`fromAssignmentId` + its dates) and the sign-on of the new one.
 */
export const transferSchema = z.object({
  fromAssignmentId: z.string().uuid(),
  updatedAt: updatedAtLock,
  actualSignOffDate: actualDate("Enter the date he left the vessel"),
  signOffPort: optionalText(120),
  signOffReason: z.enum(SIGN_OFF_REASONS),
  vesselId: z.string().uuid("Choose the vessel he transfers to"),
  rankCode: rankCodeField,
  plannedSignOnDate: plannedDate("Enter the planned sign-on date for the new vessel"),
  actualSignOnDate: actualDate("Enter the date he joined the new vessel"),
  signOnPort: optionalText(120),
  reliefForAssignmentId: optionalAssignmentId,
});

/** The register's filters. */
export const SEAFARER_ACTIVE_FILTERS = ["ALL", "ACTIVE", "INACTIVE"] as const;
export type SeafarerActiveFilter = (typeof SEAFARER_ACTIVE_FILTERS)[number];
