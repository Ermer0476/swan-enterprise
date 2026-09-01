"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { composeFullName, masterlistImportRowSchema } from "./schema";
import { parseUserImportWorkbook, type ParsedUserRow, type FlaggedUserRow, type ImportCounts } from "./masterlist-import-parser";

// ─── Shared guards, duplicated on purpose ────────────────────────────────────
// A "use server" module may only export async functions, so these mirror the
// values in features/users/actions.ts (SHORE_ONLY) and
// features/procurement/inventory-import-actions.ts (the upload limit) rather
// than reaching across a module boundary for one constant each.

/** User management is an office-only function — same wording, same reason as
 * SHORE_ONLY in actions.ts: the legacy department signal (SHIPBOARD) is what
 * lib/user-access.ts still treats as shipboard, and a shipboard login
 * administering accounts is out of scope. */
const SHORE_ONLY = "User management is available from an office account only.";

/** Cap the upload before buffering the whole workbook — mirrors the procurement
 * importer's MAX_IMPORT_FILE_SIZE (itself a copy of MAX_ATTACHMENT_SIZE). */
const MAX_IMPORT_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Department stamped on an account CREATED by import. The sheet carries no
 * department column, so one is supplied by doctrine. `department` is the legacy
 * security signal (SHIPBOARD ⇒ vessel scope, and it can match a
 * WorkflowStep.approverDept), so the imported account is deliberately NOT put on
 * SHIPBOARD: it is a shore masterlist record. ADMIN is a neutral shore value;
 * the account's actual authority is floored by its minimal role (fewest
 * permissions) and the guest access level, and an administrator can correct the
 * department afterwards on the edit page. Existing accounts keep their own
 * department — import never changes it.
 */
const IMPORT_DEFAULT_DEPARTMENT = "ADMIN" as const;

// ─── Step 1: parse (no writes) ───────────────────────────────────────────────

export type ParseUserImportResult = {
  ok: boolean;
  error: string | null;
  rows: ParsedUserRow[];
  flagged: FlaggedUserRow[];
  counts: ImportCounts;
};

const EMPTY_COUNTS: ImportCounts = { total: 0, parsed: 0, flagged: 0 };
const parseFail = (error: string): ParseUserImportResult => ({
  ok: false,
  error,
  rows: [],
  flagged: [],
  counts: EMPTY_COUNTS,
});

/**
 * Reads the uploaded masterlist and hands the parsed + flagged rows back for
 * review. Nothing is written here — that is commitUserImportAction's job, only
 * after the admin confirms.
 */
export async function parseUserImportAction(
  _prev: ParseUserImportResult,
  formData: FormData,
): Promise<ParseUserImportResult> {
  const actor = await requirePermission("admin:manage-users");
  if (actor.department === "SHIPBOARD") return parseFail(SHORE_ONLY);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return parseFail("Choose a file to upload");
  if (!/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
    return parseFail("Only Excel files (.xlsx, .xls, .xlsm) are supported");
  }
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return parseFail("File is too large (maximum 100 MB)");
  }

  // Buffer only AFTER the size check has passed.
  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, flagged, counts, error } = parseUserImportWorkbook(buffer);
  if (error) return parseFail(error);
  if (rows.length === 0 && flagged.length === 0) {
    return parseFail("No employee rows were found under the masterlist header.");
  }

  return { ok: true, error: null, rows, flagged, counts };
}

// ─── Step 2: commit (writes, per-row isolation) ──────────────────────────────

export type UserImportOutcome = "created" | "updated" | "skipped" | "error";

export type UserImportRowResult = {
  rowNo: number;
  employeeId: string | null;
  outcome: UserImportOutcome;
  message: string;
};

export type CommitUserImportResult = {
  ok: boolean;
  error: string | null;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  results: UserImportRowResult[];
};

const commitFail = (error: string): CommitUserImportResult => ({
  ok: false,
  error,
  created: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  results: [],
});

// The shape the client posts back after review — every field a string or null,
// exactly as the parser emitted it. Kept loose here (the authoritative field
// validation is masterlistImportRowSchema, applied per row below); this only
// gives the JSON a type without an `any`.
const incomingRowSchema = z.object({
  rowNo: z.number().optional(),
  lastName: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  middleName: z.string().nullable().optional(),
  initials: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  employeeId: z.string().nullable().optional(),
  employmentStatus: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  dateHired: z.string().nullable().optional(),
  officialAddress: z.string().nullable().optional(),
  tin: z.string().nullable().optional(),
  sss: z.string().nullable().optional(),
  hdmf: z.string().nullable().optional(),
  philHealth: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});
