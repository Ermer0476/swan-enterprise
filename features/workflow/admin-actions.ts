"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { withUniqueRetry } from "@/lib/retry";
import { DEPARTMENTS } from "@/features/sms-manual/schema";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

const WF_PATH = "/settings/workflows";

const addStepSchema = z
  .object({
    definitionId: z.string().uuid(),
    name: z.string().trim().min(2, "Step name is required").max(80),
    approverType: z.enum(["ROLE", "DEPARTMENT"]),
    approverRole: z.string().trim().optional().or(z.literal("")),
    approverDept: z.enum(DEPARTMENTS).optional(),
  })
  .refine(
    (v) => v.approverType !== "ROLE" || !!v.approverRole,
    { message: "Choose a role", path: ["approverRole"] },
  )
  .refine(
    (v) => v.approverType !== "DEPARTMENT" || !!v.approverDept,
    { message: "Choose a department", path: ["approverDept"] },
  );

/** Ensure the definition belongs to the caller's company. */
async function assertOwned(companyId: string, definitionId: string) {
  const def = await prisma.workflowDefinition.findFirst({
    where: { id: definitionId, companyId },
    select: { id: true },
  });
  if (!def) throw new Error("NOT_FOUND");
}

export async function addStepAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("admin:manage-workflows");
  const parsed = addStepSchema.safeParse({
    definitionId: formData.get("definitionId"),
    name: formData.get("name"),
    approverType: formData.get("approverType"),
    approverRole: formData.get("approverRole") || undefined,
    approverDept: formData.get("approverDept") || undefined,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;
  await assertOwned(user.companyId, d.definitionId);

  // Compute the next order and create inside a retry: two concurrent adds would
  // derive the same order and collide on @@unique([definitionId, order]); on a
  // P2002 we recompute from the now-committed row and try again.
  const order = await withUniqueRetry(async () => {
    const last = await prisma.workflowStep.findFirst({
      where: { definitionId: d.definitionId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const next = (last?.order ?? 0) + 1;

    await prisma.workflowStep.create({
      data: {
        definitionId: d.definitionId,
        order: next,
        name: d.name,
        approverType: d.approverType,
        approverRole: d.approverType === "ROLE" ? d.approverRole || null : null,
        approverDept: d.approverType === "DEPARTMENT" ? d.approverDept : null,
      },
    });
    return next;
  });

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "WorkflowDefinition",
    entityId: d.definitionId,
    summary: `Added workflow step "${d.name}" (order ${order})`,
  });

  revalidatePath(WF_PATH);
  return OK;
}

export async function removeStepAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("admin:manage-workflows");
  const stepId = String(formData.get("stepId") ?? "");
  const step = await prisma.workflowStep.findFirst({
    where: { id: stepId, definition: { companyId: user.companyId } },
  });
  if (!step) return fail("Step not found");

  await prisma.workflowStep.delete({ where: { id: step.id } });
  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "WorkflowDefinition",
    entityId: step.definitionId,
    summary: `Removed workflow step "${step.name}"`,
  });
  revalidatePath(WF_PATH);
  return OK;
}

/** Swap a step's order with its neighbour in the given direction. */
export async function moveStepAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("admin:manage-workflows");
  const stepId = String(formData.get("stepId") ?? "");
  const direction = String(formData.get("direction") ?? "");

  const step = await prisma.workflowStep.findFirst({
    where: { id: stepId, definition: { companyId: user.companyId } },
  });
  if (!step) return fail("Step not found");

  const neighbour = await prisma.workflowStep.findFirst({
    where: {
      definitionId: step.definitionId,
      order:
        direction === "up"
          ? { lt: step.order }
          : { gt: step.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbour) return OK; // already at the end

  // 3-way swap to respect the unique (definitionId, order) constraint.
  const TEMP = -1;
  await prisma.$transaction([
    prisma.workflowStep.update({
      where: { id: step.id },
      data: { order: TEMP },
    }),
    prisma.workflowStep.update({
      where: { id: neighbour.id },
      data: { order: step.order },
    }),
    prisma.workflowStep.update({
      where: { id: step.id },
      data: { order: neighbour.order },
    }),
  ]);

  revalidatePath(WF_PATH);
  return OK;
}

export async function toggleActiveAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("admin:manage-workflows");
  const definitionId = String(formData.get("definitionId") ?? "");
  const def = await prisma.workflowDefinition.findFirst({
    where: { id: definitionId, companyId: user.companyId },
  });
  if (!def) return fail("Workflow not found");

  await prisma.workflowDefinition.update({
    where: { id: def.id },
    data: { active: !def.active },
  });
  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "WorkflowDefinition",
    entityId: def.id,
    summary: `${def.active ? "Deactivated" : "Activated"} workflow "${def.name}"`,
  });
  revalidatePath(WF_PATH);
  return OK;
}
