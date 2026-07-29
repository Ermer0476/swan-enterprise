"use client";

import { useActionState, useRef, useEffect, useTransition, useState } from "react";
import { useFormStatus } from "react-dom";
import { Paperclip, Trash2, Upload } from "lucide-react";
import {
  uploadAttachmentAction,
  deleteAttachmentAction,
  type ActionResult,
} from "@/features/attachments/actions";
import { Button } from "@/components/ui/button";

export type AttachmentView = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string; // ISO
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Upload className="h-4 w-4" /> {pending ? "Uploading…" : "Upload"}
    </Button>
  );
}

function AttachmentRow({ file, editable }: { file: AttachmentView; editable: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm(`Delete "${file.fileName}"?`)) return;
    const fd = new FormData();
    fd.set("id", file.id);
    startTransition(async () => {
      const res = await deleteAttachmentAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <a
        href={`/api/attachments/${file.id}`}
        className="flex min-w-0 items-center gap-2 text-accent hover:underline"
      >
        <Paperclip className="h-4 w-4 shrink-0" />
        <span className="truncate">{file.fileName}</span>
      </a>
      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        <span>{formatSize(file.sizeBytes)}</span>
        {editable && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label="Delete attachment"
            className="rounded p-1 hover:bg-muted hover:text-danger disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </li>
  );
}

export function AttachmentList({
  entityType,
  entityId,
  attachments,
  editable,
}: {
  entityType: string;
  entityId: string;
  attachments: AttachmentView[];
  editable: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    uploadAttachmentAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="space-y-3">
      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files attached yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {attachments.map((a) => (
            <AttachmentRow key={a.id} file={a} editable={editable} />
          ))}
        </ul>
      )}

      {editable && (
        <form
          ref={formRef}
          action={formAction}
          className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3"
        >
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={entityId} />
          <input
            type="file"
            name="file"
            required
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.zip"
            className="max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
          />
          <UploadButton />
          {state.error && <p className="w-full text-sm text-danger">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
