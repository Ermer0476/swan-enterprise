"use client";

import Link from "next/link";
import { useTransition, useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AttachmentList, type AttachmentView } from "@/components/attachments/attachment-list";
import { ncrPrefillHref } from "@/lib/ncr-link";
import { formatRootCause, type RootCauseCategoryValue } from "@/lib/root-cause";
import {
  CapaTracker,
  type CapaRowView,
  type CapaSummaryRowView,
} from "@/components/capa/capa-tracker";
import { RootCauseForm as NcrRootCauseForm } from "@/app/(app)/non-conformities/[id]/root-cause-form";
import { FindingRootCauseForm } from "./finding-root-cause-form";
import {
  AUDIT_FINDING_CATEGORIES,
  auditCategoryLabel,
  auditCategoryTone,
  type AuditActionResult,
  type AuditFindingView,
  type AuditNcrContext,
  type AuditFindingEntityType,
  type RootCauseValue,
  type CapaEntityRef,
} from "./types";

// Server actions are passed in by each module (internal / external audits).
type AddAction = (
  prev: AuditActionResult,
  fd: FormData,
) => Promise<AuditActionResult>;
type FindingAction = (fd: FormData) => Promise<AuditActionResult>;
type SaveRootCauseAction = (
  prev: AuditActionResult,
  fd: FormData,
) => Promise<AuditActionResult>;
type CapaRow = { status: "OPEN" | "IN_PROGRESS" | "CLOSED" };
function isResolved(rows: CapaRow[]): boolean {
  return rows.length > 0 && rows.every((r) => r.status === "CLOSED");
}

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
  canRespond,
  deleteAction,
  saveRootCauseAction,
  canCreateNcr,
  canUpdateNcr,
  existingNcr,
  ncrContext,
  correctiveRows,
  allCapaRows,
  rootCause,
  capaEntity,
  entityType,
  attachments,
}: {
  finding: AuditFindingView;
  editable: boolean;
  canRespond: boolean;
  deleteAction: FindingAction;
  saveRootCauseAction: SaveRootCauseAction;
  canCreateNcr: boolean;
  canUpdateNcr: boolean;
  existingNcr?: { id: string; refNo: string };
  ncrContext: AuditNcrContext;
  correctiveRows: CapaRowView[];
  allCapaRows: CapaSummaryRowView[];
  rootCause: RootCauseValue;
  capaEntity: CapaEntityRef;
  entityType: AuditFindingEntityType;
  attachments: AttachmentView[];
}) {
  const [pending, startTransition] = useTransition();
  const resolved = isResolved(allCapaRows);

  function remove() {
    const fd = new FormData();
    fd.set("findingId", finding.id);
    startTransition(async () => {
      await deleteAction(fd);
    });
  }

  return (
    <li className="space-y-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge tone={auditCategoryTone(finding.category)}>
              {auditCategoryLabel(finding.category)}
            </Badge>
            {finding.reference && <span className="font-mono">{finding.reference}</span>}
            <Badge tone={resolved ? "success" : "warning"}>
              {resolved ? "Closed" : "Open"}
            </Badge>
            {existingNcr ? (
              <Link href={`/non-conformities/${existingNcr.id}`}>
                <Button type="button" size="sm" variant="outline">View {existingNcr.refNo}</Button>
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
                >
                  <Button type="button" size="sm">Raise NCR</Button>
                </Link>
              )
            )}
          </div>
          <p className="mt-1 text-sm">{finding.description}</p>
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

      {finding.category !== "OBSERVATION" && (
        <div className="rounded-md border border-border p-3">
          <h4 className="mb-2 text-sm font-semibold">
            Root cause
            {existingNcr && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (synced with {existingNcr.refNo})
              </span>
            )}
          </h4>
          {existingNcr ? (
            canUpdateNcr ? (
              <NcrRootCauseForm
                key={`${rootCause.category ?? ""}|${rootCause.subCategory ?? ""}`}
                ncrId={existingNcr.id}
                rootCauseCategory={rootCause.category ?? ""}
                rootCauseSubCategory={rootCause.subCategory ?? ""}
                rootCause={rootCause.description ?? ""}
              />
            ) : rootCause.category ? (
              <div className="space-y-1">
                <p className="text-sm">{formatRootCause(rootCause.category as RootCauseCategoryValue | null, rootCause.subCategory)}</p>
                {rootCause.description && <p className="text-sm text-muted-foreground">{rootCause.description}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No root cause recorded yet.</p>
            )
          ) : editable ? (
            <FindingRootCauseForm
              key={`${rootCause.category ?? ""}|${rootCause.subCategory ?? ""}`}
              findingId={finding.id}
              rootCauseCategory={rootCause.category ?? ""}
              rootCauseSubCategory={rootCause.subCategory ?? ""}
              rootCause={rootCause.description ?? ""}
              saveAction={saveRootCauseAction}
            />
          ) : rootCause.category ? (
            <div className="space-y-1">
              <p className="text-sm">{formatRootCause(rootCause.category as RootCauseCategoryValue | null, rootCause.subCategory)}</p>
              {rootCause.description && <p className="text-sm text-muted-foreground">{rootCause.description}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No root cause recorded yet.</p>
          )}
        </div>
      )}

      <div className="rounded-md border border-border p-3 space-y-4">
        <h4 className="text-sm font-semibold">
          Corrective Action
          {existingNcr && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (synced with {existingNcr.refNo})
            </span>
          )}
        </h4>
        <CapaTracker
          entityType={capaEntity.entityType}
          entityId={capaEntity.entityId}
          kind="CORRECTIVE"
          title="Corrective Actions"
          editable={existingNcr ? canUpdateNcr : editable}
          canRespond={existingNcr ? false : canRespond}
          rows={correctiveRows}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Attachments</Label>
        <AttachmentList
          entityType={entityType}
          entityId={finding.id}
          attachments={attachments}
          editable={editable}
        />
      </div>
    </li>
  );
}

