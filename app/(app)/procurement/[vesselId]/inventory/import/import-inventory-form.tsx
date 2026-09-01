"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseInventoryImportAction,
  commitInventoryImportAction,
  type ParseImportResult,
  type CommitImportResult,
} from "@/features/procurement/inventory-import-actions";
import type { ParsedInventoryRow } from "@/features/procurement/inventory-import-parser";
import {
  STORES_CATEGORIES_BY_DEPARTMENT,
  STORES_CATEGORY_LABELS,
  REQUISITION_DEPARTMENT_LABELS,
  REQUISITION_DEPARTMENTS,
  type StoresCategoryValue,
  type RequisitionDepartmentValue,
} from "@/features/procurement/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PARSE_INITIAL: ParseImportResult = { ok: false, error: null, rows: [], flagged: [], sheetsScanned: [], sheetsSkipped: [] };
const COMMIT_INITIAL: CommitImportResult = { ok: false, error: null, created: 0, merged: 0 };

type EditableRow = ParsedInventoryRow & { location: string; included: boolean };

function toEditable(rows: ParsedInventoryRow[]): EditableRow[] {
  return rows.map((r) => ({ ...r, location: "", included: true }));
}

export function ImportInventoryForm({ vesselId }: { vesselId: string }) {
  const router = useRouter();
  const [parseState, parseAction, parsing] = useActionState(parseInventoryImportAction, PARSE_INITIAL);
  const [commitState, commitAction, committing] = useActionState(commitInventoryImportAction, COMMIT_INITIAL);
  const [rows, setRows] = useState<EditableRow[] | null>(null);
  const [department, setDepartment] = useState<RequisitionDepartmentValue>("DECK");
  // No default — an unnoticed wrong category silently files everything under
  // the wrong shelf (this bit a real import: 108 Stationery rows landed in
  // Deck Stores because the dropdown was left on its old default). Forcing
  // an explicit choice, with Save disabled until one's made, is cheap
  // insurance against that.
  const [category, setCategory] = useState<StoresCategoryValue | "">("");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [bulkLocation, setBulkLocation] = useState("");
  const fileFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (parseState.ok) setRows(toEditable(parseState.rows));
  }, [parseState]);

  const includedRows = useMemo(() => (rows ?? []).filter((r) => r.included), [rows]);

  function updateRow<K extends keyof EditableRow>(idx: number, field: K, value: EditableRow[K]) {
    setRows((prev) => {
      if (!prev) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx]!, [field]: value };
      return next;
    });
  }

  function applyBulkLocation() {
    if (!bulkLocation.trim()) return;
    setRows((prev) => (prev ? prev.map((r) => ({ ...r, location: bulkLocation.trim() })) : prev));
  }

  function submitCommit() {
    if (!category) return;
    const fd = new FormData();
    fd.set("vesselId", vesselId);
    fd.set("department", department);
    fd.set("category", category);
    fd.set("occurredAt", occurredAt);
    fd.set(
      "rows",
      JSON.stringify(
        includedRows.map((r) => ({
          subGroup: r.subGroup,
          name: r.name,
          unit: r.unit,
          qtyNew: r.qtyNew,
          qtyUsable: r.qtyUsable,
          qtyReconditioned: r.qtyReconditioned,
          remarks: r.remarks,
          location: r.location || null,
        })),
      ),
    );
    commitAction(fd);
  }

  if (commitState.ok) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <p className="text-sm font-semibold text-success">
            Imported {commitState.created + commitState.merged} row{commitState.created + commitState.merged === 1 ? "" : "s"} —{" "}
            {commitState.created} new item{commitState.created === 1 ? "" : "s"}, {commitState.merged} merged into existing catalogue entries.
          </p>
          <Button type="button" onClick={() => router.push(`/procurement/${vesselId}/inventory/update?department=${department}&category=${category}`)}>
            Go to Update Inventory
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!rows) {
    return (
      <Card>
        <CardContent className="pt-5">
          <form ref={fileFormRef} action={parseAction} className="space-y-4">
            <input type="hidden" name="vesselId" value={vesselId} />
            <div className="space-y-1.5">
              <Label htmlFor="file">Excel file (.xlsx or .xls)</Label>
              <input
                id="file"
                name="file"
                type="file"
                accept=".xlsx,.xls,.xlsm"
                required
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Looks for a standard inventory report layout — an &quot;ITEM CODE&quot; header row, with Unit / Quantity (New, Usable) / Reconditioned /
              Remarks columns. Every sheet in the file is scanned; sheets with no matching table are skipped. You&apos;ll review every row before
              anything is saved.
            </p>
            <Button type="submit" disabled={parsing}>
              {parsing ? "Reading file…" : "Parse file"}
            </Button>
            {parseState.error && <p className="text-sm text-danger">{parseState.error}</p>}
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="accent">{rows.length} row{rows.length === 1 ? "" : "s"} parsed</Badge>
            {parseState.flagged.length > 0 && <Badge tone="warning">{parseState.flagged.length} row(s) need manual review</Badge>}
            <span className="text-muted-foreground">from sheet(s): {parseState.sheetsScanned.join(", ")}</span>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Select
                id="department"
                value={department}
                onChange={(e) => {
                  const d = e.target.value as RequisitionDepartmentValue;
                  setDepartment(d);
                  setCategory("");
                }}
                className="w-40"
              >
                {REQUISITION_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {REQUISITION_DEPARTMENT_LABELS[d]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as StoresCategoryValue)}
                className={`w-48 ${category === "" ? "border-warning" : ""}`}
              >
                <option value="" disabled>
                  Select category…
                </option>
                {STORES_CATEGORIES_BY_DEPARTMENT[department].map((c) => (
                  <option key={c} value={c}>
                    {STORES_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="occurredAt">Effective Date</Label>
              <Input id="occurredAt" type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulkLocation">Set Location for all rows</Label>
              <div className="flex gap-2">
                <Input id="bulkLocation" value={bulkLocation} onChange={(e) => setBulkLocation(e.target.value)} placeholder="e.g. Bosun Store" className="w-48" />
                <Button type="button" variant="outline" size="sm" onClick={applyBulkLocation}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
          {commitState.error && <p className="text-sm text-danger">{commitState.error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">Review parsed rows ({includedRows.length} of {rows.length} included)</div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[1100px] table-fixed text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-40 px-2 py-2 font-medium">Sub Category</th>
                  <th className="min-w-[220px] px-2 py-2 font-medium">Item</th>
                  <th className="w-20 px-2 py-2 font-medium">Unit</th>
                  <th className="w-20 px-2 py-2 font-medium">New</th>
                  <th className="w-20 px-2 py-2 font-medium">Usable</th>
                  <th className="w-24 px-2 py-2 font-medium">Recond.</th>
                  <th className="w-40 px-2 py-2 font-medium">Location</th>
                  <th className="min-w-[180px] px-2 py-2 font-medium">Remarks</th>
                  <th className="w-16 px-2 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className={`border-b border-border last:border-0 ${r.included ? "" : "opacity-40"}`}>
                    <td className="px-2 py-2 align-top">
                      <Input value={r.subGroup ?? ""} onChange={(e) => updateRow(idx, "subGroup", e.target.value || null)} className="h-8 w-full px-1.5 text-xs" />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input value={r.name} onChange={(e) => updateRow(idx, "name", e.target.value)} className="h-8 w-full px-1.5" />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input value={r.unit} onChange={(e) => updateRow(idx, "unit", e.target.value)} className="h-8 w-full px-1.5" />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        type="number"
                        value={r.qtyNew ?? ""}
                        onChange={(e) => updateRow(idx, "qtyNew", e.target.value === "" ? null : Number(e.target.value))}
                        className="h-8 w-full px-1.5"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        type="number"
                        value={r.qtyUsable ?? ""}
                        onChange={(e) => updateRow(idx, "qtyUsable", e.target.value === "" ? null : Number(e.target.value))}
                        className="h-8 w-full px-1.5"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        type="number"
                        value={r.qtyReconditioned ?? ""}
                        onChange={(e) => updateRow(idx, "qtyReconditioned", e.target.value === "" ? null : Number(e.target.value))}
                        className="h-8 w-full px-1.5"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input value={r.location} onChange={(e) => updateRow(idx, "location", e.target.value)} placeholder="e.g. Paint Locker" className="h-8 w-full px-1.5" />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input value={r.remarks ?? ""} onChange={(e) => updateRow(idx, "remarks", e.target.value || null)} className="h-8 w-full px-1.5" />
                    </td>
                    <td className="px-2 py-2 align-top text-right">
                      <button type="button" onClick={() => updateRow(idx, "included", !r.included)} className="text-xs text-muted-foreground hover:text-foreground">
                        {r.included ? "Remove" : "Undo"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {parseState.flagged.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 text-sm font-semibold text-warning">Needs manual review ({parseState.flagged.length})</div>
            <p className="mb-3 text-xs text-muted-foreground">
              These rows didn&apos;t match the expected layout and were not included above — add them by hand afterward (Update Inventory → + Add
              Sub Category / + Add Item) if they&apos;re real items.
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {parseState.flagged.map((f, i) => (
                <div key={i} className="rounded-md border border-border p-2 text-xs">
                  <span className="text-muted-foreground">{f.sourceSheet} — {f.reason}:</span> <span className="font-mono">{f.rawText}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={submitCommit} disabled={committing || includedRows.length === 0 || category === ""}>
          {committing ? "Saving…" : `Save ${includedRows.length} row${includedRows.length === 1 ? "" : "s"}`}
        </Button>
        {category === "" && <p className="text-xs text-warning">Choose a Category above before saving.</p>}
        <button type="button" onClick={() => setRows(null)} className="text-sm text-muted-foreground hover:text-foreground">
          Start over
        </button>
      </div>
    </div>
  );
}
