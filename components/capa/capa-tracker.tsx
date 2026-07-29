"use client";

import {
  useState,
  useTransition,
  useActionState,
  useRef,
  useEffect,
} from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2, Save } from "lucide-react";
import {
  addCapaAction,
  updateCapaAction,
  deleteCapaAction,
  type ActionResult,
} from "@/features/capa/actions";
import { CAPA_STATUSES } from "@/features/capa/schema";
import { humanize } from "@/lib/utils";
import { AutoGrowInput, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type CapaRowView = {
  id: string;
  code: string;
  action: string;
  responsible: string | null;
  targetDate: string | null; // ISO date string or null
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  closedDate: string | null; // ISO date string or null
};

/** yyyy-mm-dd for <input type="date">, or "" when unset. */
function toDateInput(v: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add"}
    </Button>
  );
}

function statusTone(s: string): "neutral" | "warning" | "success" {
  if (s === "CLOSED") return "success";
  if (s === "IN_PROGRESS") return "warning";
  return "neutral";
}

function CapaRow({ row, editable }: { row: CapaRowView; editable: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState(row.action);
  const [responsible, setResponsible] = useState(row.responsible ?? "");
  const [targetDate, setTargetDate] = useState(toDateInput(row.targetDate));

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("action", action);
    fd.set("responsible", responsible);
    fd.set("targetDate", targetDate);
    // Status and Closed Out Date are tracked in the combined CAPA Tracker
    // below, not here — resend the row's current values unchanged.
    fd.set("status", row.status);
    fd.set("closedDate", toDateInput(row.closedDate));
    startTransition(async () => {
      const res = await updateCapaAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  function remove() {
    if (!confirm(`Remove ${row.code}?`)) return;
    const fd = new FormData();
    fd.set("id", row.id);
    startTransition(async () => {
      await deleteCapaAction(fd);
    });
  }

  const cellClass = "px-2 py-1.5 align-top";

  return (
    <tr className="border-b border-border last:border-0">
      <td className={`${cellClass} font-mono text-xs font-medium text-muted-foreground`}>
        {row.code}
      </td>
      <td className={cellClass}>
        {editable ? (
          <AutoGrowInput
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full"
          />
        ) : (
          <span className="text-sm">{row.action}</span>
        )}
      </td>
      <td className={cellClass}>
        {editable ? (
          <AutoGrowInput
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            placeholder="C/M"
            className="w-full px-1.5"
          />
        ) : (
          <span className="text-sm text-muted-foreground">{row.responsible || "—"}</span>
        )}
      </td>
      <td className={cellClass}>
        {editable ? (
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full px-1.5"
          />
        ) : (
          <span className="text-sm text-muted-foreground">{toDateInput(row.targetDate) || "—"}</span>
        )}
      </td>
      {editable && (
        <td className={`${cellClass} whitespace-nowrap print:hidden`}>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              aria-label="Save row"
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-accent disabled:opacity-30"
            >
              <Save className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              aria-label="Delete row"
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </td>
      )}
    </tr>
  );
}

export function CapaTracker({
  entityType,
  entityId,
  kind,
  title,
  rows,
  editable,
}: {
  entityType: string;
  entityId: string;
  kind: "CORRECTIVE" | "PREVENTIVE";
  title: string;
  rows: CapaRowView[];
  editable: boolean;
}) {
  const [addState, formAction] = useActionState<ActionResult, FormData>(
    addCapaAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (addState.ok) formRef.current?.reset();
  }, [addState.ok]);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{title}</h4>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {title.toLowerCase()} recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full table-fixed text-sm">
            {/* Only Action is left unconstrained — it absorbs all remaining
                width, since that's the field with the most to write. Every
                other column holds short values (codes, dates, a status word)
                and stays deliberately narrow. */}
            <colgroup>
              <col className="w-14" />
              <col />
              <col className="w-20" />
              <col className="w-28" />
              {editable && <col className="w-16" />}
            </colgroup>
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="truncate px-2 py-2 font-medium">CAPA ID</th>
                <th className="truncate px-2 py-2 font-medium">Action</th>
                <th className="truncate px-2 py-2 font-medium">Responsible</th>
                <th className="truncate px-2 py-2 font-medium">Target Date</th>
                {editable && <th className="px-2 py-2 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <CapaRow key={r.id} row={r} editable={editable} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editable && (
        <form
          ref={formRef}
          action={formAction}
          className="grid grid-cols-1 items-end gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[1fr_6rem_9rem_auto] print:hidden"
        >
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={entityId} />
          <input type="hidden" name="kind" value={kind} />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Action</label>
            <AutoGrowInput name="action" placeholder="Describe the action" required />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Responsible</label>
            <AutoGrowInput name="responsible" placeholder="C/M" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Target date</label>
            <Input name="targetDate" type="date" />
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

export type CapaSummaryRowView = CapaRowView & {
  kind: "CORRECTIVE" | "PREVENTIVE";
};

function CapaSummaryRow({
  row,
  editable,
}: {
  row: CapaSummaryRowView;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(row.status);
  const [closedDate, setClosedDate] = useState(toDateInput(row.closedDate));

  // Auto-capture today's date the moment an item is marked Closed — relying
  // on someone to separately remember to also type the date is exactly how
  // "Closed with no Closed Out Date" gaps slip through to an audit.
  function handleStatusChange(next: CapaRowView["status"]) {
    setStatus(next);
    if (next === "CLOSED" && !closedDate) {
      setClosedDate(new Date().toISOString().slice(0, 10));
    }
  }

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("id", row.id);
    // Action/Responsible/Target Date are authored in the per-kind table
    // above — resend them unchanged so this save only affects status/date.
    fd.set("action", row.action);
    fd.set("responsible", row.responsible ?? "");
    fd.set("targetDate", toDateInput(row.targetDate));
    fd.set("status", status);
    fd.set("closedDate", closedDate);
    startTransition(async () => {
      const res = await updateCapaAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  const cellClass = "px-2 py-1.5 align-top";

  return (
    <tr className="border-b border-border last:border-0">
      <td className={`${cellClass} font-mono text-xs font-medium text-muted-foreground`}>
        {row.code}
      </td>
      <td className={cellClass}>
        <Badge tone={row.kind === "CORRECTIVE" ? "accent" : "neutral"}>
          {row.kind === "CORRECTIVE" ? "Corrective" : "Preventive"}
        </Badge>
      </td>
      <td className={`${cellClass} text-sm`}>{row.action}</td>
      <td className={`${cellClass} text-sm text-muted-foreground`}>
        {row.responsible || "—"}
      </td>
      <td className={`${cellClass} text-sm text-muted-foreground`}>
        {toDateInput(row.targetDate) || "—"}
      </td>
      <td className={cellClass}>
        {editable ? (
          <Select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as CapaRowView["status"])}
            className="w-full px-1.5"
          >
            {CAPA_STATUSES.map((s) => (
              <option key={s} value={s}>{humanize(s)}</option>
            ))}
          </Select>
        ) : (
          <span
            className={
              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium " +
              (statusTone(row.status) === "success"
                ? "bg-success/10 text-success"
                : statusTone(row.status) === "warning"
                  ? "bg-warning/10 text-warning"
                  : "bg-muted text-muted-foreground")
            }
          >
            {humanize(row.status)}
          </span>
        )}
      </td>
      <td className={cellClass}>
        {editable ? (
          <Input
            type="date"
            value={closedDate}
            onChange={(e) => setClosedDate(e.target.value)}
            className="w-full px-1.5"
          />
        ) : (
          <span className="text-sm text-muted-foreground">
            {toDateInput(row.closedDate) || "—"}
          </span>
        )}
      </td>
      {editable && (
        <td className={`${cellClass} whitespace-nowrap print:hidden`}>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            aria-label="Save row"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-accent disabled:opacity-30"
          >
            <Save className="h-4 w-4" />
          </button>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </td>
      )}
    </tr>
  );
}

/**
 * Merged view of every CAPA item for an entity — corrective and preventive
 * together, distinguished by ID prefix (CA-/PA-) and a Type badge. Action,
 * Responsible and Target Date are authored in the per-kind tables above (read
 * only here); Status and Closed Out Date are tracked and edited from this
 * consolidated register instead, since that's where progress is monitored.
 */
export function CapaSummaryTable({
  rows,
  editable,
}: {
  rows: CapaSummaryRowView[];
  editable: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No CAPA items recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-16" />
          <col className="w-24" />
          <col />
          <col className="w-20" />
          <col className="w-24" />
          <col className="w-28" />
          <col className="w-28" />
          {editable && <col className="w-10" />}
        </colgroup>
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="truncate px-2 py-2 font-medium">ID</th>
            <th className="truncate px-2 py-2 font-medium">Type</th>
            <th className="truncate px-2 py-2 font-medium">Action</th>
            <th className="truncate px-2 py-2 font-medium">Responsible</th>
            <th className="truncate px-2 py-2 font-medium">Target Date</th>
            <th className="truncate px-2 py-2 font-medium">Status</th>
            <th className="truncate px-2 py-2 font-medium">Closed Out</th>
            {editable && <th className="px-2 py-2 font-medium" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <CapaSummaryRow key={r.id} row={r} editable={editable} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
