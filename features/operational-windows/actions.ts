"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

// Whole positive days, capped so a fat-fingered value can't silently disable a
// window. The defaults (30) live on the Company columns, not here.
const dayField = (label: string) =>
  z.coerce
    .number()
    .int(`${label} must be a whole number of days`)
    .min(1, `${label} must be at least 1 day`)
    .max(3650, `${label} must be 3650 days or fewer`);

const updateOperationalWindowsSchema = z.object({
  incidentOverdueDays: dayField("Incident overdue window"),
  sireDueSoonDays: dayField("SIRE due-soon window"),
  internalAuditDueSoonDays: dayField("Internal audit due-soon window"),
});

export async function updateOperationalWindowsAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("settings:manage-windows");
  const parsed = updateOperationalWindowsSchema.safeParse({
    incidentOverdueDays: formData.get("incidentOverdueDays"),
    sireDueSoonDays: formData.get("sireDueSoonDays"),
    internalAuditDueSoonDays: formData.get("internalAuditDueSoonDays"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  await prisma.company.update({
    where: { id: user.companyId },
    data: {
      incidentOverdueDays: d.incidentOverdueDays,
      sireDueSoonDays: d.sireDueSoonDays,
      internalAuditDueSoonDays: d.internalAuditDueSoonDays,
    },
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Company",
    entityId: user.companyId,
    summary: `Set operational windows to incident overdue ${d.incidentOverdueDays}d, SIRE due-soon ${d.sireDueSoonDays}d, internal audit due-soon ${d.internalAuditDueSoonDays}d`,
  });

  revalidatePath("/settings/operational-windows");
  revalidatePath("/");
  revalidatePath("/incidents/kpi");
  revalidatePath("/sire");
  revalidatePath("/sire/schedule");
  revalidatePath("/internal-audits");
  revalidatePath("/internal-audits/schedule");
  return OK;
}
