import "server-only";
import * as XLSX from "xlsx";
import { listUsers, type UserFilters } from "./queries";
import { ageFromBirthDate, yearsOfServiceFromDateHired } from "./derive";

/**
 * Employee Masterlist export (E2).
 *
 * Builds an .xlsx workbook from the same company-scoped, soft-delete-filtered
 * read every other User Management screen uses (`listUsers`), so the export can
 * never widen what the caller is allowed to see. The column order is the
 * client's masterlist template verbatim — the import parser (E2) locates its
 * columns by these same labels, so a file exported here round-trips straight
 * back in.
 *
 * AGE and YEARS OF SERVICE are DERIVED at export time from the stored
 * birth/hire dates (never stored, so they cannot drift) via the same
 * render-only helpers the profile page uses. `passwordHash` is structurally
 * unreachable here: `listUsers` selects an explicit field list that never names
 * it, so it cannot ride along into the workbook.
 */

// The client's masterlist column order, verbatim. The import parser matches on
// these labels (case- and punctuation-insensitively), so the two must agree.
const HEADERS = [
  "#",
  "LAST",
  "FIRST",
  "MIDDLE",
  "INITIALS",
  "GENDER",
  "EMPLOYEE ID",
  "Employment Status",
  "DESIGNATION",
  "BIRTHDATE",
  "DATE HIRED",
  "AGE",
  "YEARS OF SERVICE",
  "OFFICIAL ADDRESS",
  "TIN",
  "SSS",
  "HDMF",
  "PHIL-HEALTH",
] as const;

// Column widths, index-aligned with HEADERS, so the sheet opens readable.
const COL_WIDTHS = [4, 18, 16, 16, 8, 8, 14, 16, 20, 12, 12, 6, 8, 34, 16, 14, 14, 14];

/** A stored bare date rendered as `YYYY-MM-DD` in UTC (matching how Prisma
 * stores a date at midnight UTC), or an empty cell. Mirrors the audit date
 * rendering in features/users/actions.ts so exported dates read identically to
 * what the audit log records. */
const isoDate = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : "");

export async function buildUsersExport(
  companyId: string,
  filters: UserFilters,
): Promise<{ buffer: Buffer; rowCount: number }> {
  const users = await listUsers(companyId, filters);

  const dataRows: (string | number)[][] = users.map((u, i) => [
    i + 1,
    u.lastName ?? "",
    u.firstName ?? "",
    u.middleName ?? "",
    u.initials ?? "",
    u.gender ?? "",
    u.employeeId ?? "",
    u.employmentStatus ?? "",
    u.designation ?? "",
    isoDate(u.birthDate),
    isoDate(u.dateHired),
    u.birthDate ? ageFromBirthDate(u.birthDate) : "",
    u.dateHired ? yearsOfServiceFromDateHired(u.dateHired) : "",
    u.officialAddress ?? "",
    u.tin ?? "",
    u.sss ?? "",
    u.hdmf ?? "",
    u.philHealth ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([[...HEADERS], ...dataRows]);
  ws["!cols"] = COL_WIDTHS.map((wch) => ({ wch }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Users");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return { buffer, rowCount: users.length };
}
