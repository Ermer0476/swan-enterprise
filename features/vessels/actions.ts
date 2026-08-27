"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { vesselSchema } from "./schema";
import { parseShipsParticulars, type ParsedVesselFields } from "./document-parser";

export type ActionResult = { ok: boolean; error: string | null };
const OK: ActionResult = { ok: true, error: null };
const fail = (error: string): ActionResult => ({ ok: false, error });

// Cap an uploaded Ship's Particulars document before buffering it into memory
// and shelling out to pdftotext/tesseract — mirrors MAX_ATTACHMENT_SIZE in
// features/attachments/schema.ts.
const MAX_DOCUMENT_SIZE = 100 * 1024 * 1024; // 100MB

// imo and code are both DB-@unique. They're pre-checked with findFirst above,
// but a concurrent insert between that check and the write still trips the
// unique index (P2002). Run the write through here so that race produces the
// same clean message as the pre-check instead of an uncaught 500. Any other
// error is re-thrown untouched. The write closure keeps the caller's data
// object exactly as written.
async function runVesselWrite<T>(
  code: string | null,
  write: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await write() };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = err.meta?.target;
      const onImo = Array.isArray(target) ? target.includes("imo") : String(target ?? "").includes("imo");
      return { ok: false, error: onImo ? "A vessel with this IMO number already exists" : `Vessel code "${code}" is already in use` };
    }
    throw err;
  }
}

function parseVesselForm(formData: FormData) {
  return vesselSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    imo: formData.get("imo"),
    officialNumber: formData.get("officialNumber"),
    callSign: formData.get("callSign"),
    mmsi: formData.get("mmsi"),
    flag: formData.get("flag"),
    type: formData.get("type"),
    classificationSociety: formData.get("classificationSociety"),
    yearBuilt: formData.get("yearBuilt"),
    grossTonnage: formData.get("grossTonnage"),
    loa: formData.get("loa"),
    breadth: formData.get("breadth"),
    depth: formData.get("depth"),
    status: formData.get("status"),
    archivedAt: formData.get("archivedAt"),
    capacityCbm: formData.get("capacityCbm"),
    netTonnage: formData.get("netTonnage"),
    deadweight: formData.get("deadweight"),
    tradeArea: formData.get("tradeArea"),
    registeredOwner: formData.get("registeredOwner"),
    headOwner: formData.get("headOwner"),
    charterer: formData.get("charterer"),
    yearWithSwan: formData.get("yearWithSwan"),
    lastDryDock: formData.get("lastDryDock"),
    dryDockPlace: formData.get("dryDockPlace"),
    nextDryDockDue: formData.get("nextDryDockDue"),
    portOfRegistry: formData.get("portOfRegistry"),
    lbp: formData.get("lbp"),
    draft: formData.get("draft"),
    mainEngine: formData.get("mainEngine"),
    serviceSpeed: formData.get("serviceSpeed"),
    stdFoConsumptionMt: formData.get("stdFoConsumptionMt"),
    stdDoConsumptionMt: formData.get("stdDoConsumptionMt"),
    navigationArea: formData.get("navigationArea"),
    classNotation: formData.get("classNotation"),
    ownerAddress: formData.get("ownerAddress"),
    builder: formData.get("builder"),
    keelLaidDate: formData.get("keelLaidDate"),
    launchingDate: formData.get("launchingDate"),
    deliveryDate: formData.get("deliveryDate"),
    totalComplement: formData.get("totalComplement"),
    satPhone: formData.get("satPhone"),
    vesselEmail: formData.get("vesselEmail"),
  });
}

