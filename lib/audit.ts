import "server-only";
import { prisma } from "./prisma";
import type { AuditAction } from "@/lib/generated/prisma";
import type { SessionUser } from "./auth";

type AuditInput = {
  actor: Pick<SessionUser, "id" | "companyId" | "fullName"> | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
};

/**
 * Append an immutable audit record. Audit writes must never break the business
 * operation they describe, so failures are swallowed after being logged.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: input.actor?.companyId ?? "system",
        actorId: input.actor?.id ?? null,
        actorName: input.actor?.fullName ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: input.metadata as object | undefined,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log", err);
  }
}
