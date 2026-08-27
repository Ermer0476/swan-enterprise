"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  addReferenceListItemAction,
  updateReferenceListItemAction,
  deleteReferenceListItemAction,
  type ActionResult,
} from "@/features/reference-lists/actions";
import type { ReferenceListItemRow } from "@/features/reference-lists/queries";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const INITIAL: ActionResult = { ok: false, error: null };

function OptionRow({ row }: { row: ReferenceListItemRow }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateReferenceListItemAction, INITIAL);
  const [deleteState, deleteAction, deletePending] = useActionState(
    async (_prev: ActionResult, fd: FormData) => deleteReferenceListItemAction(fd),
    INITIAL,
  );

  if (editing) {
    return (
      <tr className="border-b border-border last:border-0 bg-primary/[0.03]">
        <td className="px-3 py-2">
          <Input form={`edit-${row.id}`} name="sortOrder" type="number" step="1" min={0} defaultValue={row.sortOrder} className="h-8 w-20" />
        </td>
        <td className="px-3 py-2">
          <form id={`edit-${row.id}`} action={action} className="flex items-center gap-2">
            <input type="hidden" name="id" value={row.id} />
            <Input name="label" defaultValue={row.label} className="h-8 w-56" />
          </form>
        </td>
        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.value}</td>
        <td className="px-3 py-2">
          <label className="flex items-center gap-1.5 text-xs">
            <input form={`edit-${row.id}`} type="checkbox" name="active" defaultChecked={row.active} />
            Active
          </label>
        </td>
        <td className="px-3 py-2 text-right" colSpan={2}>
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
      <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.sortOrder}</td>
      <td className="px-3 py-2">
        {row.label}
        {row.isSystem && <span className="ml-2 align-middle"><Badge tone="neutral">System</Badge></span>}
      </td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.value}</td>
      <td className="px-3 py-2">{row.active ? <Badge tone="accent">Active</Badge> : <Badge tone="neutral">Hidden</Badge>}</td>
      <td className="px-3 py-2 text-right">
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-accent hover:underline">
          Edit
        </button>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end">
          <form
            action={deleteAction}
            onSubmit={(e) => {
              const msg = row.isSystem
                ? `Hide the built-in option "${row.label}"? It can be re-activated later.`
                : `Remove "${row.label}"?`;
              if (!confirm(msg)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              disabled={deletePending}
              aria-label={row.isSystem ? "Deactivate option" : "Delete option"}
              className="text-muted-foreground hover:text-danger disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
        {deleteState.error && <p className="mt-1 text-xs text-danger">{deleteState.error}</p>}
      </td>
    </tr>
  );
}

function AddOptionForm({ listKey }: { listKey: string }) {
  const [expanded, setExpanded] = useState(false);
  const [state, action, pending] = useActionState(addReferenceListItemAction, INITIAL);

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
        <Plus className="h-4 w-4" /> Add option
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-2 rounded-md border border-dashed border-border p-3">
      <input type="hidden" name="listKey" value={listKey} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Value (stored)</Label>
          <Input name="value" placeholder="e.g. Class Certificates" required className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Display Label</Label>
          <Input name="label" placeholder="e.g. Class Certificates" required className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sort Order</Label>
          <Input name="sortOrder" type="number" step="1" min={0} defaultValue={0} className="h-8" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">The value is written onto records and can&apos;t be changed later — only the label, order and visibility.</p>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add option"}
        </Button>
        <button type="button" onClick={() => setExpanded(false)} className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function ReferenceListPanel({
  listKey,
  title,
  rows,
}: {
  listKey: string;
  title: string;
  rows: ReferenceListItemRow[];
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No options configured yet — the picker falls back to the built-in list until at least one is added.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <OptionRow key={r.id} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AddOptionForm listKey={listKey} />
    </div>
  );
}
