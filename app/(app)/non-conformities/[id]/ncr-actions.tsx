"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import {
  deleteNcrAction,
  deleteDraftNcrAction,
  reportDraftNcrAction,
} from "@/features/non-conformities/actions";
import { Button } from "@/components/ui/button";

/** Deletes an already-raised NCR — a permanent action, so it's confirmed first. */
export function DeleteNcrButton({ ncrId }: { ncrId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!confirm("Delete this NCR?")) return;
    setError(null);
    const fd = new FormData();
    fd.set("ncrId", ncrId);
    startTransition(async () => {
      const res = await deleteNcrAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" onClick={submit} disabled={pending}>
        <Trash2 className="h-4 w-4" /> Delete
      </Button>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}

/** Deletes its own Draft — a permanent action, so it's confirmed first. */
export function DeleteDraftNcrButton({ ncrId }: { ncrId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!confirm("Delete this draft? This can't be undone.")) return;
    setError(null);
    const fd = new FormData();
    fd.set("ncrId", ncrId);
    startTransition(async () => {
      const res = await deleteDraftNcrAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" onClick={submit} disabled={pending}>
        <Trash2 className="h-4 w-4" /> Delete Draft
      </Button>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}

/** Submits a Draft — assigns its NCR number and reports it straight to the office (status DRAFT → SUBMITTED_TO_OFFICE). */
export function ReportDraftNcrButton({ ncrId }: { ncrId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("ncrId", ncrId);
    startTransition(async () => {
      const res = await reportDraftNcrAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" onClick={submit} disabled={pending}>
        Submit to Office <ArrowRight className="h-4 w-4" />
      </Button>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
