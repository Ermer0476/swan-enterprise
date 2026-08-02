"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { AttachmentViewerModal, type AttachmentFile } from "./attachment-viewer-modal";

// Lets a list row (e.g. the Circulars table) preview an attached PDF, or
// open any other file type, without navigating into the record's own detail
// page first — that's the whole point of putting this here instead of just
// linking to the record.
export function AttachmentQuickView({ attachments }: { attachments: AttachmentFile[] }) {
  const [viewing, setViewing] = useState<AttachmentFile | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (attachments.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  function openFile(file: AttachmentFile) {
    setOpen(false);
    if (file.mimeType === "application/pdf") {
      setViewing(file);
    } else {
      window.open(`/api/attachments/${file.id}`, "_blank", "noopener,noreferrer");
    }
  }

  if (attachments.length === 1) {
    const file = attachments[0]!;
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openFile(file);
          }}
          className="inline-flex max-w-[10rem] items-center gap-1 text-accent hover:underline"
        >
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{file.fileName}</span>
        </button>
        {viewing && <AttachmentViewerModal file={viewing} onClose={() => setViewing(null)} />}
      </>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex items-center gap-1 text-accent hover:underline"
      >
        <Paperclip className="h-3.5 w-3.5" />
        <span>{attachments.length} files</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-card p-1 shadow-lg">
          {attachments.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openFile(f);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{f.fileName}</span>
            </button>
          ))}
        </div>
      )}
      {viewing && <AttachmentViewerModal file={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
