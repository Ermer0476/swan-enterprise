"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const COLORS = ["sky", "amber", "red", "emerald", "indigo", "purple"];

export type EventForm = {
  title: string;
  allDay: boolean;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM (ignored when allDay)
  endDate: string;
  endTime: string;
  color: string;
  note: string;
};

// Build start/end Date objects from the form (local time).
function range(f: EventForm) {
  const startDate = f.startDate;
  const endDate = f.endDate || f.startDate;
  const startAt = f.allDay
    ? new Date(`${startDate}T00:00:00`)
    : new Date(`${startDate}T${f.startTime || "00:00"}:00`);
  let endAt = f.allDay
    ? new Date(`${endDate}T23:59:00`)
    : new Date(`${endDate}T${f.endTime || f.startTime || "00:00"}:00`);
  if (endAt < startAt) endAt = new Date(startAt.getTime());
  return { startAt, endAt };
}

export async function createEvent(f: EventForm) {
  const user = await requirePermission("calendar:manage");
  if (!f.title.trim() || !f.startDate) return;
  const { startAt, endAt } = range(f);
  const event = await prisma.calendarEvent.create({
    data: {
      companyId: user.companyId,
      title: f.title.trim(),
      startAt,
      endAt,
      allDay: !!f.allDay,
      note: f.note.trim() || null,
      color: COLORS.includes(f.color) ? f.color : "sky",
      createdBy: user.id,
      updatedBy: user.id,
    },
  });
  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "CalendarEvent",
    entityId: event.id,
    summary: `Added calendar event "${event.title}"`,
  });
  revalidatePath("/calendar");
}

export async function updateEvent(id: string, f: EventForm) {
  const user = await requirePermission("calendar:manage");
  if (!id || !f.title.trim() || !f.startDate) return;
  const { startAt, endAt } = range(f);
  await prisma.calendarEvent.updateMany({
    where: { id, companyId: user.companyId },
    data: {
      title: f.title.trim(),
      startAt,
      endAt,
      allDay: !!f.allDay,
      note: f.note.trim() || null,
      color: COLORS.includes(f.color) ? f.color : "sky",
      updatedBy: user.id,
    },
  });
  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "CalendarEvent",
    entityId: id,
    summary: `Edited calendar event "${f.title.trim()}"`,
  });
  revalidatePath("/calendar");
}

export async function deleteEvent(id: string) {
  const user = await requirePermission("calendar:manage");
  if (!id) return;
  await prisma.calendarEvent.deleteMany({ where: { id, companyId: user.companyId } });
  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "CalendarEvent",
    entityId: id,
    summary: "Deleted a calendar event",
  });
  revalidatePath("/calendar");
}
