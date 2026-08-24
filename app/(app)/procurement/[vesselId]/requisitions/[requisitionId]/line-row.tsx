"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { updateRequisitionLineAction, reviseRequisitionLineQtyAction, toggleRequisitionLineCancelledAction } from "@/features/procurement/actions";
import { Input, AutoGrowInput } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteLineButton } from "./delete-line-button";

type Line = {
  id: string;
  itemType: "STORES" | "SPARES" | "NON_CATALOGUE";
  nonCatalogueDescription: string | null;
  qtyRequested: number;
  robAtRequestTime: number | null;
  unit: string | null;
  impaCode: string | null;
  remarks: string | null;
  qtyApproved: number | null;
  cancelled: boolean;
};

const REVISE_INITIAL = { ok: false, error: null as string | null };

function ReviseQtyForm({ lineId, qtyRequested, onDone }: { lineId: string; qtyRequested: number; onDone: () => void }) {
  const [state, action, pending] = useActionState(reviseRequisitionLineQtyAction, REVISE_INITIAL);
  const [qty, setQty] = useState(String(qtyRequested));

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form
      action={action}
      className="flex items-center gap-2"
      onSubmit={(e) => {
        // Native form submit already carries the fields via FormData — this
        // just keeps the controlled input in sync with what's about to post.
        e.currentTarget.querySelector<HTMLInputElement>('input[name="qtyApproved"]')!.value = qty;
      }}
    >
      <input type="hidden" name="lineId" value={lineId} />
      <Input type="number" name="qtyApproved" step="any" min={0} value={qty} onChange={(e) => setQty(e.target.value)} className="h-8 w-20" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Save"}
      </Button>
      <button type="button" onClick={onDone} className="text-xs text-muted-foreground hover:text-foreground">
        Cancel
      </button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

function CancelToggleButton({ lineId, cancelled }: { lineId: string; cancelled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await toggleRequisitionLineCancelledAction(lineId, !cancelled);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={toggle} disabled={pending} className={`text-xs font-medium hover:underline disabled:opacity-50 ${cancelled ? "text-accent" : "text-danger"}`}>
        {pending ? "…" : cancelled ? "Un-cancel" : "Cancel item"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

type LineEdit = { qtyRequested: string; unit: string; impaCode: string; remarks: string };

function editValues(line: Line): LineEdit {
  return {
    qtyRequested: String(line.qtyRequested),
    unit: line.unit ?? "",
    impaCode: line.impaCode ?? "",
    remarks: line.remarks ?? "",
  };
}

export function LineRow({
  line,
  meta,
  canEdit,
  canOfficeReview,
}: {
  line: Line;
  meta: { label: string; unit: string; impaCode: string | null } | undefined;
  canEdit: boolean;
  canOfficeReview?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [revising, setRevising] = useState(false);
  const [values, setValues] = useState<LineEdit>(() => editValues(line));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof LineEdit>(field: K, value: LineEdit[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function startEditing() {
    setValues(editValues(line));
    setError(null);
    setEditing(true);
  }

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("lineId", line.id);
    fd.set("qtyRequested", values.qtyRequested);
    fd.set("unit", values.unit);
    fd.set("impaCode", values.impaCode);
    fd.set("remarks", values.remarks);
    startTransition(async () => {
      const res = await updateRequisitionLineAction({ ok: false, error: null }, fd);
      if (res.ok) setEditing(false);
      else setError(res.error);
    });
  }

  const unit = meta?.unit ?? line.unit;
  const impaCode = meta?.impaCode ?? line.impaCode;
  // A catalogue item without its own IMPA code, or a Non-Catalogue line,
  // still lets the requester encode Unit/IMPA on the line itself — same
  // allowance as when the line was first added.
  const unitEditable = line.itemType === "NON_CATALOGUE";
  const impaEditable = line.itemType === "NON_CATALOGUE" || !meta?.impaCode;

  const itemCell =
    line.itemType === "NON_CATALOGUE" ? (
      <span>
        {line.nonCatalogueDescription} <Badge tone="warning">Non-Catalogue</Badge>
      </span>
    ) : (
      (meta?.label ?? "Unknown item")
    );

  if (revising) {
    return (
      <tr className="border-b border-border bg-muted/20 last:border-0">
        <td className="px-3 py-2 align-top">{itemCell}</td>
        <td className="px-3 py-2 align-top text-muted-foreground">{unit ?? "—"}</td>
        <td className="px-3 py-2 align-top tabular-nums text-muted-foreground">{line.robAtRequestTime ?? "—"}</td>
        <td className="px-3 py-2 align-top tabular-nums">{line.qtyRequested}</td>
        <td className="px-3 py-2 align-top font-mono text-xs text-muted-foreground">{impaCode ?? "—"}</td>
        <td className="px-3 py-2 align-top text-muted-foreground">{line.remarks ?? "—"}</td>
        <td className="px-3 py-2 align-top text-right">
          <ReviseQtyForm lineId={line.id} qtyRequested={line.qtyApproved ?? line.qtyRequested} onDone={() => setRevising(false)} />
        </td>
      </tr>
    );
  }

  if (!editing) {
    return (
      <tr className={`border-b border-border last:border-0 ${line.cancelled ? "opacity-50" : ""}`}>
        <td className="px-3 py-2">
          <span className={line.cancelled ? "line-through" : ""}>{itemCell}</span>
          {line.cancelled && <Badge tone="danger" className="ml-2">Cancelled</Badge>}
        </td>
        <td className="px-3 py-2 text-muted-foreground">{unit ?? "—"}</td>
        <td className="px-3 py-2 text-muted-foreground tabular-nums">{line.robAtRequestTime ?? "—"}</td>
        <td className="px-3 py-2 tabular-nums">
          {line.qtyApproved !== null && line.qtyApproved !== line.qtyRequested ? (
            <span>
              <span className="text-muted-foreground line-through">{line.qtyRequested}</span> {line.qtyApproved}
            </span>
          ) : (
            line.qtyRequested
          )}
        </td>
        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{impaCode ?? "—"}</td>
        <td className="px-3 py-2 text-muted-foreground">{line.remarks ?? "—"}</td>
        <td className="px-3 py-2 text-right">
          {canEdit && (
            <div className="flex justify-end gap-3">
              <button type="button" onClick={startEditing} className="text-xs font-medium text-accent hover:underline">
                Edit
              </button>
              <DeleteLineButton lineId={line.id} />
            </div>
          )}
          {canOfficeReview && (
            <div className="flex justify-end gap-3">
              {!line.cancelled && (
                <button type="button" onClick={() => setRevising(true)} className="text-xs font-medium text-accent hover:underline">
                  Revise Qty
                </button>
              )}
              <CancelToggleButton lineId={line.id} cancelled={line.cancelled} />
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border bg-muted/20 last:border-0">
      <td className="px-3 py-2 align-top">{itemCell}</td>
      <td className="px-3 py-2 align-top">
        {unitEditable ? (
          <Input value={values.unit} onChange={(e) => setField("unit", e.target.value)} placeholder="pc, ltr…" className="w-20" />
        ) : (
          <span className="text-muted-foreground">{unit ?? "—"}</span>
        )}
      </td>
      <td className="px-3 py-2 align-top tabular-nums text-muted-foreground">{line.robAtRequestTime ?? "—"}</td>
      <td className="px-3 py-2 align-top">
        <Input
          type="number"
          step="any"
          min={0}
          value={values.qtyRequested}
          onChange={(e) => setField("qtyRequested", e.target.value)}
          className="w-24"
        />
      </td>
      <td className="px-3 py-2 align-top">
        {impaEditable ? (
          <Input
            value={values.impaCode}
            onChange={(e) => setField("impaCode", e.target.value)}
            placeholder="if known"
            className="w-24 font-mono text-xs"
          />
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{impaCode}</span>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <AutoGrowInput
          value={values.remarks}
          onChange={(e) => setField("remarks", e.target.value)}
          placeholder="Why it's needed…"
          className="w-40"
        />
      </td>
      <td className="px-3 py-2 align-top text-right">
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-3">
            <button type="button" onClick={save} disabled={pending} className="text-xs font-medium text-accent hover:underline disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs font-medium text-muted-foreground hover:underline">
              Cancel
            </button>
          </div>
          {error && <span className="text-xs text-danger">{error}</span>}
        </div>
      </td>
    </tr>
  );
}
