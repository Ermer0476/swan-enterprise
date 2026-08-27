import { z } from "zod";

// ─── Refusal messages ───────────────────────────────────────────────────────
// Here, not in actions.ts, because a "use server" module may only export async
// functions.

export const DEPARTMENT_NOT_FOUND = "Department not found";
export const DEPARTMENT_SYSTEM_LOCKED =
  "This is a system department and can't be deactivated.";
export const DEPARTMENT_HAS_USERS =
  "This department still has users assigned. Reassign them before deactivating it.";
export function departmentNameTaken(name: string): string {
  return `A department named "${name}" already exists. Reactivate it instead of adding a duplicate.`;
}

// The one fixed axis in the data-driven design. Mirrors the Prisma
// DepartmentSide enum — ship vs shore is a genuine binary and does not grow.
export const DEPARTMENT_SIDES = ["SHIP", "SHORE"] as const;

export const saveDepartmentSchema = z.object({
  departmentId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Name is required").max(60),
  side: z.enum(DEPARTMENT_SIDES, {
    errorMap: () => ({ message: "Choose whether this is a ship or shore department" }),
  }),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export const toggleDepartmentSchema = z.object({
  departmentId: z.string().uuid(),
});

export type SaveDepartmentInput = z.infer<typeof saveDepartmentSchema>;
