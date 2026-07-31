"use client";

import Link from "next/link";
import { useState, useTransition, useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ncrPrefillHref } from "@/lib/ncr-link";
import {
  AUDIT_FINDING_CATEGORIES,
  auditCategoryLabel,
  auditCategoryTone,
  type AuditActionResult,
  type AuditFindingView,
  type AuditNcrContext,
} from "./types";

// Server actions are passed in by each module (internal / external audits).
type AddAction = (
  prev: AuditActionResult,
  fd: FormData,
) => Promise<AuditActionResult>;
type FindingAction = (fd: FormData) => Promise<AuditActionResult>;

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add finding"}
    </Button>
  );
}

function FindingRow({
  finding,
  editable,
  updateAction,
  deleteAction,
  canCreateNcr,
  existingNcr,
  ncrContext,
}: {
  finding: AuditFindingView;
  editable: boolean;
  updateAction: FindingAction;
  deleteAction: FindingAction;
  canCreateNcr: boolean;
  existingNcr?: { id: string; refNo: string };
  ncrContext: AuditNcrContext;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [correctiveAction, setCorrectiveAction] = useState(
    finding.correctiveAction ?? "",
  );
  const [status, setStatus] = useState<"OPEN" | "CLOSED">(finding.status);

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("findingId", finding.id);
    fd.set("correctiveAction", correctiveAction);
    fd.set("status", status);
    startTransition(async () => {
      const res = await updateAction(fd);
      if (!res.ok) setError(res.error);
    });
  }
  function remove() {
    const fd = new FormData();
    fd.set("findingId", finding.id);
    startTransition(async () => {
      await deleteAction(fd);
    });
  }

  return (
    <li className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge tone={auditCategoryTone(finding.category)}>
              {auditCategoryLabel(finding.category)}
            </Badge>
            {finding.reference && <span className="font-mono">{finding.reference}</span>}
            <Badge tone={finding.status === "CLOSED" ? "success" : "warning"}>
              {finding.status === "CLOSED" ? "Closed" : "Open"}
            </Badge>
          </div>
          <p className="mt-1 text-sm">{finding.description}</p>
          {existingNcr ? (
            <Link href={`/non-conformities/${existingNcr.id}`} className="mt-1 inline-block text-xs text-primary hover:underline">
              View {existingNcr.refNo}
            </Link>
          ) : (
            canCreateNcr && (
              <Link
                href={ncrPrefillHref({
                  vesselId: ncrContext.vesselId,
                  source: ncrContext.source,
                  sourceEntityId: finding.id,
                  requirement: finding.reference,
                  description: finding.description,
                  raisedAt: ncrContext.raisedAt,
                  reportRefNo: ncrContext.reportRefNo,
                })}
                className="mt-1 inline-block text-xs text-primary hover:underline"
              >
                Raise NCR
              </Link>
            )
          )}
        </div>
        {editable && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label="Delete finding"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-danger disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {editable ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs">Corrective action</Label>
            <AutoGrowInput
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
              placeholder="Corrective action…"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as "OPEN" | "CLOSED")}
            className="w-32"
          >
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
          </Select>
          <Button size="sm" variant="outline" onClick={save} disabled={pending}>
            Save
          </Button>
        </div>
      ) : (
        finding.correctiveAction && (
          <p className="text-sm text-muted-foreground">
            Corrective action: {finding.correctiveAction}
          </p>
        )
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </li>
  );
}

export function AuditFindingsPanel({
  auditId,
  findings,
  editable,
  addAction,
  updateAction,
  deleteAction,
  canCreateNcr,
  ncrBySourceId,
  ncrContext,
}: {
  auditId: string;
  findings: AuditFindingView[];
  editable: boolean;
  addAction: AddAction;
  updateAction: FindingAction;
  deleteAction: FindingAction;
  canCreateNcr: boolean;
  ncrBySourceId: Record<string, { id: string; refNo: string }>;
  ncrContext: AuditNcrContext;
}) {
  const [addState, formAction] = useActionState<AuditActionResult, FormData>(
    addAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (addState.ok) formRef.current?.reset();
  }, [addState.ok]);

  return (
    <div className="space-y-4">
      {findings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No findings recorded.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {findings.map((f) => (
            <FindingRow
              key={f.id}
              finding={f}
              editable={editable}
              updateAction={updateAction}
              deleteAction={deleteAction}
              canCreateNcr={canCreateNcr}
              existingNcr={ncrBySourceId[f.id]}
              ncrContext={ncrContext}
            />
          ))}
        </ul>
      )}

      {editable && (
        <form
          ref={formRef}
          action={formAction}
          className="grid grid-cols-1 items-end gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[9rem_8rem_1fr_auto]"
        >
          <input type="hidden" name="auditId" value={auditId} />
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select name="category" defaultValue="MINOR_NC">
              {AUDIT_FINDING_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {auditCategoryLabel(c)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reference</Label>
            <AutoGrowInput name="reference" placeholder="Clause" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Finding</Label>
            <AutoGrowInput name="description" placeholder="Describe the finding" required />
          </div>
          <AddButton />
          {addState.error && (
            <p className="text-sm text-danger sm:col-span-4">{addState.error}</p>
          )}
        </form>
      )}
    </div>
  );
}