export function AuditFindingsPanel({
  auditId,
  findings,
  editable,
  canRespond,
  addAction,
  deleteAction,
  saveRootCauseAction,
  canCreateNcr,
  canUpdateNcr,
  ncrBySourceId,
  ncrContext,
  correctiveRowsByFinding,
  allCapaRowsByFinding,
  rootCauseByFinding,
  capaEntityByFinding,
  entityType,
  attachmentsByFinding,
}: {
  auditId: string;
  findings: AuditFindingView[];
  editable: boolean;
  canRespond: boolean;
  addAction: AddAction;
  deleteAction: FindingAction;
  saveRootCauseAction: SaveRootCauseAction;
  canCreateNcr: boolean;
  canUpdateNcr: boolean;
  ncrBySourceId: Record<string, { id: string; refNo: string }>;
  ncrContext: AuditNcrContext;
  correctiveRowsByFinding: Record<string, CapaRowView[]>;
  allCapaRowsByFinding: Record<string, CapaSummaryRowView[]>;
  rootCauseByFinding: Record<string, RootCauseValue>;
  capaEntityByFinding: Record<string, CapaEntityRef>;
  entityType: AuditFindingEntityType;
  attachmentsByFinding: Record<string, AttachmentView[]>;
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
              canRespond={canRespond}
              deleteAction={deleteAction}
              saveRootCauseAction={saveRootCauseAction}
              canCreateNcr={canCreateNcr}
              canUpdateNcr={canUpdateNcr}
              existingNcr={ncrBySourceId[f.id]}
              ncrContext={ncrContext}
              correctiveRows={correctiveRowsByFinding[f.id] ?? []}
              allCapaRows={allCapaRowsByFinding[f.id] ?? []}
              rootCause={rootCauseByFinding[f.id] ?? { category: null, subCategory: null, description: null }}
              capaEntity={capaEntityByFinding[f.id] ?? { entityType: "", entityId: f.id }}
              entityType={entityType}
              attachments={attachmentsByFinding[f.id] ?? []}
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
