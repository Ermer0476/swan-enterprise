"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  addCapaAction,
  updateCapaAction,
  deleteCapaAction,
} from "@/features/capa/actions";
import { CAPA_STATUSES } from "@/features/capa/schema";
import { humanize } from "@/lib/utils";
import { AutoGrowInput, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Display-only re-labelling for a combined tracker that merges CAPA items
 * from several findings/deficiencies into one table. Each finding's own CAPA
 * sequence starts back at 1 (CA-01, CA-02…), so shown side by side those codes
 * collide across findings — this rewrites "CA-01" to "CA-{findingOrdinal}.01"
 * so the finding a row belongs to is visible at a glance. Doesn't touch the
 * stored `code`, only what's rendered in the combined view.
 */
export function renumberCapaCodeForGroup(code: string, groupOrdinal: number): string {
  const dashIdx = code.lastIndexOf("-");
  const prefix = code.slice(0, dashIdx);
  const seq = code.slice(dashIdx + 1);
  return `${prefix}-${String(groupOrdinal).padStart(2, "0")}.${seq}`;
}

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

function statusTone(s: string): "danger" | "warning" | "success" {
  if (s === "CLOSED") return "success";
  if (s === "IN_PROGRESS") return "warning";
  return "danger";
}

// Colors the Status <select> itself (not just the read-only pill) so Open
// reads as red / In Progress as amber / Closed as green at a glance, even
// while editing — matches the traffic-light convention used everywhere else
// in the app (lifecycleStatusTone, Badge tones).
function statusSelectClassName(s: CapaRowView["status"]): string {
  if (s === "CLOSED") return "text-success font-medium";
  if (s === "IN_PROGRESS") return "text-warning font-medium";
  return "text-danger font-medium";
}

type CapaDraft = { action: string; responsible: string; targetDate: string };
type CapaRowEdit = CapaDraft & { status: CapaRowView["status"]; closedDate: string };

function rowValues(row: CapaRowView): CapaRowEdit {
  return {
    action: row.action,
    responsible: row.responsible ?? "",
    targetDate: toDateInput(row.targetDate),
    status: row.status,
    closedDate: toDateInput(row.closedDate),
  };
}

function CapaRow({
  row,
  canEditDetails,
  canEditStatus,
  canDelete,
  values,
  onChange,
  onDelete,
}: {
  row: CapaRowView;
  /** Action/Responsible/Target date — office-authored, full-edit only. */
  canEditDetails: boolean;
  /** Status/Closed date — full-edit OR respond-only (vessel marking done/not done). */
  canEditStatus: boolean;
  canDelete: boolean;
  values: CapaRowEdit;
  onChange: (field: keyof CapaRowEdit, value: string) => void;
  onDelete: () => void;
}) {
  const [deleting, startDeleting] = useTransition();

  function remove() {
    if (!confirm(`Remove ${row.code}?`)) return;
    startDeleting(onDelete);
  }

  // Auto-capture today's date the moment an item is marked Closed — relying
  // on someone to separately remember to also type the date is exactly how
  // "Closed with no Closed Out Date" gaps slip through to an audit.
  function handleStatusChange(next: CapaRowView["status"]) {
    onChange("status", next);
    if (next === "CLOSED" && !values.closedDate) {
      onChange("closedDate", new Date().toISOString().slice(0, 10));
    }
  }

  const cellClass = "px-2 py-1.5 align-top";

  return (
    <tr className="border-b border-border last:border-0">
      <td className={`${cellClass} font-mono text-xs font-medium text-muted-foreground`}>
        {row.code}
      </td>
      <td className={cellClass}>
        {canEditDetails ? (
          <AutoGrowInput
            value={values.action}
            onChange={(e) => onChange("action", e.target.value)}
            className="w-full min-w-40"
          />
        ) : (
          <span className="text-sm">{row.action}</span>
        )}
      </td>
      <td className={cellClass}>
        {canEditDetails ? (
          <AutoGrowInput
            value={values.responsible}
            onChange={(e) => onChange("responsible", e.target.value)}
            placeholder="C/M"
            className="w-full px-1.5"
          />
        ) : (
          <span className="text-sm text-muted-foreground">{row.responsible || "—"}</span>
        )}
      </td>
      <td className={cellClass}>
        {canEditDetails ? (
          <Input
            type="date"
            value={values.targetDate}
            onChange={(e) => onChange("targetDate", e.target.value)}
            className="w-full px-1.5"
          />
        ) : (
          <span className="text-sm text-muted-foreground">{toDateInput(row.targetDate) || "—"}</span>
        )}
      </td>
      <td className={cellClass}>
        {canEditStatus ? (
          <Select
            value={values.status}
            onChange={(e) => handleStatusChange(e.target.value as CapaRowView["status"])}
            className={`w-full px-1.5 ${statusSelectClassName(values.status)}`}
          >
            {CAPA_STATUSES.map((s) => (
              <option key={s} value={s}>{humanize(s)}</option>
            ))}
          </Select>
        ) : (
          <Badge tone={statusTone(row.status)}>{humanize(row.status)}</Badge>
        )}
      </td>
      <td className={cellClass}>
        {canEditStatus ? (
          <Input
            type="date"
            value={values.closedDate}
            onChange={(e) => onChange("closedDate", e.target.value)}
            className="w-full px-1.5"
          />
        ) : (
          <span className="text-sm text-muted-foreground">{toDateInput(row.closedDate) || "—"}</span>
        )}
      </td>
      {canDelete && (
        <td className={`${cellClass} whitespace-nowrap print:hidden`}>
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            aria-label="Delete row"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      )}
    </tr>
  );
}

const emptyDraft: CapaDraft = { action: "", responsible: "", targetDate: "" };

export function CapaTracker({
  entityType,
  entityId,
  kind,
  title,
  rows,
  editable,
  canRespond = false,
}: {
  entityType: string;
  entityId: string;
  kind: "CORRECTIVE" | "PREVENTIVE";
  title: string;
  rows: CapaRowView[];
  /** Full edit: add/delete items, edit action/responsible/target date/status/closed date. Office-only. */
  editable: boolean;
  /** Narrower: mark an EXISTING item's status/closed date only — no add, no delete, no action-text edit. Vessel, own inspections only. */
  canRespond?: boolean;
}) {
  const canEditStatus = editable || canRespond;
  // Edits to existing rows (Action/Responsible/Target date) accumulate here
  // instead of saving per row — one "Save changes" button below the table
  // covers everything at once, so there's a single, unmissable save control
  // instead of a floppy-disk icon on every row. The blank add-row at the
  // bottom feeds the same button: typing into it is just another kind of
  // unsaved change, not a separate submit action, so there's exactly one
  // mental model for "I typed something, now I click Save".
  const [edits, setEdits] = useState<Record<string, CapaRowEdit>>({});
  const [addDraft, setAddDraft] = useState<CapaDraft>(emptyDraft);
  const [showAddRow, setShowAddRow] = useState(false);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [addError, setAddError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const addLabel = kind === "CORRECTIVE" ? "corrective action" : "preventive action";

  function cancelAdd() {
    setShowAddRow(false);
    setAddDraft(emptyDraft);
    setAddError(null);
  }

  function valuesFor(row: CapaRowView): CapaRowEdit {
    return edits[row.id] ?? rowValues(row);
  }
  function isRowDirty(row: CapaRowView): boolean {
    const e = edits[row.id];
    if (!e) return false;
    const base = rowValues(row);
    return (
      e.action !== base.action ||
      e.responsible !== base.responsible ||
      e.targetDate !== base.targetDate ||
      e.status !== base.status ||
      e.closedDate !== base.closedDate
    );
  }
  function setField(row: CapaRowView, field: keyof CapaRowEdit, value: string) {
    // Read the base values from `prev`, not the render-closure `valuesFor` —
    // two onChange calls can land in the same tick (e.g. status auto-filling
    // Closed Out Date below), and reading outside `prev` would let the second
    // call clobber the first with stale data.
    setEdits((prev) => ({
      ...prev,
      [row.id]: { ...(prev[row.id] ?? rowValues(row)), [field]: value },
    }));
  }
  function setDraftField(field: keyof CapaDraft, value: string) {
    setAddDraft((prev) => ({ ...prev, [field]: value }));
  }
  async function deleteRow(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    await deleteCapaAction(fd);
  }

  const dirtyRows = rows.filter(isRowDirty);
  const hasDraft = addDraft.action.trim() !== "";
  const isDirty = dirtyRows.length > 0 || hasDraft;

  function saveAll() {
    startSaving(async () => {
      const [addResult, ...results] = await Promise.all([
        hasDraft
          ? (async () => {
              const fd = new FormData();
              fd.set("entityType", entityType);
              fd.set("entityId", entityId);
              fd.set("kind", kind);
              fd.set("action", addDraft.action);
              fd.set("responsible", addDraft.responsible);
              fd.set("targetDate", addDraft.targetDate);
              return addCapaAction({ ok: false, error: null }, fd);
            })()
          : Promise.resolve(null),
        ...dirtyRows.map(async (row) => {
          const v = valuesFor(row);
          const fd = new FormData();
          fd.set("id", row.id);
          fd.set("action", v.action);
          fd.set("responsible", v.responsible);
          fd.set("targetDate", v.targetDate);
          fd.set("status", v.status);
          fd.set("closedDate", v.closedDate);
          const res = await updateCapaAction(fd);
          return { row, res };
        }),
      ]);
      if (addResult) {
        if (addResult.ok) {
          setAddDraft(emptyDraft);
          setAddError(null);
          setShowAddRow(false);
        } else {
          setAddError(addResult.error ?? "Failed to add");
        }
      }
      const nextErrors: Record<string, string> = {};
      setEdits((prev) => {
        const next = { ...prev };
        for (const { row, res } of results) {
          if (res.ok) delete next[row.id];
          else nextErrors[row.code] = res.error ?? "Failed to save";
        }
        return next;
      });
      setSaveErrors(nextErrors);
    });
  }

  if (rows.length === 0 && !showAddRow) {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-sm text-muted-foreground">No {title.toLowerCase()} recorded yet.</p>
        {editable && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAddRow(true)}>
            <Plus className="h-4 w-4" /> Add {addLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{title}</h4>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full table-fixed text-sm">
          {/* Only Action is left unconstrained — it absorbs all remaining
              width, since that's the field with the most to write. Every
              other column holds short values (codes, dates, a status word)
              and stays deliberately narrow. */}
          <colgroup>
            <col className="w-14" />
            <col className="min-w-40" />
            <col className="w-20" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-28" />
            {editable && <col className="w-10" />}
          </colgroup>
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="truncate px-2 py-2 font-medium">CAPA ID</th>
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
              <CapaRow
                key={r.id}
                row={r}
                canEditDetails={editable}
                canEditStatus={canEditStatus}
                canDelete={editable}
                values={valuesFor(r)}
                onChange={(field, value) => setField(r, field, value)}
                onDelete={() => deleteRow(r.id)}
              />
            ))}
            {editable && showAddRow && (
              <tr className="border-t border-border bg-primary/[0.03] print:hidden">
                <td className="px-2 py-1.5 align-top text-xs text-muted-foreground">
                  <Plus className="h-4 w-4" />
                </td>
                <td className="px-2 py-1.5 align-top">
                  <AutoGrowInput
                    value={addDraft.action}
                    onChange={(e) => setDraftField("action", e.target.value)}
                    placeholder="Describe the action"
                    className="w-full min-w-40"
                    autoFocus
                  />
                </td>
                <td className="px-2 py-1.5 align-top">
                  <AutoGrowInput
                    value={addDraft.responsible}
                    onChange={(e) => setDraftField("responsible", e.target.value)}
                    placeholder="C/M"
                    className="w-full px-1.5"
                  />
                </td>
                <td className="px-2 py-1.5 align-top">
                  <Input
                    type="date"
                    value={addDraft.targetDate}
                    onChange={(e) => setDraftField("targetDate", e.target.value)}
                    className="w-full px-1.5"
                  />
                </td>
                <td className="px-2 py-1.5 align-top text-xs text-muted-foreground">—</td>
                <td className="px-2 py-1.5 align-top text-xs text-muted-foreground">—</td>
                <td className="px-2 py-1.5 align-top">
                  <button
                    type="button"
                    onClick={cancelAdd}
                    aria-label="Cancel add"
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {addError && <p className="text-sm text-danger">{addError}</p>}
      {Object.keys(saveErrors).length > 0 && (
        <p className="text-sm text-danger">
          Couldn&apos;t save {Object.keys(saveErrors).join(", ")} — try again.
        </p>
      )}
      {(editable || canRespond) && (
        <div className={`flex items-center gap-2 print:hidden ${editable && !showAddRow ? "justify-between" : "justify-end"}`}>
          {editable && !showAddRow && (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddRow(true)}>
              <Plus className="h-4 w-4" /> Add {addLabel}
            </Button>
          )}
          <Button
            type="button"
            variant={isDirty ? "success" : "outline"}
            disabled={!isDirty || isSaving}
            onClick={saveAll}
          >
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}

export type CapaSummaryRowView = CapaRowView & {
  kind: "CORRECTIVE" | "PREVENTIVE";
  // Overrides the table-level `editable` for this one row — used by combined,
  // multi-entity trackers (e.g. one table for a whole audit's findings) where
  // some rows are NCR-synced (gated by ncr:update) and others aren't.
  editable?: boolean;
};

type CapaSummaryEdit = { status: CapaRowView["status"]; closedDate: string };

function summaryValues(row: CapaSummaryRowView): CapaSummaryEdit {
  return { status: row.status, closedDate: toDateInput(row.closedDate) };
}

function CapaSummaryRow({
  row,
  editable: tableEditable,
  values,
  onChange,
}: {
  row: CapaSummaryRowView;
  editable: boolean;
  values: CapaSummaryEdit;
  onChange: (field: keyof CapaSummaryEdit, value: string) => void;
}) {
  // A combined, multi-entity table may show the edit column overall (because
  // at least one row is editable) while this particular row is read-only
  // (e.g. it's NCR-synced and the viewer lacks ncr:update) — the cell must
  // still render, just without the edit controls, to keep columns aligned.
  const editable = row.editable ?? tableEditable;

  // Auto-capture today's date the moment an item is marked Closed — relying
  // on someone to separately remember to also type the date is exactly how
  // "Closed with no Closed Out Date" gaps slip through to an audit.
  function handleStatusChange(next: CapaRowView["status"]) {
    onChange("status", next);
    if (next === "CLOSED" && !values.closedDate) {
      onChange("closedDate", new Date().toISOString().slice(0, 10));
    }
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
      <td className={`${cellClass} min-w-40 text-sm`}>{row.action}</td>
      <td className={`${cellClass} text-sm text-muted-foreground`}>
        {row.responsible || "—"}
      </td>
      <td className={`${cellClass} text-sm text-muted-foreground`}>
        {toDateInput(row.targetDate) || "—"}
      </td>
      <td className={cellClass}>
        {editable ? (
          <Select
            value={values.status}
            onChange={(e) => handleStatusChange(e.target.value as CapaRowView["status"])}
            className={`w-full px-1.5 ${statusSelectClassName(values.status)}`}
          >
            {CAPA_STATUSES.map((s) => (
              <option key={s} value={s}>{humanize(s)}</option>
            ))}
          </Select>
        ) : (
          <Badge tone={statusTone(row.status)}>{humanize(row.status)}</Badge>
        )}
      </td>
      <td className={cellClass}>
        {editable ? (
          <Input
            type="date"
            value={values.closedDate}
            onChange={(e) => onChange("closedDate", e.target.value)}
            className="w-full px-1.5"
          />
        ) : (
          <span className="text-sm text-muted-foreground">
            {toDateInput(row.closedDate) || "—"}
          </span>
        )}
      </td>
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
  const [edits, setEdits] = useState<Record<string, CapaSummaryEdit>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  function valuesFor(row: CapaSummaryRowView): CapaSummaryEdit {
    return edits[row.id] ?? summaryValues(row);
  }
  function isRowDirty(row: CapaSummaryRowView): boolean {
    const e = edits[row.id];
    if (!e) return false;
    const base = summaryValues(row);
    return e.status !== base.status || e.closedDate !== base.closedDate;
  }
  function setField(row: CapaSummaryRowView, field: keyof CapaSummaryEdit, value: string) {
    // Read the base values from `prev`, not the render-closure `valuesFor` —
    // marking a row Closed calls onChange twice in the same tick (status,
    // then the auto-filled Closed Out Date), and reading outside `prev`
    // would let the second call clobber the first with stale data.
    setEdits((prev) => ({
      ...prev,
      [row.id]: { ...(prev[row.id] ?? summaryValues(row)), [field]: value },
    }));
  }

  const editableRows = rows.filter((r) => r.editable ?? editable);
  const dirtyRows = editableRows.filter(isRowDirty);
  const isDirty = dirtyRows.length > 0;

  function saveAll() {
    startSaving(async () => {
      const results = await Promise.all(
        dirtyRows.map(async (row) => {
          const v = valuesFor(row);
          const fd = new FormData();
          fd.set("id", row.id);
          // Action/Responsible/Target Date are authored in the per-kind table
          // above — resend them unchanged so this only affects status/date.
          fd.set("action", row.action);
          fd.set("responsible", row.responsible ?? "");
          fd.set("targetDate", toDateInput(row.targetDate));
          fd.set("status", v.status);
          fd.set("closedDate", v.closedDate);
          const res = await updateCapaAction(fd);
          return { row, res };
        }),
      );
      const nextErrors: Record<string, string> = {};
      setEdits((prev) => {
        const next = { ...prev };
        for (const { row, res } of results) {
          if (res.ok) delete next[row.id];
          else nextErrors[row.code] = res.error ?? "Failed to save";
        }
        return next;
      });
      setSaveErrors(nextErrors);
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {editable
          ? "No corrective actions yet — add one above and save it, then its status and closed date can be set here."
          : "No CAPA items recorded yet."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
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
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <CapaSummaryRow
                key={r.id}
                row={r}
                editable={editable}
                values={valuesFor(r)}
                onChange={(field, value) => setField(r, field, value)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {Object.keys(saveErrors).length > 0 && (
        <p className="text-sm text-danger">
          Couldn&apos;t save {Object.keys(saveErrors).join(", ")} — try again.
        </p>
      )}
      {editable && (
        <div className="flex justify-end print:hidden">
          <Button
            type="button"
            variant={isDirty ? "success" : "outline"}
            disabled={!isDirty || isSaving}
            onClick={saveAll}
          >
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
