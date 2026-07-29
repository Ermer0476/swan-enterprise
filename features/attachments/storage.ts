import "server-only";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

// Local-disk storage for dev/early deployment — outside `public/` so files
// are never served directly, only through the authenticated download route.
// `fileKey` stored in the DB is the path relative to this root, so swapping
// to DigitalOcean Spaces later only means changing these three functions.
//
// Anchored via an explicit env var rather than bare `process.cwd()` — some
// process launchers (dev tooling, certain container/process managers) don't
// guarantee cwd equals the project root, so an implicit default is fragile.
// Falls back to `<cwd>/storage/attachments` for the common case of running
// `npm run dev`/`next start` directly from the project directory.
const STORAGE_ROOT = process.env.ATTACHMENTS_STORAGE_DIR
  ? path.resolve(process.env.ATTACHMENTS_STORAGE_DIR)
  : path.join(process.cwd(), "storage", "attachments");

function attachmentDir(companyId: string, entityType: string, entityId: string): string {
  return path.join(STORAGE_ROOT, companyId, entityType, entityId);
}

export async function saveAttachmentFile(
  companyId: string,
  entityType: string,
  entityId: string,
  storedName: string,
  buffer: Buffer,
): Promise<string> {
  const dir = attachmentDir(companyId, entityType, entityId);
  await mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, storedName);
  await writeFile(fullPath, buffer);
  return path.relative(STORAGE_ROOT, fullPath);
}

export async function readAttachmentFile(fileKey: string): Promise<Buffer> {
  return readFile(path.join(STORAGE_ROOT, fileKey));
}

export async function deleteAttachmentFile(fileKey: string): Promise<void> {
  try {
    await unlink(path.join(STORAGE_ROOT, fileKey));
  } catch {
    // Already gone — deleting the DB row is what matters.
  }
}
