"use client";

import { useActionState, useRef, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { FileUp } from "lucide-react";
import {
  parseRaDocumentAction,
  bulkReplaceHazardRowsAction,
  type ParseRaDocumentResult,
} from "@/features/risk/actions";
import type { ParsedHazardRowDraft } from "@/features/risk/document-parser";
import type { RiskScaleLabels } from "@/features/risk/schema";
import { DraftCard } from "../hazard-row-draft-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";

function ParseButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <FileUp className="h-4 w-4" /> {pending ? "Reading document…" : "Parse document"}
    </Button>
  );
}

export function HazardRowsImportPanel({ revisionId, scaleLabels }: { revisionId: string; scaleLabels: RiskScaleLabels }) {
  const [parseState, parseAction] = useActionState<ParseRaDocumentResult, FormData>(
    parseRaDocumentAction,
    { ok: false, error: null, rows: [], metadata: { title: null, smsProcedureRefs: null, riskMatrixRef: null, checklistsRequired: null } },
  );
  const [drafts, setDrafts] = useState<ParsedHazardRowDraft[] | null>(null);
  const [confirming, startConfirming] = useTransition();
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const fileFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (parseState.ok && parseState.rows.length > 0) {
      setDrafts(parseState.rows);
    }
  }, [parseState]);

  function updateDraft(index: number, next: ParsedHazardRowDraft) {
    setDrafts((prev) => (prev ? prev.map((d, i) => (i === index ? next : d)) : prev));
  }

  function removeDraft(index: number) {
    setDrafts((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  function cancel() {
    setDrafts(null);
    setConfirmError(null);
    fileFormRef.current?.reset();
  }

  function confirm() {
    if (!drafts || drafts.length === 0) return;
    setConfirmError(null);
    const fd = new FormData();
    fd.set("revisionId", revisionId);
    fd.set("rows", JSON.stringify(drafts));
    startConfirming(async () => {
      const res = await bulkReplaceHazardRowsAction(fd);
      if (!res.ok) {
        setConfirmError(res.error);
        return;
      }
      cancel();
    });
  }

  if (drafts && drafts.length > 0) {
    return (
      <div className="space-y-4 rounded-md border border-dashed border-accent/40 p-4">
        <p className="text-sm font-semibold">
          Review {drafts.length} hazard row{drafts.length === 1 ? "" : "s"} found in the document
        </p>
        <p className="text-xs text-muted-foreground">
          Check each one before replacing — fix anything the reader got wrong, or remove a row entirely. This
          replaces every master hazard row currently in this draft; any vessel-added rows are not affected.
        </p>
        <div className="space-y-3">
          {drafts.map((d, i) => (
            <DraftCard key={i} draft={d} index={i} scaleLabels={scaleLabels} onChange={updateDraft} onRemove={removeDraft} />
          ))}
        </div>
        {confirmError && <p className="text-sm text-danger">{confirmError}</p>}
        <div className="flex items-center gap-2">
          <Button type="button" disabled={confirming} onClick={confirm}>
            {confirming ? "Replacing…" : `Replace hazard rows with these (${drafts.length})`}
          </Button>
          <Button type="button" variant="ghost" disabled={confirming} onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={fileFormRef}
      action={parseAction}
      className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-4"
    >
      <div className="space-y-1">
        <Label className="text-xs">Upload revised RA document (.docx)</Label>
        <input
          type="file"
          name="file"
          required
          accept=".docx"
          className="max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
        />
      </div>
      <ParseButton />
      {parseState.error && <p className="w-full text-sm text-danger">{parseState.error}</p>}
    </form>
  );
}
