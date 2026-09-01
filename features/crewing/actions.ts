"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { requirePermission, can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { diffFields, changedLabels } from "@/lib/audit-diff";
import { rankLabel } from "@/lib/crew-ranks";
import { formatDate } from "@/lib/utils";
import { findSeafarerForOffice, findCrewAssignmentForActor } from "./visibility";
import { CREW_AUDIT_EXCLUDE, CREW_DIFF_LABELS } from "./audit";
import { crewAuditLabel, vesselLabel } from "./ui";
import { assignmentStatus } from "./status";
import { isCrewId, mintCrewId, CREW_ID_FORMAT_MESSAGE } from "./crew-id";
import {
  createSeafarerSchema,
  updateSeafarerSchema,
  deactivateSeafarerSchema,
  deleteSeafarerSchema,
  planAssignmentSchema,
  signOnSchema,
  signOffSchema,
  transferSchema,
  SIGN_OFF_REASON_LABELS,
} from "./schema";
import {
  failFromZod,
  STALE_RECORD_MESSAGE,
  type ActionResult,
} from "@/features/shared/action-result";

export type { ActionResult };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

const NOT_FOUND = "Seafarer not found";
const DUPLICATE_CREW_CODE = "Another seafarer in the register already has that crew code.";
const VESSEL_NOT_FOUND = "Vessel not found";

/**
 * A vessel was chosen by a caller who may add people but not put them on ships.
 * `crew:assign` is a separate key from `crew:create` on purpose — the form does
 * not render this block without it, so reaching this message means a hand-made
 * request, and it is answered plainly rather than thrown: the seafarer half of
 * the submission was perfectly legitimate.
 */
const NO_ASSIGN_PERMISSION =
  "Your role can add seafarers but not record assignments. Add him without a vessel, and ask the crewing desk to record the sign-on.";

/**
 * The office-only refusal for a shipboard caller. This is the SECOND of two
 * independent gates — the first is that the ship does not hold crew:* at all —
 * and it is inline here (rather than a shared throw) because Capt has no lib/
 * node: the seafarer register in its entirety is office-only (§5.1). Returned,
 * not thrown, so the form shows the reason.
 */
const OFFICE_ONLY = "The seafarer register is managed by the crewing office.";

type OwnedVessel = { id: string; name: string; code: string | null };

/**
 * Resolves a submitted vesselId against the caller's OWN company — the one
 * place a form's raw vessel uuid is checked before it is written. A vessel of
 * another company, a soft-deleted one, or a bogus uuid all come back null,
 * which the caller turns into VESSEL_NOT_FOUND; the RESOLVED row's id is what
 * gets stored, never the raw input.
 *
 * The office is the only caller of these actions (the inline department gate
 * runs first), so a plain company scope is the whole boundary — there is no
 * shipboard actor whose own vessel would need imposing.
 */
async function resolveVessel(
  companyId: string,
  vesselId: string,
): Promise<OwnedVessel | null> {
  return prisma.vessel.findFirst({
    where: { id: vesselId, companyId, deletedAt: null },
    select: { id: true, name: true, code: true },
  });
}

/**
 * "One live seafarer per crew code", enforced here and NOT as a `@@unique`.
 *
 * Postgres unique indexes ignore `deletedAt`, so a unique constraint would
 * refuse to re-register a man against a row nobody can see. Technically racy;
 * the worst outcome is a duplicate list row, not corruption, at a create rate
 * of one human click.
 */
