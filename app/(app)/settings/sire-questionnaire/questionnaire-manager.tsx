"use client";

import { useActionState, useRef, useEffect, useTransition, useState } from "react";
import { useFormStatus } from "react-dom";
import { Upload, FileQuestion, CheckCircle2, Trash2 } from "lucide-react";
import {
  uploadQuestionnaireVersionAction,
  activateVersionAction,
  deleteVersionAction,
  type ActionResult,
} from "@/features/sire-questionnaire/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export type VersionView = {
  id: string;
  label: string;
  isActive: boolean;
  itemCount: number;
  createdAt: string; // ISO
};

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Upload className="h-4 w-4" /> {pending ? "Uploading…" : "Upload version"}
    </Button>
  );
}

function VersionRow({ version }: { version: VersionView }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function activate() {
    setError(null);
    const fd = new FormData();
    fd.set("versionId", version.id);
    startTransition(async () => {
      const res = await activateVersionAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  function remove() {
    if (!confirm(`Delete "${version.label}"? This can't be undone.`)) return;
    setError(null);
    const fd = new FormData();
    fd.set("versionId", version.id);
    startTransition(async () => {
      const res = await deleteVersionAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          {version.label}
          {version.isActive && (
            <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Active</Badge>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{version.itemCount}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(version.createdAt)}</td>
      <td className="px-4 py-2.5">
        <div className="flex justify-end gap-1.5">
          {!version.isActive && (
            <Button size="sm" variant="outline" disabled={pending} onClick={activate}>
              Activate
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={pending} onClick={remove} aria-label="Delete version">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function QuestionnaireManager({ versions }: { versions: VersionView[] }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    uploadQuestionnaireVersionAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-1 text-sm font-semibold">Upload a new version</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Excel (.xlsx or .xlsm) with columns "No" (e.g. "4.2.3"), "Question", and optionally "Short Text",
            "Person in Charge", "SMS Proc (All related)" — column order doesn't matter. Becomes the active
            version immediately; older versions stay on file, not deleted.
          </p>
          <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1 space-y-1.5">
              <Label htmlFor="label">Version label</Label>
              <Input id="label" name="label" placeholder="e.g. SIRE 2.0 VIQ — Rev Aug 2026" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="file">File</Label>
              <input
                id="file"
                type="file"
                name="file"
                required
                accept=".xlsx,.xlsm"
                className="max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
              />
            </div>
            <UploadButton />
          </form>
          {state.error && <p className="mt-2 text-sm text-danger" role="alert">{state.error}</p>}
        </CardContent>
      </Card>

      {versions.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <FileQuestion className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No questionnaire versions uploaded yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Upload the SIRE 2.0 VIQ above to enable question-number suggestions on Company Inspection observations.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Label</th>
                  <th className="px-4 py-2.5 font-medium">Questions</th>
                  <th className="px-4 py-2.5 font-medium">Uploaded</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => <VersionRow key={v.id} version={v} />)}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
