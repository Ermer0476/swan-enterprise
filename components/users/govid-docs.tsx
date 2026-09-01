"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { FileText, Trash2, Upload } from "lucide-react";
import {
  uploadGovIdDocAction,
  removeGovIdDocAction,
  type ActionResult,
} from "@/features/users/govid-docs-actions";
import { Button } from "@/components/ui/button";

export type GovIdDocView = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type GovIdItem = {
  /** Discriminator, e.g. "TIN" | "SSS" | "HDMF" | "PHILHEALTH". */
  type: string;
  label: string;
  /** Whether the ID number itself is on file (shown as presence, never the value). */
  numberOnFile: boolean;
  doc: GovIdDocView | null;
};

// Mirrors the server allow-list (PDF + PNG/JPG/WEBP). This only narrows the
// file picker; the server re-validates MIME + extension on every upload.
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";

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

function GovIdRow({
  userId,
  item,
  editable,
}: {
  userId: string;
  item: GovIdItem;
  editable: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    uploadGovIdDocAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const [removing, startRemove] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  function remove() {
    if (!item.doc) return;
    const fd = new FormData();
    fd.set("id", item.doc.id);
    startRemove(async () => {
      const res = await removeGovIdDocAction(fd);
      if (!res.ok) setRemoveError(res.error);
      setConfirming(false);
    });
  }

  return (
    <div className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{item.label}</span>
        <span className="text-muted-foreground">
          {item.numberOnFile ? "On file" : "Not provided"}
        </span>
      </div>

      {item.doc ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
          <a
            href={`/api/attachments/${item.doc.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-2 text-accent hover:underline"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.doc.fileName}</span>
          </a>
          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            {confirming ? (
              <>
                <span>Remove this document?</span>
                <button
                  type="button"
                  onClick={remove}
                  disabled={removing}
                  className="font-medium text-danger hover:underline disabled:opacity-50"
                >
                  {removing ? "Removing…" : "Yes"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={removing}
                  className="hover:underline disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span>{formatSize(item.doc.sizeBytes)}</span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    aria-label={`Remove ${item.label} document`}
                    className="rounded p-1 hover:bg-muted hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No document uploaded.</p>
      )}
      {removeError && <p className="text-xs text-danger">{removeError}</p>}

      {editable && (
        <form
          ref={formRef}
          action={formAction}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="govIdType" value={item.type} />
          <input
            type="file"
            name="file"
            required
            accept={ACCEPT}
            className="max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
          />
          <UploadButton />
          {state.error && <p className="w-full text-sm text-danger">{state.error}</p>}
        </form>
      )}
    </div>
  );
}

export function GovIdDocs({
  userId,
  items,
  editable,
}: {
  userId: string;
  items: GovIdItem[];
  editable: boolean;
}) {
  return (
    <div className="divide-y divide-border">
      {items.map((item) => (
        <GovIdRow key={item.type} userId={userId} item={item} editable={editable} />
      ))}
    </div>
  );
}
