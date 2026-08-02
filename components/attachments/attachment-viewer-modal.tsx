"use client";

import { useEffect } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "./pdf-viewer";

export type AttachmentFile = { id: string; fileName: string; mimeType: string };

// PDFs get an in-app viewer, no forced download — other types (Word, Excel,
// zip) have no browser-native renderer, so they still just open/download via
// the plain link; there's nothing a viewer could show.
export function AttachmentViewerModal({ file, onClose }: { file: AttachmentFile; onClose: () => void }) {
  const url = `/api/attachments/${file.id}`;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="min-w-0 truncate text-sm font-medium">{file.fileName}</span>
        <div className="flex shrink-0 items-center gap-2">
          <a href={url} download={file.fileName}>
            <Button type="button" variant="outline" size="sm">
              <Download className="h-4 w-4" /> Download
            </Button>
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close viewer"
            className="rounded p-1.5 hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <PdfViewer url={url} />
    </div>
  );
}