export async function createVesselAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("vessel:create");
  const parsed = parseVesselForm(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const existing = d.imo ? await prisma.vessel.findUnique({ where: { imo: d.imo } }) : null;
  if (existing) return fail("A vessel with this IMO number already exists");

  const codeClash = d.code
    ? await prisma.vessel.findFirst({ where: { companyId: user.companyId, code: d.code } })
    : null;
  if (codeClash) return fail(`Vessel code "${d.code}" is already in use`);

  const created = await runVesselWrite(d.code, () => prisma.vessel.create({
    data: {
      companyId: user.companyId,
      name: d.name,
      code: d.code,
      imo: d.imo || null,
      officialNumber: d.officialNumber || null,
      callSign: d.callSign || null,
      mmsi: d.mmsi || null,
      flag: d.flag || null,
      type: d.type,
      classificationSociety: d.classificationSociety || null,
      yearBuilt: d.yearBuilt ?? null,
      grossTonnage: d.grossTonnage ?? null,
      loa: d.loa ?? null,
      breadth: d.breadth ?? null,
      depth: d.depth ?? null,
      status: d.status,
      capacityCbm: d.capacityCbm ?? null,
      netTonnage: d.netTonnage ?? null,
      deadweight: d.deadweight ?? null,
      tradeArea: d.tradeArea || null,
      registeredOwner: d.registeredOwner || null,
      headOwner: d.headOwner || null,
      charterer: d.charterer || null,
      yearWithSwan: d.yearWithSwan ?? null,
      lastDryDock: d.lastDryDock ?? null,
      dryDockPlace: d.dryDockPlace || null,
      nextDryDockDue: d.nextDryDockDue ?? null,
      portOfRegistry: d.portOfRegistry || null,
      lbp: d.lbp ?? null,
      draft: d.draft ?? null,
      mainEngine: d.mainEngine || null,
      serviceSpeed: d.serviceSpeed ?? null,
      stdFoConsumptionMt: d.stdFoConsumptionMt ?? null,
      stdDoConsumptionMt: d.stdDoConsumptionMt ?? null,
      navigationArea: d.navigationArea || null,
      classNotation: d.classNotation || null,
      ownerAddress: d.ownerAddress || null,
      builder: d.builder || null,
      keelLaidDate: d.keelLaidDate ?? null,
      launchingDate: d.launchingDate ?? null,
      deliveryDate: d.deliveryDate ?? null,
      totalComplement: d.totalComplement ?? null,
      satPhone: d.satPhone || null,
      vesselEmail: d.vesselEmail || null,
      archivedAt: d.status === "SOLD" ? (d.archivedAt ?? new Date()) : null,
      createdBy: user.id,
      updatedBy: user.id,
    },
  }));
  if (!created.ok) return fail(created.error);
  const vessel = created.value;

  await writeAudit({
    actor: user,
    action: "CREATE",
    entityType: "Vessel",
    entityId: vessel.id,
    summary: `Added vessel ${vessel.name}${vessel.imo ? ` (IMO ${vessel.imo})` : ""}`,
  });

  revalidatePath("/vessels");
  redirect(`/vessels/${vessel.id}`);
}

export async function updateVesselAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("vessel:update");
  const id = String(formData.get("vesselId") ?? "");
  const parsed = parseVesselForm(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const d = parsed.data;

  const vessel = await prisma.vessel.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!vessel) return fail("Vessel not found");

  const imoClash = d.imo
    ? await prisma.vessel.findFirst({ where: { imo: d.imo, id: { not: id } } })
    : null;
  if (imoClash) return fail("A vessel with this IMO number already exists");

  const codeClash = d.code
    ? await prisma.vessel.findFirst({
        where: { companyId: user.companyId, code: d.code, id: { not: id } },
      })
    : null;
  if (codeClash) return fail(`Vessel code "${d.code}" is already in use`);

  // Track exactly when a vessel leaves the fleet (needed for the "under
  // management by year" history chart and to cap Exposure Hours accrual,
  // not just its current status). The office can enter the real sale date
  // explicitly; otherwise keep what's already on file, or default to today.
  const archivedAt =
    d.status === "SOLD" ? (d.archivedAt ?? vessel.archivedAt ?? new Date()) : null;

  const updated = await runVesselWrite(d.code, () => prisma.vessel.update({
    where: { id: vessel.id },
    data: {
      name: d.name,
      code: d.code,
      imo: d.imo || null,
      officialNumber: d.officialNumber || null,
      callSign: d.callSign || null,
      mmsi: d.mmsi || null,
      flag: d.flag || null,
      type: d.type,
      classificationSociety: d.classificationSociety || null,
      yearBuilt: d.yearBuilt ?? null,
      grossTonnage: d.grossTonnage ?? null,
      loa: d.loa ?? null,
      breadth: d.breadth ?? null,
      depth: d.depth ?? null,
      status: d.status,
      capacityCbm: d.capacityCbm ?? null,
      netTonnage: d.netTonnage ?? null,
      deadweight: d.deadweight ?? null,
      tradeArea: d.tradeArea || null,
      registeredOwner: d.registeredOwner || null,
      headOwner: d.headOwner || null,
      charterer: d.charterer || null,
      yearWithSwan: d.yearWithSwan ?? null,
      lastDryDock: d.lastDryDock ?? null,
      dryDockPlace: d.dryDockPlace || null,
      nextDryDockDue: d.nextDryDockDue ?? null,
      portOfRegistry: d.portOfRegistry || null,
      lbp: d.lbp ?? null,
      draft: d.draft ?? null,
      mainEngine: d.mainEngine || null,
      serviceSpeed: d.serviceSpeed ?? null,
      stdFoConsumptionMt: d.stdFoConsumptionMt ?? null,
      stdDoConsumptionMt: d.stdDoConsumptionMt ?? null,
      navigationArea: d.navigationArea || null,
      classNotation: d.classNotation || null,
      ownerAddress: d.ownerAddress || null,
      builder: d.builder || null,
      keelLaidDate: d.keelLaidDate ?? null,
      launchingDate: d.launchingDate ?? null,
      deliveryDate: d.deliveryDate ?? null,
      totalComplement: d.totalComplement ?? null,
      satPhone: d.satPhone || null,
      vesselEmail: d.vesselEmail || null,
      archivedAt,
      updatedBy: user.id,
    },
  }));
  if (!updated.ok) return fail(updated.error);

  await writeAudit({
    actor: user,
    action: "UPDATE",
    entityType: "Vessel",
    entityId: vessel.id,
    summary: `Updated vessel particulars for ${vessel.name}`,
  });

  revalidatePath(`/vessels/${vessel.id}`);
  revalidatePath("/vessels");
  return OK;
}

