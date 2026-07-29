"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  startSession,
  endSession,
  verifyPassword,
  getCurrentUser,
} from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginState = { error: string | null };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await prisma.user.findFirst({
    where: { email: parsed.data.email.toLowerCase(), deletedAt: null },
  });
  // Constant-ish response: don't reveal whether the email exists.
  if (!user || !user.active) {
    return { error: "Invalid credentials" };
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    return { error: "Invalid credentials" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await startSession(user.id);
  await writeAudit({
    actor: { id: user.id, companyId: user.companyId, fullName: user.fullName },
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
    summary: `${user.fullName} signed in`,
  });

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    await writeAudit({
      actor: user,
      action: "LOGOUT",
      entityType: "User",
      entityId: user.id,
      summary: `${user.fullName} signed out`,
    });
  }
  await endSession();
  redirect("/login");
}
