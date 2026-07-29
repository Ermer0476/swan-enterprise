import "server-only";
import { prisma } from "@/lib/prisma";

/** All workflow definitions for a company, with ordered steps. */
export async function listDefinitions(companyId: string) {
  return prisma.workflowDefinition.findMany({
    where: { companyId },
    include: { steps: { orderBy: { order: "asc" } } },
    orderBy: { name: "asc" },
  });
}

/** Role names available as step approvers. */
export async function listRoleNames(companyId: string): Promise<string[]> {
  const roles = await prisma.role.findMany({
    where: { companyId },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return roles.map((r) => r.name);
}