type IncomingRow = z.infer<typeof incomingRowSchema>;

/** Prisma unique-constraint violation — the race a pre-check cannot win. Same
 * shape used in features/users/actions.ts. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

/** A random one-time password for a newly-created account. Long and url-safe:
 * comfortably over the 8-char minimum, well under the 72-byte bcrypt cap. Only
 * its hash is stored; the plaintext never leaves this function and is never
 * returned, audited or logged (the account is forced to set its own via
 * mustChangePassword). */
function tempPassword(): string {
  return randomBytes(18).toString("base64url");
}

/** The masterlist fields as the E1 field schema expects them: the parser's
 * `null` becomes `undefined` so `optText`/`phGovId`/`optDate`/`emailField`'s
 * `.optional()` accepts a missing value instead of rejecting a `null`. */
function toSchemaInput(row: IncomingRow) {
  return {
    lastName: row.lastName ?? undefined,
    firstName: row.firstName ?? undefined,
    middleName: row.middleName ?? undefined,
    initials: row.initials ?? undefined,
    gender: row.gender ?? undefined,
    employeeId: row.employeeId ?? undefined,
    employmentStatus: row.employmentStatus ?? undefined,
    designation: row.designation ?? undefined,
    birthDate: row.birthDate ?? undefined,
    dateHired: row.dateHired ?? undefined,
    officialAddress: row.officialAddress ?? undefined,
    tin: row.tin ?? undefined,
    sss: row.sss ?? undefined,
    hdmf: row.hdmf ?? undefined,
    philHealth: row.philHealth ?? undefined,
    email: row.email ?? undefined,
  };
}

/**
 * Writes the reviewed masterlist rows.
 *
 * Dedupe / skip rules, per row, each in its OWN try/catch so one bad row never
 * rolls back the rest (there is deliberately no wrapping transaction):
 *
 *  - employeeId blank                      → SKIP (nothing to match or create on)
 *  - employeeId matches a live account     → UPDATE its masterlist fields ONLY
 *      (never password, roles, accessLevel or the `department` security signal)
 *  - employeeId new, row has an email       → CREATE a guest account with a
 *      minimal role and a one-time password (mustChangePassword), same doctrine
 *      as createUserAction
 *  - employeeId new, no email               → SKIP (nothing to create an account with)
 *  - any field fails the E1 field rules     → error (that row only)
 *
 * `fullName` is recomposed with composeFullName so it stays in step with the
 * name parts on both paths.
 */
