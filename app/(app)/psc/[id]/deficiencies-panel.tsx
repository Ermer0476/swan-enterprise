"use client";

import Link from "next/link";
import { useState, useTransition, useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  addDeficiencyAction,
  updateDeficiencyAction,
  deleteDeficiencyAction,
  type ActionResult,
} from "@/features/psc/actions";
import { ncrPrefillHref } from "@/lib/ncr-link";
import { formatRootCause, type RootCauseCategoryValue } from "@/lib/root-cause";
import {
  CapaTracker,
  CapaSummaryTable,
  renumberCapaCodeForGroup,
  type CapaRowView,
  type CapaSummaryRowView,
} from "@/components/capa/capa-tracker";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeficiencyRootCauseForm } from "./deficiency-root-cause-form";
import { RootCauseForm as NcrRootCauseForm } from "@/app/(app)/non-conformities/[id]/root-cause-form";

export type NcrContext = {
  vesselId: string | null;
  reportRefNo: string;
  port: string | null;
  raisedAt: string;
};

export type DeficiencyView = {
  id: string;
  natureCode: string | null;
  reference: string | null;
  actionCode: string | null;
  description: string;
  status: "OPEN" | "CLOSED";
};

type RootCauseValue = { category: string | null; subCategory: string | null };
type CapaEntityRef = { entityType: string; entityId: string };

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add deficiency"}
    </Button>
  );
}

function DeficiencyRow({
  def,
  editable,
  canCreateNcr,
  canUpdateNcr,
  existingNcr,
  ncrContext,
  correctiveRows,
  rootCause,
  capaEntity,
}: {
  def: DeficiencyView;
  editable: boolean;
  canCreateNcr: boolean;
  canUpdateNcr: boolean;
  existingNcr?: { id: string; refNo: string };
  ncrContext: NcrContext;
  correctiveRows: CapaRowView[];
  rootCause: RootCauseValue;
  capaEntity: CapaEntityRef;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"OPEN" | "CLOSED">(def.status);

  function saveStatus() {
    const fd = new FormData();
    fd.set("deficiencyId", def.id);
    fd.set("status", status);
    startTransition(async () => {
      await updateDeficiencyAction(fd);
    });
  }
  function remove() {
    const fd = new FormData();
    fd.set("deficiencyId", def.id);
    startTransition(async () => {
      await deleteDeficiencyAction(fd);
    });
  }

  return (
    <li className="space-y-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {def.natureCode && <span className="font-mono">Code {def.natureCode}</span>}
            {def.reference && <span>· {def.reference}</span>}
            {def.actionCode && <Badge tone="accent">Action {def.actionCode}</Badge>}
            <Badge tone={def.status === "CLOSED" ? "success" : "warning"}>
              {def.status === "CLOSED" ? "Rectified" : "Open"}
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
                    source: "PSC",
                    sourceEntityId: def.id,
                    requirement: def.reference,
                    description: def.description,
                    raisedAt: ncrContext.raisedAt,
                    reportRefNo: ncrContext.reportRefNo,
                    port: ncrContext.port,
                  })}
                >
                  <Button type="button" size="sm">Raise NCR</Button>
                </Link>
              )
            )}
          </div>
          <p className="mt-1 text-sm">{def.description}</p>
        </div>
        {editable && (
          <button type="button" onClick={remove} disabled={pending} aria-label="Delete deficiency"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-danger disabled:opacity-30">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {editable && (
        <div className="flex items-center gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value as "OPEN" | "CLOSED")} className="w-36">
            <option value="OPEN">Open</option>
            <option value="CLOSED">Rectified</option>
          </Select>
          <Button size="sm" variant="outline" onClick={saveStatus} disabled={pending}>Save status</Button>
        </div>
      )}

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
              ncrId={existingNcr.id}
              rootCauseCategory={rootCause.category ?? ""}
              rootCauseSubCategory={rootCause.subCategory ?? ""}
            />
          ) : rootCause.category ? (
            <p className="text-sm">{formatRootCause(rootCause.category as RootCauseCategoryValue | null, rootCause.subCategory)}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No root cause recorded yet.</p>
          )
        ) : editable ? (
          <DeficiencyRootCauseForm
            deficiencyId={def.id}
            rootCauseCategory={rootCause.category ?? ""}
            rootCauseSubCategory={rootCause.subCategory ?? ""}
          />
        ) : rootCause.category ? (
          <p className="text-sm">{formatRootCause(rootCause.category as RootCauseCategoryValue | null, rootCause.subCategory)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No root cause recorded yet.</p>
        )}
      </div>

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
          rows={correctiveRows}
        />
      </div>
    </li>
  );
}