async function crewCodeTaken(
  companyId: string,
  crewCode: string,
  exceptId?: string,
): Promise<boolean> {
  const clash = await prisma.seafarer.findFirst({
    where: {
      companyId,
      deletedAt: null,
      crewCode,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  return clash !== null;
}

/**
 * ── A MAN CANNOT BE ON TWO SHIPS ──
 *
 * A seafarer may hold at most ONE assignment with `actualSignOffDate: null` and
 * `deletedAt: null` (§6.2). There is no `@@unique` for it and there cannot be:
 * the discriminator is a null plus a soft-delete flag. So it is enforced here,
 * in the action.
 *
 * It THROWS rather than returning, and it takes the transaction client:
 *  - the check must be INSIDE the transaction, because a seafarer created in
 *    that same transaction does not exist outside it;
 *  - a `return { ok: false }` from inside a `$transaction` callback would
 *    COMMIT the seafarer it was refusing to give a ship. Throwing rolls the
 *    whole thing back.
 */
class LiveAssignmentError extends Error {}

async function assertNoLiveAssignment(
  tx: Prisma.TransactionClient,
  companyId: string,
  seafarerId: string,
  // The one row allowed to already be open: the PLANNED assignment signOnAction
  // is activating. `exceptId` narrows the invariant to "no OTHER open
  // assignment", which is what "cannot be on two ships" actually means here.
  exceptId?: string,
): Promise<void> {
  const live = await tx.crewAssignment.findFirst({
    where: {
      companyId,
      seafarerId,
      deletedAt: null,
      actualSignOffDate: null,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    // The vessel and the date, because a refusal that does not say WHICH ship
    // leaves the desk with nowhere to go. No seafarer columns.
    select: {
      actualSignOnDate: true,
      plannedSignOnDate: true,
      vessel: { select: { name: true, code: true } },
    },
    orderBy: { plannedSignOnDate: "desc" },
  });
  if (!live) return;

  throw new LiveAssignmentError(
    live.actualSignOnDate
      ? `Already signed on to ${vesselLabel(live.vessel)} since ${formatDate(live.actualSignOnDate)}.`
      : `Already assigned to ${vesselLabel(live.vessel)}, due to join on ${formatDate(live.plannedSignOnDate)}.`,
  );
}

export async function createSeafarerAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("crew:create");
  if (user.department === "SHIPBOARD") return fail(OFFICE_ONLY);

  const parsed = createSeafarerSchema.safeParse({
    crewCode: formData.get("crewCode") ?? undefined,
    lastName: formData.get("lastName"),
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName") ?? undefined,
    suffix: formData.get("suffix") ?? undefined,
    nationality: formData.get("nationality") ?? undefined,
    dateOfBirth: formData.get("dateOfBirth") ?? undefined,
    contactPhone: formData.get("contactPhone") ?? undefined,
    contactEmail: formData.get("contactEmail") ?? undefined,
    nextOfKinName: formData.get("nextOfKinName") ?? undefined,
    nextOfKinRelationship: formData.get("nextOfKinRelationship") ?? undefined,
    nextOfKinPhone: formData.get("nextOfKinPhone") ?? undefined,
    // The first assignment. Absent when the caller has no crew:assign — the
    // block is not rendered — and blank when the man is joining nothing today.
    vesselId: formData.get("vesselId") ?? undefined,
    rankCode: formData.get("rankCode") ?? undefined,
    plannedSignOnDate: formData.get("plannedSignOnDate") ?? undefined,
    actualSignOnDate: formData.get("actualSignOnDate") ?? undefined,
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;

  if (d.crewCode && (await crewCodeTaken(user.companyId, d.crewCode))) {
    return fail(DUPLICATE_CREW_CODE);
  }

  if (d.vesselId && !can(user, "crew:assign")) return fail(NO_ASSIGN_PERMISSION);

  let firstAssignment: {
    vesselId: string;
    vesselLabel: string;
    rankCode: string;
    plannedSignOnDate: Date;
    actualSignOnDate: Date | null;
  } | null = null;

  if (d.vesselId && d.rankCode && d.plannedSignOnDate) {
    const vessel = await resolveVessel(user.companyId, d.vesselId);
    if (!vessel) return fail(VESSEL_NOT_FOUND);
    firstAssignment = {
      vesselId: vessel.id,
      vesselLabel: vesselLabel(vessel),
      rankCode: d.rankCode,
      plannedSignOnDate: new Date(d.plannedSignOnDate),
      actualSignOnDate: d.actualSignOnDate ? new Date(d.actualSignOnDate) : null,
    };
  }

  /**
   * ── ONE TRANSACTION ──
   * A seafarer who exists without the assignment entered with him is the
   * half-entered state that makes a register untrustworthy. Both rows land or
   * neither does. The audit writes stay OUTSIDE, after the commit.
   */
  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      /**
       * ── THE CREW ID: AUTO-ISSUE OR MANUAL, BOTH INSIDE THE TRANSACTION ──
       * Blank → mint the next `YY-NNNN`. Typed → the value the clerk entered.
       * On the AUTO path the advisory lock MUST be the first statement: it
       * serialises concurrent auto-issues for this (company, year), the only
       * guard against two creates minting the same N+1 (crewCode has no unique
       * index). The manual path's guard is crewCodeTaken.
       */
      const issueYear = new Date().getUTCFullYear();
      let crewCode: string;
      if (d.crewCode) {
        crewCode = d.crewCode;
      } else {
        const lockKey = `${user.companyId}:crewId:${issueYear}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        crewCode = await mintCrewId(
          tx,
          user.companyId,
          issueYear,
          async (t, companyId, prefix) =>
            (
              await t.seafarer.findMany({
                where: { companyId, deletedAt: null, crewCode: { startsWith: prefix } },
                select: { crewCode: true },
              })
            ).map((s) => s.crewCode),
        );
      }

      const seafarer = await tx.seafarer.create({
        data: {
          companyId: user.companyId,
          crewCode,
          lastName: d.lastName,
          firstName: d.firstName,
          middleName: d.middleName || null,
          suffix: d.suffix || null,
          nationality: d.nationality || null,
          dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
          contactPhone: d.contactPhone || null,
          contactEmail: d.contactEmail || null,
          nextOfKinName: d.nextOfKinName || null,
          nextOfKinRelationship: d.nextOfKinRelationship || null,
          nextOfKinPhone: d.nextOfKinPhone || null,
          createdBy: user.id,
        },
        select: {
          id: true,
          lastName: true,
          firstName: true,
          middleName: true,
          suffix: true,
          crewCode: true,
        },
      });

      if (!firstAssignment) return { seafarer, assignmentId: null };

      await assertNoLiveAssignment(tx, user.companyId, seafarer.id);
      const assignment = await tx.crewAssignment.create({
        data: {
          companyId: user.companyId,
          seafarerId: seafarer.id,
          vesselId: firstAssignment.vesselId,
          rankCode: firstAssignment.rankCode,
          plannedSignOnDate: firstAssignment.plannedSignOnDate,
          actualSignOnDate: firstAssignment.actualSignOnDate,
          createdBy: user.id,
        },
        select: { id: true },
      });
      return { seafarer, assignmentId: assignment.id };
    });
  } catch (err) {
    if (err instanceof LiveAssignmentError) return fail(err.message);
    throw err;
  }

  // Name and crew code only. NO metadata: a CREATE diff would be a complete
  // copy of everything just typed in, date of birth and next of kin included.
  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "Seafarer",
    entityId: created.seafarer.id,
    summary: `Added seafarer ${crewAuditLabel(created.seafarer)} to the register`,
  });

  // A SECOND entry, against the assignment's own id and entityType, so "when
  // did this man go aboard" is answerable from the audit trail.
  if (created.assignmentId && firstAssignment) {
    const joined = firstAssignment.actualSignOnDate;
    await writeAudit({
      actor: user,
      action: "CREATE",
      entityType: "CrewAssignment",
      entityId: created.assignmentId,
      summary: joined
        ? `Signed on ${crewAuditLabel(created.seafarer)} to ${firstAssignment.vesselLabel} as ${rankLabel(firstAssignment.rankCode)} on ${formatDate(joined)}`
        : `Assigned ${crewAuditLabel(created.seafarer)} to ${firstAssignment.vesselLabel} as ${rankLabel(firstAssignment.rankCode)}, due to join ${formatDate(firstAssignment.plannedSignOnDate)}`,
    });
  }

  revalidatePath("/crewing/seafarers");
  if (created.assignmentId) revalidatePath("/crewing");
  redirect(`/crewing/seafarers/${created.seafarer.id}`);
}

export async function updateSeafarerAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("crew:update");
  if (user.department === "SHIPBOARD") return fail(OFFICE_ONLY);

  const parsed = updateSeafarerSchema.safeParse({
    seafarerId: formData.get("seafarerId"),
    updatedAt: formData.get("updatedAt"),
    crewCode: formData.get("crewCode") ?? undefined,
    lastName: formData.get("lastName"),
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName") ?? undefined,
    suffix: formData.get("suffix") ?? undefined,
    nationality: formData.get("nationality") ?? undefined,
    dateOfBirth: formData.get("dateOfBirth") ?? undefined,
    contactPhone: formData.get("contactPhone") ?? undefined,
    contactEmail: formData.get("contactEmail") ?? undefined,
    nextOfKinName: formData.get("nextOfKinName") ?? undefined,
    nextOfKinRelationship: formData.get("nextOfKinRelationship") ?? undefined,
    nextOfKinPhone: formData.get("nextOfKinPhone") ?? undefined,
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;

  const existing = await findSeafarerForOffice(user, d.seafarerId);
  if (!existing) return fail(NOT_FOUND);
  if (existing.updatedAt.toISOString() !== d.updatedAt) return fail(STALE_RECORD_MESSAGE);

  /**
   * Tolerate the legacy value, enforce the shape on a change. A crewCode that
   * predates the `YY-NNNN` mint is free text; re-saving the man unchanged
   * must not be refused for it. But if the clerk TYPES a new crew ID, it has to
   * be well formed. `d.crewCode` is already trimmed by the schema.
   */
  if (d.crewCode && d.crewCode !== (existing.crewCode ?? "") && !isCrewId(d.crewCode)) {
    return { ok: false, error: CREW_ID_FORMAT_MESSAGE, fieldErrors: { crewCode: CREW_ID_FORMAT_MESSAGE } };
  }

  if (d.crewCode && (await crewCodeTaken(user.companyId, d.crewCode, existing.id))) {
    return fail(DUPLICATE_CREW_CODE);
  }

  /**
   * YOU MAY NOT BLIND-WRITE A FIELD YOU MAY NOT READ. The sensitive columns are
   * written only by a caller holding crew:read-sensitive, because a form
   * rendered without it does not contain those inputs — and an absent input
   * posts as "", which would NULL a man's date of birth as a side effect of an
   * unrelated correction. Omitting the keys leaves the columns untouched.
   */
  const mayEditSensitive = can(user, "crew:read-sensitive");

  // ONE `data` const, two consumers — the rule lib/audit-diff.ts opens with.
  const data = {
    crewCode: d.crewCode || null,
    lastName: d.lastName,
    firstName: d.firstName,
    middleName: d.middleName || null,
    suffix: d.suffix || null,
    ...(mayEditSensitive
      ? {
          nationality: d.nationality || null,
          dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
          contactPhone: d.contactPhone || null,
          contactEmail: d.contactEmail || null,
          nextOfKinName: d.nextOfKinName || null,
          nextOfKinRelationship: d.nextOfKinRelationship || null,
          nextOfKinPhone: d.nextOfKinPhone || null,
        }
      : {}),
    updatedBy: user.id,
  };

  await prisma.seafarer.update({ where: { id: existing.id }, data });

  /**
   * THE EXCLUDE LIST IS THE POINT OF THIS CALL. Without it, every correction of
   * a date of birth writes the old and new value into `AuditLog.metadata`
   * permanently. With it, the diff records THAT the field changed, by name, and
   * no values at all.
   */
  const changes = diffFields(existing, data, { exclude: CREW_AUDIT_EXCLUDE });
  const labels = changedLabels(changes, CREW_DIFF_LABELS);

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Seafarer",
    entityId: existing.id,
    summary: labels.length
      ? `Updated seafarer ${crewAuditLabel(existing)} — changed ${labels.join(", ")}`
      : `Re-saved seafarer ${crewAuditLabel(existing)} with no changes`,
    metadata: { changes },
  });

  revalidatePath("/crewing/seafarers");
  revalidatePath(`/crewing/seafarers/${existing.id}`);
  return OK;
}

/**
 * In or out of the manning pool. NOT a delete and NOT a redaction — three
 * states with three meanings (§3.5).
 */
export async function deactivateSeafarerAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("crew:update");
  if (user.department === "SHIPBOARD") return fail(OFFICE_ONLY);

  const parsed = deactivateSeafarerSchema.safeParse({
    seafarerId: formData.get("seafarerId"),
    active: formData.get("active"),
    updatedAt: formData.get("updatedAt"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;

  const existing = await findSeafarerForOffice(user, d.seafarerId);
  if (!existing) return fail(NOT_FOUND);
  if (existing.updatedAt.toISOString() !== d.updatedAt) return fail(STALE_RECORD_MESSAGE);

  const active = d.active === "true";
  await prisma.seafarer.update({
    where: { id: existing.id },
    data: { active, updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Seafarer",
    entityId: existing.id,
    summary: active
      ? `Returned seafarer ${crewAuditLabel(existing)} to the manning pool`
      : `Marked seafarer ${crewAuditLabel(existing)} as no longer in the manning pool`,
  });

  revalidatePath("/crewing/seafarers");
  revalidatePath(`/crewing/seafarers/${existing.id}`);
  return OK;
}

/**
 * Soft delete — FOR A RECORD CREATED IN ERROR ONLY. Refuses if the man holds
 * any assignment, deleted or not, because a man who has sailed is a record with
 * a retention obligation, not a mistake. AND IT IS NOT ERASURE — a soft-deleted
 * Seafarer still contains his date of birth; erasure is redactSeafarerAction (a
 * later batch).
 */
export async function deleteSeafarerAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("crew:delete");
  if (user.department === "SHIPBOARD") return fail(OFFICE_ONLY);

  const parsed = deleteSeafarerSchema.safeParse({ seafarerId: formData.get("seafarerId") });
  if (!parsed.success) return failFromZod(parsed.error);

  const existing = await findSeafarerForOffice(user, parsed.data.seafarerId);
  if (!existing) return fail(NOT_FOUND);

  // Any assignment at all, including soft-deleted ones.
  const assignments = await prisma.crewAssignment.count({
    where: { companyId: user.companyId, seafarerId: existing.id },
  });
  if (assignments > 0) {
    return fail(
      "This seafarer has service history and can't be deleted. Mark him as no longer in the manning pool instead.",
    );
  }

  await prisma.seafarer.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "Seafarer",
    entityId: existing.id,
    summary: `Deleted seafarer ${crewAuditLabel(existing)} from the register (no service history)`,
  });

  revalidatePath("/crewing/seafarers");
  redirect("/crewing/seafarers");
}

// ─── Crew changes: embark / disembark / transfer / planned relief ───────────
//
// Guard order: requirePermission("crew:assign") → inline office gate → safeParse
// → load through findCrewAssignmentForActor / findSeafarerForOffice → not found
// → optimistic lock on updatedAt → in-transaction invariant → write → writeAudit.
//
// The audit VERB: CREATE when a new assignment row is filed, SUBMIT when an
// existing row's sign-on/sign-off state changes. entityType is always
// "CrewAssignment", so each vessel's crew history is answerable on its own id.

const ASSIGNMENT_NOT_FOUND = "Assignment not found";
const NOT_ABOARD = "He is not aboard, so there is no sign-off to record.";
const ALREADY_SIGNED_ON = "He has already signed on to this assignment.";
const ASSIGNMENT_CLOSED = "This tour of duty is already complete.";
const SIGN_OFF_BEFORE_ON = "The sign-off date can't be before the sign-on date.";
const TRANSFER_ORDER = "He can't join the new vessel before he leaves the current one.";
const SAME_VESSEL_TRANSFER =
  "He is already on that vessel — choose a different ship to transfer to.";
const RELIEF_NOT_FOUND = "The assignment he relieves could not be found.";
const CREATE_JOIN_INCOMPLETE = "Choose the vessel, rank and planned sign-on date.";

/**
 * The seafarer's audit label from his id — name and crew code ONLY. Company
 * scoped; the assignment that names this seafarer already proved he exists, so
 * the null branch is a defensive fallback that does not fire in practice.
 */
async function seafarerAuditLabel(companyId: string, seafarerId: string): Promise<string> {
  const s = await prisma.seafarer.findFirst({
    where: { id: seafarerId, companyId },
    select: { lastName: true, firstName: true, middleName: true, suffix: true, crewCode: true },
  });
  return s ? crewAuditLabel(s) : "a seafarer";
}

/**
 * A vessel label from its id, for the audit summary of an action that loaded an
 * existing assignment (which carries `vesselId`, not the vessel's name).
 */
async function vesselLabelById(companyId: string, vesselId: string): Promise<string> {
  const v = await prisma.vessel.findFirst({
    where: { id: vesselId, companyId },
    select: { name: true, code: true },
  });
  return v ? vesselLabel(v) : "the vessel";
}

/**
 * Resolves an optional relief link against the caller's boundary: absent →
 * null, a real assignment id he can see → that id, anything else → the sentinel
 * the caller turns into RELIEF_NOT_FOUND. Never trusts the raw uuid.
 */
const RELIEF_INVALID = Symbol("relief-invalid");
async function resolveReliefLink(
  user: Awaited<ReturnType<typeof requirePermission>>,
  reliefForAssignmentId: string | undefined,
): Promise<string | null | typeof RELIEF_INVALID> {
  if (!reliefForAssignmentId) return null;
  const relief = await findCrewAssignmentForActor(user, reliefForAssignmentId);
  return relief ? relief.id : RELIEF_INVALID;
}

/**
 * Plan a future assignment — a berth the crewing desk intends. Optionally an
 * immediate sign-on (actualSignOnDate set), and only then does the one-live
 * check run: a purely planned relief may sit alongside a man's current tour.
 */
export async function planAssignmentAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("crew:assign");
  if (user.department === "SHIPBOARD") return fail(OFFICE_ONLY);

  const parsed = planAssignmentSchema.safeParse({
    seafarerId: formData.get("seafarerId"),
    updatedAt: formData.get("updatedAt"),
    vesselId: formData.get("vesselId"),
    rankCode: formData.get("rankCode"),
    plannedSignOnDate: formData.get("plannedSignOnDate"),
    actualSignOnDate: formData.get("actualSignOnDate") ?? undefined,
    signOnPort: formData.get("signOnPort") ?? undefined,
    reliefForAssignmentId: formData.get("reliefForAssignmentId") ?? undefined,
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;

  const seafarer = await findSeafarerForOffice(user, d.seafarerId);
  if (!seafarer) return fail(NOT_FOUND);
  if (seafarer.updatedAt.toISOString() !== d.updatedAt) return fail(STALE_RECORD_MESSAGE);

  const vessel = await resolveVessel(user.companyId, d.vesselId);
  if (!vessel) return fail(VESSEL_NOT_FOUND);

  const relief = await resolveReliefLink(user, d.reliefForAssignmentId || undefined);
  if (relief === RELIEF_INVALID) return fail(RELIEF_NOT_FOUND);

  const actualSignOnDate = d.actualSignOnDate ? new Date(d.actualSignOnDate) : null;

  let assignmentId: string;
  try {
    assignmentId = await prisma.$transaction(async (tx) => {
      if (actualSignOnDate) await assertNoLiveAssignment(tx, user.companyId, seafarer.id);
      const a = await tx.crewAssignment.create({
        data: {
          companyId: user.companyId,
          seafarerId: seafarer.id,
          vesselId: vessel.id,
          rankCode: d.rankCode,
          plannedSignOnDate: new Date(d.plannedSignOnDate),
          actualSignOnDate,
          // A port only means something once he has actually joined.
          signOnPort: actualSignOnDate ? d.signOnPort || null : null,
          reliefForAssignmentId: relief,
          createdBy: user.id,
        },
        select: { id: true },
      });
      return a.id;
    });
  } catch (err) {
    if (err instanceof LiveAssignmentError) return fail(err.message);
    throw err;
  }

  const label = crewAuditLabel(seafarer);
  const vLabel = vesselLabel(vessel);
  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "CrewAssignment",
    entityId: assignmentId,
    summary: actualSignOnDate
      ? `Signed on ${label} to ${vLabel} as ${rankLabel(d.rankCode)} on ${formatDate(actualSignOnDate)}`
      : `Planned ${label} to join ${vLabel} as ${rankLabel(d.rankCode)} on ${formatDate(new Date(d.plannedSignOnDate))}`,
  });

  revalidatePath("/crewing");
  revalidatePath("/crewing/seafarers");
  revalidatePath(`/crewing/seafarers/${seafarer.id}`);
  return OK;
}

/**
 * Embark. Either activates an existing PLANNED row (mode A) or creates the
 * assignment and joins in one step (mode B). Both call assertNoLiveAssignment
 * inside the transaction; mode A excludes the row it is activating.
 */
export async function signOnAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("crew:assign");
  if (user.department === "SHIPBOARD") return fail(OFFICE_ONLY);

  const parsed = signOnSchema.safeParse({
    assignmentId: formData.get("assignmentId") ?? undefined,
    seafarerId: formData.get("seafarerId") ?? undefined,
    updatedAt: formData.get("updatedAt"),
    vesselId: formData.get("vesselId") ?? undefined,
    rankCode: formData.get("rankCode") ?? undefined,
    plannedSignOnDate: formData.get("plannedSignOnDate") ?? undefined,
    actualSignOnDate: formData.get("actualSignOnDate"),
    signOnPort: formData.get("signOnPort") ?? undefined,
    reliefForAssignmentId: formData.get("reliefForAssignmentId") ?? undefined,
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;
  const actualSignOnDate = new Date(d.actualSignOnDate);

  // ── Mode A: activate an existing PLANNED row ──
  if (d.assignmentId) {
    const assignment = await findCrewAssignmentForActor(user, d.assignmentId);
    if (!assignment) return fail(ASSIGNMENT_NOT_FOUND);
    if (assignment.actualSignOffDate) return fail(ASSIGNMENT_CLOSED);
    if (assignment.actualSignOnDate) return fail(ALREADY_SIGNED_ON);
    if (assignment.updatedAt.toISOString() !== d.updatedAt) return fail(STALE_RECORD_MESSAGE);

    try {
      await prisma.$transaction(async (tx) => {
        await assertNoLiveAssignment(tx, user.companyId, assignment.seafarerId, assignment.id);
        await tx.crewAssignment.update({
          where: { id: assignment.id },
          data: { actualSignOnDate, signOnPort: d.signOnPort || null, updatedBy: user.id },
        });
      });
    } catch (err) {
      if (err instanceof LiveAssignmentError) return fail(err.message);
      throw err;
    }

    const label = await seafarerAuditLabel(user.companyId, assignment.seafarerId);
    const vLabel = await vesselLabelById(user.companyId, assignment.vesselId);
    await writeAudit({
      actor: user,
      action: "SUBMIT",
      entityType: "CrewAssignment",
      entityId: assignment.id,
      summary: `Signed on ${label} to ${vLabel} as ${rankLabel(assignment.rankCode)} on ${formatDate(actualSignOnDate)}`,
    });

    revalidatePath("/crewing");
    revalidatePath("/crewing/seafarers");
    revalidatePath(`/crewing/seafarers/${assignment.seafarerId}`);
    return OK;
  }

  // ── Mode B: create-and-join ── (superRefine guarantees these are present)
  if (!d.seafarerId || !d.vesselId || !d.rankCode || !d.plannedSignOnDate) {
    return fail(CREATE_JOIN_INCOMPLETE);
  }

  const seafarer = await findSeafarerForOffice(user, d.seafarerId);
  if (!seafarer) return fail(NOT_FOUND);
  if (seafarer.updatedAt.toISOString() !== d.updatedAt) return fail(STALE_RECORD_MESSAGE);

  const vessel = await resolveVessel(user.companyId, d.vesselId);
  if (!vessel) return fail(VESSEL_NOT_FOUND);

  const relief = await resolveReliefLink(user, d.reliefForAssignmentId || undefined);
  if (relief === RELIEF_INVALID) return fail(RELIEF_NOT_FOUND);

  const plannedSignOnDate = new Date(d.plannedSignOnDate);
  const rankCode = d.rankCode;

  let assignmentId: string;
  try {
    assignmentId = await prisma.$transaction(async (tx) => {
      await assertNoLiveAssignment(tx, user.companyId, seafarer.id);
      const a = await tx.crewAssignment.create({
        data: {
          companyId: user.companyId,
          seafarerId: seafarer.id,
          vesselId: vessel.id,
          rankCode,
          plannedSignOnDate,
          actualSignOnDate,
          signOnPort: d.signOnPort || null,
          reliefForAssignmentId: relief,
          createdBy: user.id,
        },
        select: { id: true },
      });
      return a.id;
    });
  } catch (err) {
    if (err instanceof LiveAssignmentError) return fail(err.message);
    throw err;
  }

  const label = crewAuditLabel(seafarer);
  const vLabel = vesselLabel(vessel);
  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "CrewAssignment",
    entityId: assignmentId,
    summary: `Signed on ${label} to ${vLabel} as ${rankLabel(rankCode)} on ${formatDate(actualSignOnDate)}`,
  });

  revalidatePath("/crewing");
  revalidatePath("/crewing/seafarers");
  revalidatePath(`/crewing/seafarers/${seafarer.id}`);
  return OK;
}

/**
 * Disembark. Refuses unless the derived status is ABOARD, and refuses a
 * sign-off dated before the sign-on. No transaction: a single row moves
 * ABOARD→COMPLETED, with no invariant that spans two rows.
 */
export async function signOffAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("crew:assign");
  if (user.department === "SHIPBOARD") return fail(OFFICE_ONLY);

  const parsed = signOffSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    updatedAt: formData.get("updatedAt"),
    actualSignOffDate: formData.get("actualSignOffDate"),
    signOffPort: formData.get("signOffPort") ?? undefined,
    signOffReason: formData.get("signOffReason"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;

  const assignment = await findCrewAssignmentForActor(user, d.assignmentId);
  if (!assignment) return fail(ASSIGNMENT_NOT_FOUND);
  if (assignmentStatus(assignment) !== "ABOARD") return fail(NOT_ABOARD);
  if (assignment.updatedAt.toISOString() !== d.updatedAt) return fail(STALE_RECORD_MESSAGE);

  const actualSignOffDate = new Date(d.actualSignOffDate);
  // ABOARD proves actualSignOnDate is set; the guard is the compiler's too.
  if (assignment.actualSignOnDate && actualSignOffDate < assignment.actualSignOnDate) {
    return fail(SIGN_OFF_BEFORE_ON);
  }

  await prisma.crewAssignment.update({
    where: { id: assignment.id },
    data: {
      actualSignOffDate,
      signOffPort: d.signOffPort || null,
      signOffReason: d.signOffReason,
      updatedBy: user.id,
    },
  });

  const label = await seafarerAuditLabel(user.companyId, assignment.seafarerId);
  const vLabel = await vesselLabelById(user.companyId, assignment.vesselId);
  await writeAudit({
    actor: user,
    action: "SUBMIT",
    entityType: "CrewAssignment",
    entityId: assignment.id,
    summary: `Signed off ${label} from ${vLabel} on ${formatDate(actualSignOffDate)} (${SIGN_OFF_REASON_LABELS[d.signOffReason]})`,
  });

  revalidatePath("/crewing");
  revalidatePath("/crewing/seafarers");
  revalidatePath(`/crewing/seafarers/${assignment.seafarerId}`);
  return OK;
}

/**
 * Transfer — disembark from one vessel and embark onto another, atomically. The
 * sign-off of the current berth and the sign-on of the new one are ONE
 * transaction: he is never briefly on both ships and never briefly on neither.
 * assertNoLiveAssignment runs AFTER the sign-off. TWO audit entries.
 */
export async function transferAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("crew:assign");
  if (user.department === "SHIPBOARD") return fail(OFFICE_ONLY);

  const parsed = transferSchema.safeParse({
    fromAssignmentId: formData.get("fromAssignmentId"),
    updatedAt: formData.get("updatedAt"),
    actualSignOffDate: formData.get("actualSignOffDate"),
    signOffPort: formData.get("signOffPort") ?? undefined,
    signOffReason: formData.get("signOffReason"),
    vesselId: formData.get("vesselId"),
    rankCode: formData.get("rankCode"),
    plannedSignOnDate: formData.get("plannedSignOnDate"),
    actualSignOnDate: formData.get("actualSignOnDate"),
    signOnPort: formData.get("signOnPort") ?? undefined,
    reliefForAssignmentId: formData.get("reliefForAssignmentId") ?? undefined,
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;

  const from = await findCrewAssignmentForActor(user, d.fromAssignmentId);
  if (!from) return fail(ASSIGNMENT_NOT_FOUND);
  if (assignmentStatus(from) !== "ABOARD") return fail(NOT_ABOARD);
  if (from.updatedAt.toISOString() !== d.updatedAt) return fail(STALE_RECORD_MESSAGE);

  const toVessel = await resolveVessel(user.companyId, d.vesselId);
  if (!toVessel) return fail(VESSEL_NOT_FOUND);
  if (toVessel.id === from.vesselId) return fail(SAME_VESSEL_TRANSFER);

  const actualSignOffDate = new Date(d.actualSignOffDate);
  const actualSignOnDate = new Date(d.actualSignOnDate);
  if (from.actualSignOnDate && actualSignOffDate < from.actualSignOnDate) {
    return fail(SIGN_OFF_BEFORE_ON);
  }
  if (actualSignOnDate < actualSignOffDate) return fail(TRANSFER_ORDER);

  const relief = await resolveReliefLink(user, d.reliefForAssignmentId || undefined);
  if (relief === RELIEF_INVALID) return fail(RELIEF_NOT_FOUND);

  const plannedSignOnDate = new Date(d.plannedSignOnDate);
  const rankCode = d.rankCode;
  const signOffReason = d.signOffReason;

  let newAssignmentId: string;
  try {
    newAssignmentId = await prisma.$transaction(async (tx) => {
      await tx.crewAssignment.update({
        where: { id: from.id },
        data: {
          actualSignOffDate,
          signOffPort: d.signOffPort || null,
          signOffReason,
          updatedBy: user.id,
        },
      });
      // He is off the first vessel now, so it no longer counts.
      await assertNoLiveAssignment(tx, user.companyId, from.seafarerId);
      const a = await tx.crewAssignment.create({
        data: {
          companyId: user.companyId,
          seafarerId: from.seafarerId,
          vesselId: toVessel.id,
          rankCode,
          plannedSignOnDate,
          actualSignOnDate,
          signOnPort: d.signOnPort || null,
          reliefForAssignmentId: relief,
          createdBy: user.id,
        },
        select: { id: true },
      });
      return a.id;
    });
  } catch (err) {
    if (err instanceof LiveAssignmentError) return fail(err.message);
    throw err;
  }

  const label = await seafarerAuditLabel(user.companyId, from.seafarerId);
  const fromLabel = await vesselLabelById(user.companyId, from.vesselId);
  const toLabel = vesselLabel(toVessel);
  await writeAudit({
    actor: user,
    action: "SUBMIT",
    entityType: "CrewAssignment",
    entityId: from.id,
    summary: `Signed off ${label} from ${fromLabel} on ${formatDate(actualSignOffDate)} — transferred to ${toLabel}`,
  });
  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "CrewAssignment",
    entityId: newAssignmentId,
    summary: `Signed on ${label} to ${toLabel} as ${rankLabel(rankCode)} on ${formatDate(actualSignOnDate)} — transfer from ${fromLabel}`,
  });

  revalidatePath("/crewing");
  revalidatePath("/crewing/seafarers");
  revalidatePath(`/crewing/seafarers/${from.seafarerId}`);
  return OK;
}
