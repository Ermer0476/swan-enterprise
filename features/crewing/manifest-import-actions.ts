"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { requirePermission, can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { isValidDate } from "@/features/shared/date-rules";
import { formatCrewName, vesselLabel } from "./ui";
import { isCrewId, CREW_ID_FORMAT_MESSAGE } from "./crew-id";
import {
  parseCrewManifestWorkbook,
  type ParsedManifestRow,
  type FlaggedManifestRow,
  type ManifestImportCounts,
} from "./manifest-import-parser";

// ─── Shared guards ───────────────────────────────────────────────────────────
// A "use server" module may only export async functions, so these constants
// mirror the crewing actions (OFFICE_ONLY) and the users importer (the upload
// cap) rather than reaching across a module boundary for one value each.

/** The office-only refusal for a shipboard caller — same wording and reason as
 *  OFFICE_ONLY in features/crewing/actions.ts: the seafarer register in its
 *  entirety is office-only, so import is too. Returned, not thrown. */
const OFFICE_ONLY = "The seafarer register is managed by the crewing office.";

/** The import both creates seafarers AND embarks them, so it needs crew:assign
 *  on top of crew:create. A caller with only crew:create is refused here rather
 *  than left to fail per row — the whole operation is an embark. */
const NEEDS_ASSIGN =
  "Importing a crew manifest embarks each man onto the vessel, which needs the crew-change (sign-on) permission. Ask the crewing desk to run the import.";

/** Cap the upload before buffering the whole workbook — mirrors the users
 *  importer's MAX_IMPORT_FILE_SIZE (itself a copy of MAX_ATTACHMENT_SIZE). */
const MAX_IMPORT_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// ─── Step 1: parse (no writes) ───────────────────────────────────────────────

export type ParseCrewManifestResult = {
  ok: boolean;
  error: string | null;
  vesselName: string | null;
  /** The company vessel the banner resolves to, when exactly one matches — the
   *  UI's default selection, always confirmable/overridable before commit. */
  suggestedVesselId: string | null;
  vessels: VesselOption[];
  rows: ParsedManifestRow[];
  flagged: FlaggedManifestRow[];
  counts: ManifestImportCounts;
};

export type VesselOption = { id: string; name: string; code: string | null };

const EMPTY_COUNTS: ManifestImportCounts = { total: 0, parsed: 0, flagged: 0 };
const parseFail = (error: string): ParseCrewManifestResult => ({
  ok: false,
  error,
  vesselName: null,
  suggestedVesselId: null,
  vessels: [],
  rows: [],
  flagged: [],
  counts: EMPTY_COUNTS,
});

/** Uppercase, strip every non-alphanumeric — the same normalisation the parser
 *  uses on labels, applied here to vessel names for a punctuation-insensitive
 *  banner match. */
