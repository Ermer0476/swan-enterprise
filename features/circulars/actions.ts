"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { createCircularSchema } from "./schema";

export type ActionResult = { ok: boolean; error: string | null };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function nextRefNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CIR-${year}-`;
  const count = await prisma.circular.count({
    where: { companyId, refNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createCircularAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("circular:create");
  const parsed = createCircularSchema.safeParse({
    title: formData.get("title"),
    vesselId: formData.get("vesselId"),
    category: formData.get("category"),
    issueDate: formData.get("issueDate"),
    body: formData.get("body"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const circular = await prisma.circular.create({
    data: {
      companyId: user.companyId,
      refNo: await nextRefNo(user.companyId),
      title: d.title,
      vesselId: d.vesselId || null,
      category: d.category,
      issueDate: new Date(d.issueDate),
      body: d.body,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "Circular",
    entityId: circular.id,
    summary: `Issued circular ${circular.refNo} — ${circular.title}`,
  });

  revalidatePath("/circulars");
  redirect(`/circulars/${circular.id}`);
}

export async function deleteCircularAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("circular:delete");
  const id = String(formData.get("circularId") ?? "");
  const circular = await prisma.circular.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!circular) return fail("Circular not found");

  await prisma.circular.update({
    where: { id: circular.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "Circular",
    entityId: circular.id,
    summary: `Deleted circular ${circular.refNo}`,
  });

  revalidatePath("/circulars");
  redirect("/circulars");
}