export async function deleteVesselAction(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("vessel:delete");
  const id = String(formData.get("vesselId") ?? "");

  const vessel = await prisma.vessel.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!vessel) return fail("Vessel not found");

  await prisma.vessel.update({
    where: { id: vessel.id },
    data: { deletedAt: new Date(), deletedBy: user.id },
  });

  await writeAudit({
    actor: user,
    action: "DELETE",
    entityType: "Vessel",
    entityId: vessel.id,
    summary: `Removed vessel ${vessel.name}${vessel.imo ? ` (IMO ${vessel.imo})` : ""}`,
  });

  revalidatePath("/vessels");
  redirect("/vessels");
}

export type ParseVesselDocumentResult = {
  ok: boolean;
  error: string | null;
  fields: ParsedVesselFields;
};

const execFileAsync = promisify(execFile);

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/** Real (non-scanned) PDF text layer via poppler's pdftotext — cheap and
 * exact when it exists. Ship's Particulars sheets are very often a scan of
 * a signed/stamped printout though, in which case this returns nothing and
 * the caller falls back to OCR. (pdfjs-dist can do this in-process, but its
 * Node "fake worker" can't resolve its own worker file once Next bundles
 * the server code — shelling out to poppler sidesteps that entirely.) */
async function extractPdfTextLayer(pdfPath: string): Promise<string> {
  const { stdout } = await execFileAsync("pdftotext", ["-layout", pdfPath, "-"]);
  return stdout;
}

/** OCR fallback for scanned Ship's Particulars sheets, which is what these
 * usually are in practice. Renders each page to a PNG via poppler's
 * pdftoppm, then reads it with Tesseract — both are system binaries
 * (Homebrew: `poppler`, `tesseract`), not npm packages. */
async function extractPdfTextViaOcr(pdfPath: string, dir: string): Promise<string> {
  // A Ship's Particulars sheet is a single page — the 3-page cap just
  // bounds the cost if something else gets uploaded by mistake.
  // 600 dpi, not 300 — at 300 dpi Tesseract frequently misreads the colon
  // in "LABEL : value" as a stray digit, "=", "~", or ">", or drops it
  // entirely on a lower-quality scan. The extra render/OCR time (a few
  // seconds) is negligible for a one-page document.
  await execFileAsync("pdftoppm", ["-png", "-r", "600", "-l", "3", pdfPath, path.join(dir, "page")]);
  const { readdir } = await import("fs/promises");
  const pages = (await readdir(dir)).filter((f) => f.endsWith(".png")).sort();
  let text = "";
  for (const page of pages) {
    const outBase = path.join(dir, path.basename(page, ".png"));
    await execFileAsync("tesseract", [path.join(dir, page), outBase, "--psm", "6"]);
    text += (await readFile(`${outBase}.txt`, "utf8")) + "\n";
  }
  return text;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vessel-doc-"));
  try {
    const pdfPath = path.join(dir, "input.pdf");
    await writeFile(pdfPath, buffer);
    const direct = await extractPdfTextLayer(pdfPath);
    if (direct.trim()) return direct;
    return await extractPdfTextViaOcr(pdfPath, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Reads an uploaded Ship's Particulars document (.docx or .pdf) and returns
 * parsed field values — nothing is saved here. The vessel form pre-fills
 * with these values so the office reviews/corrects them before "Save
 * changes" / "Add vessel" actually persists anything, same review-before-
 * commit pattern as the SIRE document import.
 */
export async function parseVesselDocumentAction(
  _prev: ParseVesselDocumentResult,
  formData: FormData,
): Promise<ParseVesselDocumentResult> {
  await requirePermission("vessel:update");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload", fields: {} };
  }

  const name = file.name.toLowerCase();
  const isDocx = name.endsWith(".docx");
  const isPdf = name.endsWith(".pdf");
  if (!isDocx && !isPdf) {
    return { ok: false, error: "Only Word (.docx) or PDF (.pdf) files are supported", fields: {} };
  }

  if (file.size > MAX_DOCUMENT_SIZE) {
    return { ok: false, error: "File is too large (maximum 100 MB)", fields: {} };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    text = isDocx ? await extractDocxText(buffer) : await extractPdfText(buffer);
  } catch {
    return { ok: false, error: "Could not read this document — it may be corrupted", fields: {} };
  }

  if (!text.trim()) {
    return { ok: false, error: "No readable text found in this document", fields: {} };
  }

  const { fields, foundCount } = parseShipsParticulars(text);
  if (foundCount === 0) {
    return {
      ok: false,
      error: "No recognizable Ship's Particulars fields were found in this document",
      fields: {},
    };
  }
  return { ok: true, error: null, fields };
}
