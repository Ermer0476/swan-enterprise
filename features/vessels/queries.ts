import "server-only";
import { prisma } from "@/lib/prisma";

export async function listVessels(companyId: string) {
  return prisma.vessel.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function getVessel(companyId: string, id: string) {
  return prisma.vessel.findFirst({
    where: { id, companyId, deletedAt: null },
  });
}
