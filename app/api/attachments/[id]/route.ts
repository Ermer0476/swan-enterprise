import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readAttachmentFile } from "@/features/attachments/storage";

/** Authenticated file download — never served from /public. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const attachment = await prisma.attachment.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = await readAttachmentFile(attachment.fileKey);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": attachment.mimeType,
      // Inline, not attachment — the browser previews PDFs/images/video
      // directly; types it can't render (Word, Excel, zip) still fall back
      // to a download on their own, no extra branching needed here.
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
      "Content-Length": String(attachment.sizeBytes),
    },
  });
}