function normName(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Best-effort resolution of a manifest banner name to a company vessel. A
 * match is exact, either-way substring (the banner "LPG/C AMAURY NEYRAND"
 * contains the vessel "AMAURY NEYRAND"), or the banner containing the fleet
 * code. Returns the id ONLY when exactly one vessel matches; zero or several
 * (ambiguous) return null and the UI asks the office to choose. Never trusts
 * the name as an authority — this only pre-selects a dropdown.
 */
function suggestVessel(vesselName: string | null, vessels: VesselOption[]): string | null {
  if (!vesselName) return null;
  const target = normName(vesselName);
  if (!target) return null;
  const hits = vessels.filter((v) => {
    const n = normName(v.name);
    const c = v.code ? normName(v.code) : "";
    return (
      (n.length > 0 && (n === target || target.includes(n) || n.includes(target))) ||
      (c.length > 0 && target.includes(c))
    );
  });
  return hits.length === 1 ? hits[0]!.id : null;
}

/**
 * Reads the uploaded manifest and hands the parsed + flagged rows, the detected
 * vessel and the company's vessel list back for review. Nothing is written —
 * that is commitCrewManifestAction's job, only after the office confirms.
 */
export async function parseCrewManifestAction(
  _prev: ParseCrewManifestResult,
  formData: FormData,
): Promise<ParseCrewManifestResult> {
  const actor = await requirePermission("crew:create");
  if (actor.department === "SHIPBOARD") return parseFail(OFFICE_ONLY);
  if (!can(actor, "crew:assign")) return parseFail(NEEDS_ASSIGN);

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
  const { vesselName, rows, flagged, counts, error } = parseCrewManifestWorkbook(buffer);
  if (error) return parseFail(error);
  if (rows.length === 0 && flagged.length === 0) {
    return parseFail("No crew rows were found under the manifest header.");
  }

  const vessels = await prisma.vessel.findMany({
    where: { companyId: actor.companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return {
    ok: true,
    error: null,
    vesselName,
    suggestedVesselId: suggestVessel(vesselName, vessels),
    vessels,
    rows,
    flagged,
    counts,
  };
}

// ─── Step 2: commit (writes, per-row isolation) ──────────────────────────────

export type CrewImportOutcome = "created" | "embarked" | "updated" | "skipped" | "error";

export type CrewImportRowResult = {
  rowNo: number;
  crewCode: string | null;
  name: string;
  outcome: CrewImportOutcome;
  message: string;
};

export type CommitCrewManifestResult = {
  ok: boolean;
  error: string | null;
  vesselLabel: string | null;
  created: number;
  embarked: number;
  updated: number;
  skipped: number;
  errors: number;
  results: CrewImportRowResult[];
};

const commitFail = (error: string): CommitCrewManifestResult => ({
  ok: false,
  error,
  vesselLabel: null,
  created: 0,
  embarked: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  results: [],
});

// The shape the client posts back after review — every field a string or null,
// exactly as the parser emitted it. Loose on purpose (the real per-field rules
// are applied in the loop below); this only gives the JSON a type without `any`.
const incomingRowSchema = z.object({
  rowNo: z.number().optional(),
  crewCode: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  middleName: z.string().nullable().optional(),
  rank: z.string().nullable().optional(),
  rankCode: z.string().nullable().optional(),
  dateEmbarked: z.string().nullable().optional(),
  signOnPort: z.string().nullable().optional(),
});
type IncomingRow = z.infer<typeof incomingRowSchema>;

/** The seafarer's live berth, if any — the row that makes the one-live-ship
 *  invariant true or false. Takes the client (prisma OR a tx) so the same read
 *  serves the outer branch decision and the in-transaction race guard. */
function liveAssignment(
  client: Prisma.TransactionClient | typeof prisma,
  companyId: string,
  seafarerId: string,
) {
  return client.crewAssignment.findFirst({
    where: { companyId, seafarerId, deletedAt: null, actualSignOffDate: null },
    select: { id: true, vesselId: true, vessel: { select: { name: true, code: true } } },
  });
}

/** A live berth appeared between the outer check and the write — a concurrent
 *  embark. Rare (import is one clerk's click), contained to its row. */
class ConcurrentAboard extends Error {}

/** A display name for the result table — surname-first when the name parsed,
 *  else the crew code, else a placeholder. Never a sensitive field. */
function displayName(row: IncomingRow): string {
  if (row.lastName) {
    return formatCrewName(
      {
        lastName: row.lastName,
        firstName: row.firstName ?? "",
        middleName: row.middleName ?? null,
        suffix: null,
      },
      "list",
    );
  }
  return row.crewCode?.trim() || "(unnamed)";
}

/**
 * Writes the reviewed manifest onto the chosen vessel.
 *
 * Every row is handled in its OWN try/catch — there is deliberately no wrapping
 * transaction across rows, so one bad row never rolls back the rest. The only
 * transactions are the two-row atomic writes WITHIN a row (create seafarer +
 * embark; and the race-guarded embark of an existing man).
 *
 * Per row:
 *  - date embarked invalid/missing → error (a manifest berth needs a join date)
 *  - no rank at all                → error (CrewAssignment.rankCode is required)
 *  - no crew ID                    → error (these ids are externally issued;
 *                                    the register does not mint one here)
 *  - crew ID matches a live man     → REUSE him (fill an empty middle name), then
 *                                    embark per the one-ship rule below
 *  - crew ID is new but malformed   → error (a real YY-NNNN is required to file
 *                                    a new man; do not auto-mint an issued id)
 *  - crew ID is new + well-formed   → CREATE the seafarer (needs surname + first
 *                                    name) and embark in one transaction
 *
 * The one-ship invariant, per §6.2 ("a man is on at most one live ship"):
 *  - already aboard THIS vessel     → skip (or update, if his middle name was
 *                                    filled) — never a second embark
 *  - aboard a DIFFERENT vessel      → error, naming the ship; the office must
 *                                    transfer him by hand — import never
 *                                    auto-signs-off or auto-transfers
 */
export async function commitCrewManifestAction(
  _prev: CommitCrewManifestResult,
  formData: FormData,
): Promise<CommitCrewManifestResult> {
  const actor = await requirePermission("crew:create");
  if (actor.department === "SHIPBOARD") return commitFail(OFFICE_ONLY);
  if (!can(actor, "crew:assign")) return commitFail(NEEDS_ASSIGN);

  const vesselId = String(formData.get("vesselId") ?? "").trim();
  if (!vesselId) return commitFail("Choose the vessel this manifest is for.");

  let incoming: IncomingRow[];
  try {
    incoming = z.array(incomingRowSchema).min(1).parse(JSON.parse(String(formData.get("rows") ?? "[]")));
  } catch {
    return commitFail("No rows to import");
  }

  // Resolve the chosen vessel against the actor's OWN company — a foreign,
  // soft-deleted or bogus id all come back null. The resolved row's id is what
  // gets stored, never the raw input.
  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, companyId: actor.companyId, deletedAt: null },
    select: { id: true, name: true, code: true },
  });
  if (!vessel) return commitFail("That vessel could not be found.");
  const vLabel = vesselLabel(vessel);

  const results: CrewImportRowResult[] = [];
  let created = 0;
  let embarked = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < incoming.length; i++) {
    const row = incoming[i]!;
    const rowNo = row.rowNo ?? i + 1;
    const crewCode = (row.crewCode ?? "").trim() || null;
    const name = displayName(row);

    const push = (outcome: CrewImportOutcome, message: string) => {
      results.push({ rowNo, crewCode, name, outcome, message });
      if (outcome === "created") created++;
      else if (outcome === "embarked") embarked++;
      else if (outcome === "updated") updated++;
      else if (outcome === "skipped") skipped++;
      else errors++;
    };

    try {
      // A manifest berth is a man who joined on a date — no date, no embark.
      const dateStr = (row.dateEmbarked ?? "").trim();
      if (!dateStr || !isValidDate(dateStr)) {
        push("error", "Date embarked is missing or not a valid date");
        continue;
      }
      const embarkDate = new Date(dateStr);

      // CrewAssignment.rankCode is required. Prefer the SHIP_POSITIONS code the
      // parser mapped; fall back to the raw manifest rank when it did not match
      // a known code (see the deviation note in the report). No rank at all is
      // an error — there is nothing to file the berth under.
      const rankCode = (row.rankCode ?? "").trim() || (row.rank ?? "").trim() || null;
      if (!rankCode) {
        push("error", "No rank on this row");
        continue;
      }

      // These crew IDs are issued by the manning agent, not minted here, so a
      // row with none cannot be matched or safely created.
      if (!crewCode) {
        push("error", "No crew ID — cannot match or create a seafarer");
        continue;
      }

      // Live, company-scoped match — a soft-deleted seafarer never blocks a
      // reuse and never gets silently resurrected (same rule as crewCodeTaken).
      const existing = await prisma.seafarer.findFirst({
        where: { companyId: actor.companyId, deletedAt: null, crewCode },
        select: { id: true, middleName: true },
      });

      // ── Reuse an existing seafarer ──
      if (existing) {
        // Fill an empty middle name from the manifest; never overwrite one that
        // is already there, and never touch surname/first name (required, set).
        let didUpdate = false;
        const mid = (row.middleName ?? "").trim();
        if (mid && !existing.middleName) {
          await prisma.seafarer.update({
            where: { id: existing.id },
            data: { middleName: mid, updatedBy: actor.id },
          });
          didUpdate = true;
        }

        const live = await liveAssignment(prisma, actor.companyId, existing.id);
        if (live) {
          if (live.vesselId === vessel.id) {
            push(
              didUpdate ? "updated" : "skipped",
              didUpdate
                ? `Already aboard ${vLabel}; filled in his middle name`
                : `Already aboard ${vLabel} — left as is`,
            );
          } else {
            push(
              "error",
              `Already aboard ${vesselLabel(live.vessel)}; transfer him manually rather than importing`,
            );
          }
          continue;
        }

        await embark(actor.companyId, actor.id, existing.id, vessel.id, rankCode, embarkDate, row.signOnPort);
        push("embarked", `Signed on to ${vLabel} on ${dateStr}`);
        continue;
      }

      // ── Create a new seafarer ──
      // The crew ID is externally issued: a malformed one is a data error to fix
      // in the register, not something to auto-mint over.
      if (!isCrewId(crewCode)) {
        push("error", `Crew ID "${crewCode}" is malformed — ${CREW_ID_FORMAT_MESSAGE}`);
        continue;
      }
      const lastName = (row.lastName ?? "").trim();
      const firstName = (row.firstName ?? "").trim();
      if (!lastName || !firstName) {
        push("error", "Cannot create a new seafarer without a surname and first name");
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const seafarer = await tx.seafarer.create({
          data: {
            companyId: actor.companyId,
            crewCode,
            lastName,
            firstName,
            middleName: (row.middleName ?? "").trim() || null,
            createdBy: actor.id,
          },
          select: { id: true },
        });
        await tx.crewAssignment.create({
          data: {
            companyId: actor.companyId,
            seafarerId: seafarer.id,
            vesselId: vessel.id,
            rankCode,
            plannedSignOnDate: embarkDate,
            actualSignOnDate: embarkDate,
            signOnPort: (row.signOnPort ?? "").trim() || null,
            createdBy: actor.id,
          },
        });
      });
      push("created", `Created and signed on to ${vLabel} on ${dateStr}`);
    } catch (err) {
      if (err instanceof ConcurrentAboard) {
        push("error", "He was embarked by another change while importing — re-run to pick him up");
      } else {
        // Any unexpected failure is contained to this row; the loop continues.
        push("error", "Could not import this row");
      }
    }
  }

  await writeAudit({
    actor,
    action: "CREATE",
    entityType: "CrewAssignment",
    summary:
      `${actor.fullName} imported a crew manifest for ${vLabel} — ` +
      `${created} created, ${embarked} embarked, ${updated} updated, ${skipped} skipped, ${errors} error(s)`,
    metadata: { vesselId: vessel.id, created, embarked, updated, skipped, errors, rows: incoming.length },
  });

  revalidatePath("/crewing");
  revalidatePath("/crewing/seafarers");

  return { ok: true, error: null, vesselLabel: vLabel, created, embarked, updated, skipped, errors, results };
}

/**
 * The embark itself, race-guarded. A live berth is re-read INSIDE the
 * transaction (the outer caller already found none); if one appeared, the whole
 * write rolls back and the row is reported rather than double-embarked.
 */
async function embark(
  companyId: string,
  actorId: string,
  seafarerId: string,
  vesselId: string,
  rankCode: string,
  embarkDate: Date,
  signOnPort: string | null | undefined,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const raceLive = await liveAssignment(tx, companyId, seafarerId);
    if (raceLive) throw new ConcurrentAboard();
    await tx.crewAssignment.create({
      data: {
        companyId,
        seafarerId,
        vesselId,
        rankCode,
        plannedSignOnDate: embarkDate,
        actualSignOnDate: embarkDate,
        signOnPort: (signOnPort ?? "").trim() || null,
        createdBy: actorId,
      },
    });
  });
}
