import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { DepartmentType } from "@/lib/generated/prisma";
import type { PermissionKey } from "./permissions";

const COOKIE = "swan_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-insecure-secret",
);

export type SessionUser = {
  id: string;
  companyId: string;
  fullName: string;
  email: string;
  department: DepartmentType;
  rank: string | null;
  vesselId: string | null;
  roles: string[];
  permissions: Set<PermissionKey>;
};

// ─── Passwords ──────────────────────────────────────────────────────────────
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── Session token (JWT in an httpOnly cookie) ────────────────────────────────
async function signToken(userId: string): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

/** Call from a Server Action after verifying credentials. */
export async function startSession(userId: string): Promise<void> {
  const token = await signToken(userId);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Returns the logged-in user (fresh from DB, with roles + permissions) or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  let uid: string;
  try {
    const { payload } = await jwtVerify(token, secret);
    uid = payload.uid as string;
  } catch {
    return null;
  }
  if (!uid) return null;

  const user = await prisma.user.findFirst({
    where: { id: uid, active: true, deletedAt: null },
    include: {
      roles: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });
  if (!user) return null;

  const permissions = new Set<PermissionKey>();
  const roleNames: string[] = [];
  for (const ur of user.roles) {
    roleNames.push(ur.role.name);
    for (const rp of ur.role.permissions) {
      permissions.add(rp.permission.key as PermissionKey);
    }
  }

  return {
    id: user.id,
    companyId: user.companyId,
    fullName: user.fullName,
    email: user.email,
    department: user.department,
    rank: user.rank,
    vesselId: user.vesselId,
    roles: roleNames,
    permissions,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
