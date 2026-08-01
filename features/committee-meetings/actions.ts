"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { createCommitteeMeetingSchema, updateCommitteeMeetingSchema, type CommitteeTypeValue } from "./schema";

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
type AgendaRow = {
  id: string;
  committeeType: CommitteeTypeValue;
  code: string;
  label: string;
  details: string;
  shoreComments: string;
};

function zipAgendaRows(d: {
  agendaId: string[];
  agendaCommitteeType: CommitteeTypeValue[];
  agendaCode: string[];
  agendaLabel: string[];
  agendaDetails: string[];
  agendaShoreComments: string[];
}): AgendaRow[] {
  const rows: AgendaRow[] = [];
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
      shoreComments: d.agendaShoreComments[i] || "",
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
    agendaShoreComments: formData.getAll("agendaShoreComments"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const rows = zipAgendaRows(d);
  if (rows.length === 0) return fail("Add at least one agenda item");

  const meeting = await prisma.committeeMeeting.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      // Shipboard accounts represent a single vessel — always their own, never
      // whatever a client happened to submit.
      vesselId: user.department === "SHIPBOARD" ? user.vesselId : d.vesselId || null,
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
          shoreComments: r.shoreComments || null,
        })),
      },
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "CommitteeMeeting",
    entityId: meeting.id,
    summary: `Recorded committee meeting ${meeting.refNo}`,
  });

  revalidatePath("/meetings");
  redirect(`/meetings/${meeting.id}`);
}

export async function updateCommitteeMeetingAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("meeting:update");
  const parsed = updateCommitteeMeetingSchema.safeParse({
    meetingId: formData.get("meetingId"),
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
    shoreRemarks: formData.get("shoreRemarks"),
    published: formData.get("published") === "true" ? "true" : "false",
    approved: formData.get("approved") === "true" ? "true" : "false",
    agendaId: formData.getAll("agendaId"),
    agendaCommitteeType: formData.getAll("agendaCommitteeType"),
    agendaCode: formData.getAll("agendaCode"),
    agendaLabel: formData.getAll("agendaLabel"),
    agendaDetails: formData.getAll("agendaDetails"),
    agendaShoreComments: formData.getAll("agendaShoreComments"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const isShipboard = user.department === "SHIPBOARD";
  const meeting = await prisma.committeeMeeting.findFirst({
    where: {
      id: d.meetingId,
      companyId: user.companyId,
      deletedAt: null,
      // Same visibility rule as the read side: shipboard only ever touches its
      // own vessel's minutes; office only ever touches already-approved ones.
      ...(isShipboard ? { vesselId: user.vesselId ?? "__no-vessel-assigned__" } : { approved: true }),
    },
    include: { agendaItems: { select: { id: true, seq: true } } },
  });
  if (!meeting) return fail("Meeting not found");

  const rows = zipAgendaRows(d);
  const existingIds = new Set(meeting.agendaItems.map((a) => a.id));
  let nextSeq = meeting.agendaItems.reduce((max, a) => Math.max(max, a.seq), 0) + 1;

  await prisma.$transaction([
    prisma.committeeMeeting.update({
      where: { id: meeting.id },
      data: {
        vesselId: d.vesselId || null,
        position: d.position || null,
        meetingDate: new Date(d.meetingDate),
        meetingTime: d.meetingTime || null,
        chairman: d.chairman || null,
        inCharge: d.inCharge || null,
        members: d.members || null,
        inAttendance: d.inAttendance || null,
        forAcknowledgement: d.forAcknowledgement || null,
        vesselRemarks: d.vesselRemarks || null,
        shoreRemarks: d.shoreRemarks || null,
        published: d.published === "true",
        // Only the vessel (Master) can flip Approved — that's what signals
        // the minutes are complete and releases them to the office queue.
        approved: isShipboard ? d.approved === "true" : meeting.approved,
        updatedBy: user.id,
      },
    }),
    ...rows.map((r) =>
      existingIds.has(r.id)
        ? prisma.committeeMeetingAgenda.update({
            where: { id: r.id },
            data: {
              details: r.details || null,
              shoreComments: r.shoreComments || null,
            },
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
              shoreComments: r.shoreComments || null,
            },
          }),
    ),
  ]);

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "CommitteeMeeting",
    entityId: meeting.id,
    summary: `Updated committee meeting ${meeting.refNo}`,
  });

  revalidatePath(`/meetings/${meeting.id}`);
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
    summary: `Deleted committee meeting ${meeting.refNo}`,
  });

  revalidatePath("/meetings");
  redirect("/meetings");
}
