import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import CalendarView, { type CalEvent } from "./CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await requirePermission("calendar:read");

  const [custom, vessels] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { companyId: user.companyId },
      orderBy: { startAt: "asc" },
    }),
    prisma.vessel.findMany({
      where: { companyId: user.companyId, deletedAt: null, nextDryDockDue: { not: null } },
      select: { id: true, name: true, nextDryDockDue: true },
    }),
  ]);

  const events: CalEvent[] = [];

  // Manually-added events (editable / deletable).
  for (const e of custom) {
    events.push({
      id: e.id,
      startAt: e.startAt.toISOString(),
      endAt: e.endAt.toISOString(),
      allDay: e.allDay,
      type: "custom",
      color: e.color,
      title: e.title,
      sub: e.note ?? undefined,
    });
  }

  // Auto-derived drydock reminders (all-day, non-editable) from the fleet register.
  for (const v of vessels) {
    if (!v.nextDryDockDue) continue;
    const iso = v.nextDryDockDue.toISOString();
    events.push({
      type: "drydock",
      title: `Drydock due — ${v.name}`,
      href: "/vessels",
      startAt: iso,
      endAt: iso,
      allDay: true,
    });
  }

  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Office schedule — meetings, audits, reminders, and vessel drydock due dates."
      />
      <CalendarView events={events} initialYear={now.getFullYear()} initialMonth={now.getMonth()} />
    </div>
  );
}
