import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import type {
  WorkflowStep,
  WorkflowDecision,
  WorkflowInstanceStatus,
} from "@/lib/generated/prisma";

// ─── Generic, entity-agnostic approval-workflow engine ──────────────────────
//  The engine knows nothing about SMS, incidents, or any specific module. It
//  advances a WorkflowInstance through the ordered WorkflowSteps of its
//  definition, recording an immutable WorkflowAction at each decision. Callers
//  react to the returned instance status to apply their own side effects.

export type ActiveInstance = {
  id: string;
  status: WorkflowInstanceStatus;
  currentOrder: number;
  steps: WorkflowStep[];
  actions: {
    id: string;
    stepId: string;
    actorName: string;
    decision: WorkflowDecision;
    comment: string | null;
    createdAt: Date;
  }[];
};

/** The active (in-progress) instance for an entity, with steps + history. */
export async function getActiveInstance(
  companyId: string,
  entityType: string,
  entityId: string,
): Promise<ActiveInstance | null> {
  const instance = await prisma.workflowInstance.findFirst({
    where: { companyId, entityType, entityId, status: "IN_PROGRESS" },
    include: {
      definition: { include: { steps: { orderBy: { order: "asc" } } } },
      actions: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!instance) return null;
  return {
    id: instance.id,
    status: instance.status,
    currentOrder: instance.currentOrder,
    steps: instance.definition.steps,
    actions: instance.actions.map((a) => ({
      id: a.id,
      stepId: a.stepId,
      actorName: a.actorName,
      decision: a.decision,
      comment: a.comment,
      createdAt: a.createdAt,
    })),
  };
}

/** The step awaiting a decision, or null if the instance isn't in progress. */
export function currentStep(instance: ActiveInstance): WorkflowStep | null {
  if (instance.status !== "IN_PROGRESS") return null;
  return instance.steps.find((s) => s.order === instance.currentOrder) ?? null;
}

/** Human-readable description of who approves a step. */
export function stepApproverLabel(step: WorkflowStep): string {
  switch (step.approverType) {
    case "ROLE":
      return `Role · ${step.approverRole ?? "—"}`;
    case "DEPARTMENT":
      return `Department · ${step.approverDept ?? "—"}`;
    case "SPECIFIC_USER":
      return "Specific user";
    default:
      return "—";
  }
}

/** Can this user act on the given step? Authorization is defined by the step. */
export function canAct(user: SessionUser, step: WorkflowStep): boolean {
  switch (step.approverType) {
    case "ROLE":
      return !!step.approverRole && user.roles.includes(step.approverRole);
    case "DEPARTMENT":
      return step.approverDept === user.department;
    case "SPECIFIC_USER":
      return step.approverUser === user.id;
    default:
      return false;
  }
}

/**
 * Start a workflow for an entity using the company's active definition for
 * that entity type. Returns the created instance id, or null when no active
 * definition/steps are configured (caller may then fall back / error).
 */
export async function startInstance(
  companyId: string,
  entityType: string,
  entityId: string,
): Promise<string | null> {
  const definition = await prisma.workflowDefinition.findFirst({
    where: { companyId, entityType, active: true },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  const first = definition?.steps[0];
  if (!definition || !first) return null;

  const instance = await prisma.workflowInstance.create({
    data: {
      companyId,
      definitionId: definition.id,
      entityType,
      entityId,
      status: "IN_PROGRESS",
      currentOrder: first.order,
    },
  });
  return instance.id;
}

export type ActResult = {
  status: WorkflowInstanceStatus;
  /** True when this decision finalized the instance (APPROVED or REJECTED). */
  finalized: boolean;
};

/**
 * Record a decision on the current step and advance the instance. Throws
 * FORBIDDEN if the user may not act on the current step. An APPROVE advances to
 * the next step, or finalizes as APPROVED when it was the last step; a REJECT
 * finalizes as REJECTED.
 */
export async function act(
  user: SessionUser,
  instanceId: string,
  decision: WorkflowDecision,
  comment: string | null,
): Promise<ActResult> {
  return prisma.$transaction(async (tx) => {
    const instance = await tx.workflowInstance.findFirst({
      where: { id: instanceId, companyId: user.companyId },
      include: { definition: { include: { steps: { orderBy: { order: "asc" } } } } },
    });
    if (!instance) throw new Error("WORKFLOW_NOT_FOUND");
    if (instance.status !== "IN_PROGRESS") throw new Error("WORKFLOW_NOT_ACTIVE");

    const steps = instance.definition.steps;
    const step = steps.find((s) => s.order === instance.currentOrder);
    if (!step) throw new Error("WORKFLOW_STEP_MISSING");
    if (!canAct(user, step)) throw new Error("FORBIDDEN");

    await tx.workflowAction.create({
      data: {
        instanceId: instance.id,
        stepId: step.id,
        actorId: user.id,
        actorName: user.fullName,
        decision,
        comment: comment || null,
      },
    });

    if (decision === "REJECT") {
      await tx.workflowInstance.update({
        where: { id: instance.id },
        data: { status: "REJECTED" },
      });
      return { status: "REJECTED" as const, finalized: true };
    }

    const next = steps.find((s) => s.order > instance.currentOrder);
    if (next) {
      await tx.workflowInstance.update({
        where: { id: instance.id },
        data: { currentOrder: next.order },
      });
      return { status: "IN_PROGRESS" as const, finalized: false };
    }

    await tx.workflowInstance.update({
      where: { id: instance.id },
      data: { status: "APPROVED" },
    });
    return { status: "APPROVED" as const, finalized: true };
  });
}
