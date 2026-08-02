"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  createCommitteeMeetingSchema,
  updateDraftMeetingSchema,
  officeReviewMeetingSchema,
  type CommitteeTypeValue,
} from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CM-${year}-`;
  const count = await prisma.committeeMeeting.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/** Zips the parallel agenda arrays into row objects, dropping blank rows
 * (no label typed in) — e.g. an unused "Others" add-row left empty. */
type ShipAgendaRow = {
  id: string;
  committeeType: CommitteeTypeValue;
  code: string;
  label: string;
  details: string;
};

function zipShipAgendaRows(d: {
  agendaId: string[];
  agendaCommitteeType: CommitteeTypeValue[];
  agendaCode: string[];
  agendaLabel: string[];
  agendaDetails: string[];
}): ShipAgendaRow[] {
  const rows: ShipAgendaRow[] = [];
  for (let i = 0; i < d.agendaLabel.length; i++) {
    const label = d.agendaLabel[i];
    const committeeType = d.agendaCommitteeType[i];
    if (!label || label.trim() === "" || !committeeType) continue;
    rows.push({
      id: d.agendaId[i] || "",
      committeeType,
      code: d.agendaCode[i] || "",
      label,
      details: d.agendaDetails[i] || "",
    });
  }
  return rows;
}

export async function createCommitteeMeetingAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("meeting:create");
  const parsed = createCommitteeMeetingSchema.safeParse({
    vesselId: formData.get("vesselId"),
    position: formData.get("position"),
    meetingDate: formData.get("meetingDate"),
    meetingTime: formData.get("meetingTime"),
    chairman: formData.get("chairman"),
    inCharge: formData.get("inCharge"),
    members: formData.get("members"),
    inAttendance: formData.get("inAttendance"),
    forAcknowledgement: formData.get("forAcknowledgement"),
    vesselRemarks: formData.get("vesselRemarks"),
    agendaId: formData.getAll("agendaId"),
    agendaCommitteeType: formData.getAll("agendaCommitteeType"),
    agendaCode: formData.getAll("agendaCode"),
    agendaLabel: formData.getAll("agendaLabel"),
    agendaDetails: formData.getAll("agendaDetails"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const rows = zipShipAgendaRows(d);
  if (rows.length === 0) return fail("Add at least one agenda item");

  // "Save as Draft" is a vessel-only workflow step — same rule as Near Miss:
  // honoring it for an office-originated record would orphan it, since only
  // its own SHIPBOARD login can ever see/report a draft.
  const isShipboard = user.department === "SHIPBOARD";
  const status = formData.get("intent") === "draft" && isShipboard ? "DRAFT" : "REPORTED";

  const meeting = await prisma.committeeMeeting.create({
    data: {
      companyId: user.companyId,
      // A draft hasn't been reported yet, so it doesn't burn a ref number.
      refNo: status === "REPORTED" ? await nextRefNo(user.companyId) : null,
      status,
      reportedAt: status === "REPORTED" ? new Date() : null,
      vesselId: isShipboard ? user.vesselId : d.vesselId || null,
      position: d.position || null,
      meetingDate: new Date(d.meetingDate),
      meetingTime: d.meetingTime || null,
      chairman: d.chairman || null,
      inCharge: d.inCharge || null,
      members: d.members || null,
      inAttendance: d.inAttendance || null,
      forAcknowledgement: d.forAcknowledgement || null,
      vesselRemarks: d.vesselRemarks || null,
      createdBy: user.id,
      updatedBy: user.id,
      agendaItems: {
        create: rows.map((r, i) => ({
          companyId: user.companyId,
          seq: i + 1,
          committeeType: r.committeeType,
          code: r.code || null,
          label: r.label,
          details: r.details || null,
        })),
      },
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "CommitteeMeeting",
    entityId: meeting.id,
    summary:
      status === "REPORTED"
        ? `Reported committee meeting ${meeting.refNo}`
        : `Saved committee meeting draft`,
  });

  revalidatePath("/meetings");
  redirect(`/meetings/${meeting.id}`);
}

/** Vessel-only: full edit of its own meeting — only ever while status = DRAFT. */
export async function updateDraftMeetingAction(
  meetingId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("meeting:update");
  if (user.department !== "SHIPBOARD") {
    return fail("Only the vessel can edit its own draft");
  }
  const meeting = await prisma.committeeMeeting.findFirst({
    where: { id: meetingId, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
    include: { agendaItems: { select: { id: true, seq: true } } },
  });
  if (!meeting) return fail("Draft not found");

  const parsed = updateDraftMeetingSchema.safeParse({
    meetingId,
    // Vessel is locked — never resubmitted by this form — so it's left out
    // entirely rather than touched below.
    vesselId: undefined,
    position: formData.get("position"),
    meetingDate: formData.get("meetingDate"),
    meetingTime: formData.get("meetingTime"),
    chairman: formData.get("chairman"),
    inCharge: formData.get("inCharge"),
    members: formData.get("members"),
    inAttendance: formData.get("inAttendance"),
    forAcknowledgement: formData.get("forAcknowledgement"),
    vesselRemarks: formData.get("vesselRemarks"),
    agendaId: formData.getAll("agendaId"),
    agendaCommitteeType: formData.getAll("agendaCommitteeType"),
    agendaCode: formData.getAll("agendaCode"),
    agendaLabel: formData.getAll("agendaLabel"),
    agendaDetails: formData.getAll("agendaDetails"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const rows = zipShipAgendaRows(d);
  if (rows.length === 0) return fail("Add at least one agenda item");

  const existingIds = new Set(meeting.agendaItems.map((a) => a.id));
  let nextSeq = meeting.agendaItems.reduce((max, a) => Math.max(max, a.seq), 0) + 1;

  await prisma.$transaction([
    prisma.committeeMeeting.update({
      where: { id: meeting.id },
      data: {
        position: d.position || null,
        meetingDate: new Date(d.meetingDate),
        meetingTime: d.meetingTime || null,
        chairman: d.chairman || null,
        inCharge: d.inCharge || null,
        members: d.members || null,
        inAttendance: d.inAttendance || null,
        forAcknowledgement: d.forAcknowledgement || null,
        vesselRemarks: d.vesselRemarks || null,
        updatedBy: user.id,
      },
    }),
    ...rows.map((r) =>
      existingIds.has(r.id)
        ? prisma.committeeMeetingAgenda.update({
            where: { id: r.id },
            data: { details: r.details || null },
          })
        : prisma.committeeMeetingAgenda.create({
            data: {
              companyId: user.companyId,
              meetingId: meeting.id,
              seq: nextSeq++,
              committeeType: r.committeeType,
              code: r.code || null,
              label: r.label,
              details: r.details || null,
            },
          }),
    ),
  ]);

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "CommitteeMeeting",
    entityId: meeting.id,
    summary: `Updated committee meeting draft`,
  });

  revalidatePath(`/meetings/${meeting.id}`);
  return OK;
}

/** Vessel-only: submits a Draft (or a reverted, revised meeting) for office review — DRAFT → REPORTED. */
export async function reportMeetingAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("meeting:create");
  if (user.department !== "SHIPBOARD") {
    return fail("Only the vessel can report a meeting to the office");
  }
  const id = String(formData.get("meetingId") ?? "");
  const meeting = await prisma.committeeMeeting.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null, status: "DRAFT" },
  });
  if (!meeting) return fail("Draft not found");

  await prisma.committeeMeeting.update({
    where: { id: meeting.id },
    data: {
      status: "REPORTED",
      // Assigned once, kept forever — a revert-and-resend never burns a new one.
      refNo: meeting.refNo ?? (await nextRefNo(user.companyId)),
      reportedAt: new Date(),
      // Already has office remarks on file? This is a revised resend after a
      // prior close — flag it so the office notices without losing what they
      // already wrote.
      revisedAfterReview: !!meeting.shoreRemarks,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "CommitteeMeeting",
    entityId: meeting.id,
    summary: `Reported committee meeting ${meeting.refNo ?? ""} to the office`,
  });

  revalidatePath(`/meetings/${meeting.id}`);
  revalidatePath("/meetings");
  return OK;
}

/**
 * Vessel-only: pulls a Reported or Closed meeting back into full edit —
 * "just in case may gusto silang idagdag." Never touches refNo, shoreRemarks,
 * or any agenda shoreComments already on file; the office's prior review
 * stays exactly as it was until they close it again.
 */
export async function revertMeetingToDraftAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("meeting:update");
  if (user.department !== "SHIPBOARD") {
    return fail("Only the vessel can revert its own meeting");
  }
  const id = String(formData.get("meetingId") ?? "");
  const meeting = await prisma.committeeMeeting.findFirst({
    where: {
      id,
      companyId: user.companyId,
      deletedAt: null,
      vesselId: user.vesselId ?? "__no-vessel-assigned__",
      status: { in: ["REPORTED", "CLOSED"] },
    },
  });
  if (!meeting) return fail("Meeting not found");

  await prisma.committeeMeeting.update({
    where: { id: meeting.id },
    data: { status: "DRAFT", updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "CommitteeMeeting",
    entityId: meeting.id,
    summary: `Reverted committee meeting ${meeting.refNo ?? ""} to draft for edits`,
  });

  revalidatePath(`/meetings/${meeting.id}`);
  revalidatePath("/meetings");
  return OK;
}

/** Office-only: overall reply plus per-agenda-item replies — only ever while status = REPORTED. */
export async function saveOfficeReviewMeetingAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("meeting:update");
  if (user.department === "SHIPBOARD") {
    return fail("Only the office can record a review reply");
  }
  const parsed = officeReviewMeetingSchema.safeParse({
    meetingId: formData.get("meetingId"),
    shoreRemarks: formData.get("shoreRemarks"),
    agendaId: formData.getAll("agendaId"),
    agendaShoreComments: formData.getAll("agendaShoreComments"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const meeting = await prisma.committeeMeeting.findFirst({
    where: { id: d.meetingId, companyId: user.companyId, deletedAt: null, status: "REPORTED" },
  });
  if (!meeting) return fail("Meeting not found, or it's not awaiting review");

  await prisma.$transaction([
    prisma.committeeMeeting.update({
      where: { id: meeting.id },
      data: { shoreRemarks: d.shoreRemarks || null, updatedBy: user.id },
    }),
    ...d.agendaId.map((agendaId, i) =>
      prisma.committeeMeetingAgenda.update({
        where: { id: agendaId },
        data: { shoreComments: d.agendaShoreComments[i] || null },
      }),
    ),
  ]);

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "CommitteeMeeting",
    entityId: meeting.id,
    summary: `Office review recorded for committee meeting ${meeting.refNo ?? ""}`,
  });

  revalidatePath(`/meetings/${meeting.id}`);
  return OK;
}

/**
 * Office-only: saves whatever shore remarks/comments are currently typed and
 * closes the meeting out in the same step — so the ship always sees the
 * office's response together with the Closed status, instead of depending on
 * "Save changes" having been clicked first (a comment typed but never saved
 * would otherwise be silently lost the moment Close fires).
 */
export async function closeMeetingAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("meeting:close");
  const parsed = officeReviewMeetingSchema.safeParse({
    meetingId: formData.get("meetingId"),
    shoreRemarks: formData.get("shoreRemarks"),
    agendaId: formData.getAll("agendaId"),
    agendaShoreComments: formData.getAll("agendaShoreComments"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const meeting = await prisma.committeeMeeting.findFirst({
    where: { id: d.meetingId, companyId: user.companyId, deletedAt: null, status: "REPORTED" },
  });
  if (!meeting) return fail("Meeting not found, or it's not awaiting review");
  if (!d.shoreRemarks || !d.shoreRemarks.trim()) {
    return fail("Add shore remarks before closing this meeting out");
  }

  await prisma.$transaction([
    prisma.committeeMeeting.update({
      where: { id: meeting.id },
      data: {
        shoreRemarks: d.shoreRemarks || null,
        status: "CLOSED",
        closedAt: new Date(),
        revisedAfterReview: false,
        updatedBy: user.id,
      },
    }),
    ...d.agendaId.map((agendaId, i) =>
      prisma.committeeMeetingAgenda.update({
        where: { id: agendaId },
        data: { shoreComments: d.agendaShoreComments[i] || null },
      }),
    ),
  ]);

  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "CommitteeMeeting",
    entityId: meeting.id,
    summary: `Closed out committee meeting ${meeting.refNo ?? ""}`,
  });

  revalidatePath(`/meetings/${meeting.id}`);
  revalidatePath("/meetings");
  return OK;
}

export async function deleteCommitteeMeetingAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("meeting:delete");
  const id = String(formData.get("meetingId") ?? "");
  const meeting = await prisma.committeeMeeting.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!meeting) return fail("Meeting not found");

  await prisma.committeeMeeting.update({
    where: { id: meeting.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "CommitteeMeeting",
    entityId: meeting.id,
    summary: `Deleted committee meeting ${meeting.refNo ?? ""}`,
  });

  revalidatePath("/meetings");
  redirect("/meetings");
}