export function DeficienciesPanel({
  inspectionId,
  deficiencies,
  editable,
  canCreateNcr,
  canUpdateNcr,
  ncrBySourceId,
  ncrContext,
  correctiveRowsByDeficiency,
  allCapaRowsByDeficiency,
  rootCauseByDeficiency,
  capaEntityByDeficiency,
}: {
  inspectionId: string;
  deficiencies: DeficiencyView[];
  editable: boolean;
  canCreateNcr: boolean;
  canUpdateNcr: boolean;
  ncrBySourceId: Record<string, { id: string; refNo: string }>;
  ncrContext: NcrContext;
  correctiveRowsByDeficiency: Record<string, CapaRowView[]>;
  allCapaRowsByDeficiency: Record<string, CapaSummaryRowView[]>;
  rootCauseByDeficiency: Record<string, RootCauseValue>;
  capaEntityByDeficiency: Record<string, CapaEntityRef>;
}) {
  const [addState, addAction] = useActionState<ActionResult, FormData>(
    addDeficiencyAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (addState.ok) formRef.current?.reset();
  }, [addState.ok]);

  // One consolidated CAPA register for the whole inspection, below every
  // deficiency, so what's still pending is visible at a glance instead of
  // buried inside each individual card.
  const allCapaRows: CapaSummaryRowView[] = deficiencies.flatMap((d, i) => {
    const rows = allCapaRowsByDeficiency[d.id] ?? [];
    const rowEditable = ncrBySourceId[d.id] ? canUpdateNcr : editable;
    return rows.map((r) => ({
      ...r,
      code: renumberCapaCodeForGroup(r.code, i + 1),
      editable: rowEditable,
    }));
  });

  return (
    <div className="space-y-4">
      {deficiencies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deficiencies recorded.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {deficiencies.map((d) => (
            <DeficiencyRow
              key={d.id}
              def={d}
              editable={editable}
              canCreateNcr={canCreateNcr}
              canUpdateNcr={canUpdateNcr}
              existingNcr={ncrBySourceId[d.id]}
              ncrContext={ncrContext}
              correctiveRows={correctiveRowsByDeficiency[d.id] ?? []}
              rootCause={rootCauseByDeficiency[d.id] ?? { category: null, subCategory: null }}
              capaEntity={capaEntityByDeficiency[d.id] ?? { entityType: "PscDeficiency", entityId: d.id }}
            />
          ))}
        </ul>
      )}

      {deficiencies.length > 0 && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <h4 className="text-sm font-semibold">All CAPA Tracker</h4>
          <CapaSummaryTable rows={allCapaRows} editable={editable || canUpdateNcr} />
        </div>
      )}

      {editable && (
        <form ref={formRef} action={addAction}
          className="grid grid-cols-1 items-end gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[6rem_8rem_6rem_1fr_auto]">
          <input type="hidden" name="inspectionId" value={inspectionId} />
          <div className="space-y-1">
            <Label className="text-xs">Nature code</Label>
            <AutoGrowInput name="natureCode" placeholder="e.g. 07110" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reference</Label>
            <AutoGrowInput name="reference" placeholder="SOLAS III/19" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Action</Label>
            <AutoGrowInput name="actionCode" placeholder="17 / 30" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Deficiency</Label>
            <AutoGrowInput name="description" placeholder="Describe the deficiency" required />
          </div>
          <AddButton />
          {addState.error && <p className="text-sm text-danger sm:col-span-5">{addState.error}</p>}
        </form>
      )}
    </div>
  );
}
