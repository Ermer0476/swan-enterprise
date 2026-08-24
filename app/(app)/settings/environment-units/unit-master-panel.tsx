"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  addUnitMasterAction,
  updateUnitMasterAction,
  deleteUnitMasterAction,
  type ActionResult,
} from "@/features/environment/actions";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const INITIAL: ActionResult = { ok: false, error: null };

export type UnitMasterRow = {
  id: string;
  unit: string;
  unitLabel: string;
  standardUnit: string;
  toStandardFactor: number;
  isDefault: boolean;
};

function UnitRow({ row }: { row: UnitMasterRow }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateUnitMasterAction, INITIAL);
  const [deleteState, deleteAction, deletePending] = useActionState(
    async (_prev: ActionResult, fd: FormData) => deleteUnitMasterAction(fd),
    INITIAL,
  );

  if (editing) {
    return (
      <tr className="border-b border-border last:border-0 bg-primary/[0.03]">
        <td className="px-3 py-2 font-mono text-xs">{row.unit}</td>
        <td className="px-3 py-2">
          <form id={`edit-${row.id}`} action={action} className="flex items-center gap-2">
            <input type="hidden" name="id" value={row.id} />
            <Input name="unitLabel" defaultValue={row.unitLabel} className="h-8 w-48" />
          </form>
        </td>
        <td className="px-3 py-2 text-muted-foreground">{row.standardUnit}</td>
        <td className="px-3 py-2">
          <Input form={`edit-${row.id}`} name="toStandardFactor" type="number" step="any" min={0} defaultValue={row.toStandardFactor} className="h-8 w-28" />
        </td>
        <td className="px-3 py-2">
          <label className="flex items-center gap-1.5 text-xs">
            <input form={`edit-${row.id}`} type="checkbox" name="isDefault" defaultChecked={row.isDefault} />
            Default
          </label>
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-2">
            <Button type="submit" form={`edit-${row.id}`} size="sm" disabled={pending}>
              {pending ? "…" : "Save"}
            </Button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
          {state.error && <p className="mt-1 text-xs text-danger">{state.error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2 font-mono text-xs">{row.unit}</td>
      <td className="px-3 py-2">{row.unitLabel}</td>
      <td className="px-3 py-2 text-muted-foreground">{row.standardUnit}</td>
      <td className="px-3 py-2 tabular-nums">× {row.toStandardFactor}</td>
      <td className="px-3 py-2">{row.isDefault && <Badge tone="accent">Default</Badge>}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-accent hover:underline">
            Edit
          </button>
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (!confirm(`Remove "${row.unitLabel}"?`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={row.id} />
            <button type="submit" disabled={deletePending} aria-label="Delete unit" className="text-muted-foreground hover:text-danger disabled:opacity-30">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
        {deleteState.error && <p className="mt-1 text-xs text-danger">{deleteState.error}</p>}
      </td>
    </tr>
  );
}

function AddUnitForm({ metric, standardUnit }: { metric: "SEWAGE" | "CARGO"; standardUnit: string }) {
  const [expanded, setExpanded] = useState(false);
  const [state, action, pending] = useActionState(addUnitMasterAction, INITIAL);

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
        <Plus className="h-4 w-4" /> Add unit
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-2 rounded-md border border-dashed border-border p-3">
      <input type="hidden" name="metric" value={metric} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Unit Code</Label>
          <Input name="unit" placeholder="e.g. gal" required className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Display Label</Label>
          <Input name="unitLabel" placeholder="e.g. Gallons (gal)" required className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Standard Unit</Label>
          <Input name="standardUnit" defaultValue={standardUnit} required className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">× Factor → Standard</Label>
          <Input name="toStandardFactor" type="number" step="any" min={0} required className="h-8" />
        </div>
      </div>
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" name="isDefault" />
        Make this the default unit for {metric === "SEWAGE" ? "Sewage" : "Cargo"}
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add unit"}
        </Button>
        <button type="button" onClick={() => setExpanded(false)} className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function UnitMasterPanel({
  metric,
  title,
  standardUnit,
  rows,
}: {
  metric: "SEWAGE" | "CARGO";
  title: string;
  standardUnit: string;
  rows: UnitMasterRow[];
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No units configured yet — the entry form&apos;s Unit dropdown will be empty until at least one is added.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Standard Unit</th>
                <th className="px-3 py-2 font-medium">Factor</th>
                <th className="px-3 py-2 font-medium"></th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <UnitRow key={r.id} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AddUnitForm metric={metric} standardUnit={standardUnit} />
    </div>
  );
}