export async function commitUserImportAction(
  _prev: CommitUserImportResult,
  formData: FormData,
): Promise<CommitUserImportResult> {
  const actor = await requirePermission("admin:manage-users");
  if (actor.department === "SHIPBOARD") return commitFail(SHORE_ONLY);

  let incoming: IncomingRow[];
  try {
    incoming = z.array(incomingRowSchema).min(1).parse(JSON.parse(String(formData.get("rows") ?? "[]")));
  } catch {
    return commitFail("No rows to import");
  }

  // Resolved once, shared by every CREATE this run. The guest access level and
  // a minimal role are looked up by their meaning, not hard-coded ids: the
  // guest level by name, the minimal role as this company's role with the
  // fewest permissions (ties broken by name) — the least authority an account
  // can be given while still being able to sign in.
  const guest = await prisma.accessLevel.findFirst({
    where: { companyId: actor.companyId, name: { equals: "guest", mode: "insensitive" } },
    select: { id: true },
  });
  const roles = await prisma.role.findMany({
    where: { companyId: actor.companyId },
    select: { id: true, name: true, _count: { select: { permissions: true } } },
  });
  roles.sort((a, b) => a._count.permissions - b._count.permissions || a.name.localeCompare(b.name));
  const minimalRole = roles[0] ?? null;

  const results: UserImportRowResult[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < incoming.length; i++) {
    const row = incoming[i]!;
    const rowNo = row.rowNo ?? i + 1;
    const employeeId = (row.employeeId ?? "").trim() || null;

    const push = (outcome: UserImportOutcome, message: string) => {
      results.push({ rowNo, employeeId, outcome, message });
      if (outcome === "created") created++;
      else if (outcome === "updated") updated++;
      else if (outcome === "skipped") skipped++;
      else errors++;
    };

    try {
      // A row with no employee ID can neither be matched nor safely created.
      if (!employeeId) {
        push("skipped", "No employee ID — cannot match an existing account or create a new one");
        continue;
      }

      const parsed = masterlistImportRowSchema.safeParse(toSchemaInput(row));
      if (!parsed.success) {
        push("error", parsed.error.issues[0]?.message ?? "This row has an invalid value");
        continue;
      }
      const d = parsed.data;

      // Live, company-scoped match — a soft-deleted account never blocks a reuse
      // and never gets silently resurrected. Same rule as employeeIdTaken.
      const existing = await prisma.user.findFirst({
        where: { companyId: actor.companyId, deletedAt: null, employeeId },
        select: { id: true, fullName: true },
      });

      const composed = composeFullName(d);

      if (existing) {
        // UPDATE — masterlist fields only. Password, roles, accessLevelId and
        // the department security signal are deliberately absent from this data.
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            fullName: composed ?? existing.fullName,
            lastName: d.lastName || null,
            firstName: d.firstName || null,
            middleName: d.middleName || null,
            initials: d.initials || null,
            gender: d.gender || null,
            employmentStatus: d.employmentStatus || null,
            designation: d.designation || null,
            birthDate: d.birthDate,
            dateHired: d.dateHired,
            officialAddress: d.officialAddress || null,
            tin: d.tin || null,
            sss: d.sss || null,
            hdmf: d.hdmf || null,
            philHealth: d.philHealth || null,
            updatedBy: actor.id,
          },
        });
        push("updated", `Updated masterlist fields for ${composed ?? existing.fullName}`);
        continue;
      }

      // CREATE — needs an email to become a real, sign-in-able account.
      const email = d.email;
      if (!email) {
        push("skipped", "No existing account for this employee ID, and no email to create one");
        continue;
      }
      // A new account must have a name and something to grant it.
      if (!composed) {
        push("error", "Cannot create a new account without a name (LAST / FIRST)");
        continue;
      }
      if (!minimalRole) {
        push("error", "No role exists to assign — create a role before importing new accounts");
        continue;
      }

      // Global email uniqueness (User.email is unique across the whole table).
      const emailClash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (emailClash) {
        push("error", "That email address is already registered");
        continue;
      }

      try {
        await prisma.user.create({
          data: {
            companyId: actor.companyId,
            fullName: composed,
            email,
            passwordHash: await hashPassword(tempPassword()),
            department: IMPORT_DEFAULT_DEPARTMENT,
            employeeId,
            accessLevelId: guest?.id ?? null,
            lastName: d.lastName || null,
            firstName: d.firstName || null,
            middleName: d.middleName || null,
            initials: d.initials || null,
            gender: d.gender || null,
            employmentStatus: d.employmentStatus || null,
            designation: d.designation || null,
            birthDate: d.birthDate,
            dateHired: d.dateHired,
            officialAddress: d.officialAddress || null,
            tin: d.tin || null,
            sss: d.sss || null,
            hdmf: d.hdmf || null,
            philHealth: d.philHealth || null,
            active: true,
            mustChangePassword: true,
            createdBy: actor.id,
            updatedBy: actor.id,
            roles: { create: [{ roleId: minimalRole.id }] },
          },
        });
        push("created", `Created ${composed} (${email}) with guest access and role "${minimalRole.name}"`);
      } catch (err) {
        if (isUniqueViolation(err)) {
          push("error", "That email address is already registered");
        } else {
          throw err;
        }
      }
    } catch {
      // Any unexpected failure is contained to this row; the loop continues.
      push("error", "Could not import this row");
    }
  }

  await writeAudit({
    actor,
    action: "CREATE",
    entityType: "User",
    summary:
      `${actor.fullName} imported an employee masterlist — ` +
      `${created} created, ${updated} updated, ${skipped} skipped, ${errors} error(s)`,
    metadata: { created, updated, skipped, errors, rows: incoming.length },
  });

  revalidatePath("/settings/users");

  return { ok: true, error: null, created, updated, skipped, errors, results };
}
