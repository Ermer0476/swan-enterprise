"use server";

import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { requireUser, VIEW_AS_ACTIVE_COOKIE, VIEW_AS_VESSEL_COOKIE } from "./auth";

// Dev-only convenience for Administrators testing both sides of the app
// (Office vs Vessel) without a separate login for every check — never
// available to non-Administrator accounts, and never touches the real
// user's own department/vesselId in the database. getCurrentUser() (see
// lib/auth.ts) reads these same two cookies and overrides the returned
// SessionUser's department/vesselId when active.

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24, // a day is plenty for a testing convenience
};

export async function setViewAsModeAction(mode: "OFFICE" | "VESSEL"): Promise<void> {
  const user = await requireUser();
  if (!user.roles.includes("Administrator")) return;

  const jar = await cookies();
  if (mode === "OFFICE") {
    jar.delete(VIEW_AS_ACTIVE_COOKIE);
    return;
  }

  jar.set(VIEW_AS_ACTIVE_COOKIE, "1", cookieOpts);

  // Sticky vessel choice — only picked once, so toggling back and forth
  // between Office and Vessel keeps showing the same ship's data.
  if (!jar.get(VIEW_AS_VESSEL_COOKIE)?.value) {
    const vessel = await prisma.vessel.findFirst({
      where: { companyId: user.companyId, deletedAt: null, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    if (vessel) jar.set(VIEW_AS_VESSEL_COOKIE, vessel.id, cookieOpts);
  }
}

export async function getViewAsDisplay(companyId: string): Promise<{ active: boolean; vesselName: string | null }> {
  const jar = await cookies();
  const active = jar.get(VIEW_AS_ACTIVE_COOKIE)?.value === "1";
  const vesselId = jar.get(VIEW_AS_VESSEL_COOKIE)?.value;
  if (!active || !vesselId) return { active: false, vesselName: null };
  const vessel = await prisma.vessel.findFirst({ where: { id: vesselId, companyId }, select: { name: true } });
  return { active: true, vesselName: vessel?.name ?? null };
}
