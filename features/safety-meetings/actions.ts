"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { createMeetingSchema } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SM-${year}-`;
  const count = await prisma.safetyMeeting.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createMeetingAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("meeting:create");
  const parsed = createMeetingSchema.safeParse({
    vesselId: formData.get("vesselId"),
    meetingType: formData.get("meetingType"),
    meetingDate: formData.get("meetingDate"),
    chairedBy: formData.get("chairedBy"),
    attendees: formData.get("attendees"),
    agenda: formData.get("agenda"),
    minutes: formData.get("minutes"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const meeting = await prisma.safetyMeeting.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      vesselId: d.vesselId || null,
      meetingType: d.meetingType,
      meetingDate: new Date(d.meetingDate),
      chairedBy: d.chairedBy || null,
      attendees: d.attendees || null,
      agenda: d.agenda || null,
      minutes: d.minutes || null,
      status: "OPEN",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "SafetyMeeting",
    entityId: meeting.id,
    summary: `Recorded safety meeting ${meeting.refNo}`,
  });

  revalidatePath("/meetings");
  redirect(`/meetings/${meeting.id}`);
}

export async function closeMeetingAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("meeting:close");
  const id = String(formData.get("meetingId") ?? "");
  const meeting = await prisma.safetyMeeting.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!meeting) return fail("Meeting not found");
  if (meeting.status === "CLOSED") return fail("Already closed");

  await prisma.safetyMeeting.update({
    where: { id: meeting.id },
    data: { status: "CLOSED", closedAt: new Date(), updatedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "APPROVE",
    entityType: "SafetyMeeting",
    entityId: meeting.id,
    summary: `Closed safety meeting ${meeting.refNo}`,
  });

  revalidatePath(`/meetings/${meeting.id}`);
  return OK;
}

export async function deleteMeetingAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("meeting:delete");
  const id = String(formData.get("meetingId") ?? "");
  const meeting = await prisma.safetyMeeting.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!meeting) return fail("Meeting not found");

  await prisma.safetyMeeting.update({
    where: { id: meeting.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "SafetyMeeting",
    entityId: meeting.id,
    summary: `Deleted safety meeting ${meeting.refNo}`,
  });

  revalidatePath("/meetings");
  redirect("/meetings");
}
