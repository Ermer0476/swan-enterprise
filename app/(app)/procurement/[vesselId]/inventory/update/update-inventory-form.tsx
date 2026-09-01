"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveInventoryUpdateDraftAction, updateInventoryAction, updateStoresItemCategoryAction } from "@/features/procurement/actions";
import {
  INVENTORY_CONDITIONS,
  INVENTORY_CONDITION_LABELS,
  STORES_CATEGORIES_BY_DEPARTMENT,
  STORES_CATEGORY_LABELS,
  type InventoryConditionValue,
  type RequisitionDepartmentValue,
  type StoresCategoryValue,
} from "@/features/procurement/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Input, AutoGrowInput, Select } from "@/components/ui/input";
import { ComboboxInput } from "@/components/ui/combobox-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AddItemToGroupForm } from "./add-item-to-group-form";

type Row = {
  itemType: "STORES" | "SPARES";
  itemId: string;
  label: string;
  unit: string;
  // Per-condition, not a single lumped figure — a recount is only meaningful
  // against the same condition's own running balance.
  robByCondition: Record<InventoryConditionValue, number>;
  currentLocation: string;
  currentRemarks: string;
  category: StoresCategoryValue | null;
  subGroup: string | null;
  groupLabel: string;
};
// `quantity` is the recounted total on board right now, not a delta — blank
// means "not touched this session." The event's signed quantity/eventType
// (Issued for a lower count, Adjustment for higher or placement-only) is
// derived from it, never chosen directly.
type RowState = { quantity: string; condition: InventoryConditionValue; reason: string; location: string; remarks: string };
type DraftLine = {
  itemType: "STORES" | "SPARES";
  itemId: string;
  condition: InventoryConditionValue;
  quantity: number | null;
  reason?: string;
  location?: string;
  remarks?: string;
};
type Draft = { id: string; occurredAt: string; updatedAt: Date; lines: DraftLine[] };

function rowKey(r: { itemType: string; itemId: string }) {
  return `${r.itemType}:${r.itemId}`;
}

function editsFromDraft(draft: Draft | null): Record<string, RowState> {
  if (!draft) return {};
  const out: Record<string, RowState> = {};
  for (const l of draft.lines) {
    out[rowKey(l)] = {
      quantity: l.quantity === null || l.quantity === undefined ? "" : String(l.quantity),
      condition: l.condition,
      reason: l.reason ?? "",
      location: l.location ?? "",
      remarks: l.remarks ?? "",
    };
  }
  return out;
}

export function UpdateInventoryForm({
  vesselId,
  department,
  category,
  rows,
  knownLocations,
  backHref,
  draft,
}: {
  vesselId: string;
  department: RequisitionDepartmentValue | null;
  category: StoresCategoryValue | null;
  rows: Row[];
  knownLocations: string[];
  backHref: string;
  draft: Draft | null;
}) {
  const router = useRouter();
  const [occurredAt, setOccurredAt] = useState(() => draft?.occurredAt ?? new Date().toISOString().slice(0, 10));
  const [edits, setEdits] = useState<Record<string, RowState>>(() => editsFromDraft(draft));
  const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(draft?.updatedAt ?? null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [savingDraft, startSavingDraft] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Category is a catalogue fix, not a ledger event — it saves immediately
  // on change (like Department/IMPA in the catalogue admin page) instead of
  // going through Save Draft / Post to Ledger. A row that gets recategorized
  // stays put for the rest of this session (it'll fall out of this scope
  // next time the page loads) so an in-progress qty/location edit isn't lost.
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, StoresCategoryValue>>({});
  const [savingCategoryKeys, setSavingCategoryKeys] = useState<Set<string>>(new Set());
  const [categoryErrors, setCategoryErrors] = useState<Record<string, string>>({});

  function currentCategory(r: Row): StoresCategoryValue | null {
    return categoryOverrides[rowKey(r)] ?? r.category;
  }

  async function saveCategory(r: Row, next: StoresCategoryValue) {
    const key = rowKey(r);
    setCategoryErrors((prev) => {
      const p = { ...prev };
      delete p[key];
      return p;
    });
    setSavingCategoryKeys((prev) => new Set(prev).add(key));
    const fd = new FormData();
    fd.set("itemId", r.itemId);
    fd.set("category", next);
    const result = await updateStoresItemCategoryAction({ ok: false, error: null }, fd);
    setSavingCategoryKeys((prev) => {
      const s = new Set(prev);
      s.delete(key);
      return s;
    });
    if (result.ok) {
      setCategoryOverrides((prev) => ({ ...prev, [key]: next }));
    } else {
      setCategoryErrors((prev) => ({ ...prev, [key]: result.error ?? "Failed to save" }));
    }
  }

  const groups = useMemo(() => {
    const byGroup = new Map<string, Row[]>();
    for (const r of rows) {
      const list = byGroup.get(r.groupLabel) ?? [];
      list.push(r);
      byGroup.set(r.groupLabel, list);
    }
    return Array.from(byGroup.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  // Location and Remarks fall back to the item's last-known values whenever
  // they haven't been touched (whether freshly rendered or loaded from a
  // draft that carried them blank) — everything else defaults to blank/USABLE.
  function valuesFor(r: Row): RowState {
    const e = edits[rowKey(r)];
    return {
      quantity: e?.quantity ?? "",
      condition: e?.condition ?? "USABLE",
      reason: e?.reason ?? "",
      location: e?.location || r.currentLocation,
      remarks: e?.remarks || r.currentRemarks,
    };
  }
  function setField<K extends keyof RowState>(r: Row, field: K, value: RowState[K]) {
    setEdits((prev) => ({ ...prev, [rowKey(r)]: { ...valuesFor(r), [field]: value } }));
  }

  // Diffs the typed recount against this row's own current ROB (for whatever
  // condition is selected) to work out what this row would actually post as
  // — same computation the server redoes for real at submit time, this is
  // just the live preview driving the UI (changed-count, reason gating).
  function computeChange(r: Row, v: RowState) {
    const currentRob = r.robByCondition[v.condition] ?? 0;
    const hasCount = v.quantity.trim() !== "";
    const delta = hasCount ? Number(v.quantity) - currentRob : 0;
    const locationChanged = v.location.trim() !== r.currentLocation.trim();
    const remarksChanged = v.remarks.trim() !== r.currentRemarks.trim();
    const changed = delta !== 0 || locationChanged || remarksChanged;
    // A lower count reads as Issued (consumption); anything else that still
    // counts as a change — a higher count, or a placement-only touch with no
    // count movement — posts as an Adjustment.
    const eventType: "ISSUED" | "ADJUSTMENT" = delta < 0 ? "ISSUED" : "ADJUSTMENT";
    const reasonRequired = changed && eventType === "ADJUSTMENT";
    return { currentRob, hasCount, delta, changed, eventType, reasonRequired, locationChanged, remarksChanged };
  }

  const changedCount = rows.filter((r) => computeChange(r, valuesFor(r)).changed).length;

  function saveDraft() {
    setError(null);
    // Draft is a checkpoint — every row goes in as-is (even untouched), so
    // reopening the page restores exactly what was there, not just the rows
    // that happened to have a count typed yet.
    const lines = rows.map((r) => {
      const v = valuesFor(r);
      return {
        itemType: r.itemType,
        itemId: r.itemId,
        condition: v.condition,
        quantity: v.quantity.trim() === "" ? null : Number(v.quantity),
        reason: v.reason,
        location: v.location,
        remarks: v.remarks,
      };
    });

    const fd = new FormData();
    fd.set("vesselId", vesselId);
    if (department) fd.set("department", department);
    if (category) fd.set("category", category);
    fd.set("occurredAt", occurredAt);
    fd.set("lines", JSON.stringify(lines));
    startSavingDraft(async () => {
      const result = await saveInventoryUpdateDraftAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.draftId) setDraftId(result.draftId);
      setDraftSavedAt(new Date());
    });
  }

  const submit = () => {
    setError(null);
    const touched = rows
      .map((r) => {
        const v = valuesFor(r);
        return { r, v, c: computeChange(r, v) };
      })
      .filter(({ c }) => c.changed);

    if (touched.length === 0) {
      setError("Enter at least one quantity or location change before saving.");
      setConfirming(false);
      return;
    }

    const lines = touched.map(({ r, v, c }) => {
      let reason = v.reason.trim();
      // A placement-only touch (no count typed, just Location/Remarks)
      // defaults to a plain reason instead of forcing the crew to type one
      // for something this obvious — a real higher-count Adjustment still
      // needs their own reason, caught below.
      if (!reason && !c.hasCount && c.eventType === "ADJUSTMENT") {
        reason = c.locationChanged ? "Relocated" : "Updated remarks";
      }
      return {
        itemType: r.itemType,
        itemId: r.itemId,
        condition: v.condition,
        quantity: c.hasCount ? Number(v.quantity) : null,
        reason,
        location: v.location,
        remarks: v.remarks,
      };
    });

    const missingReason = touched.some(({ c }, i) => c.reasonRequired && !lines[i]!.reason.trim());
    if (missingReason) {
      setError("A reason is required when the counted quantity is higher than what's on record, or for a placement-only update.");
      setConfirming(false);
      return;
    }

    const fd = new FormData();
    fd.set("vesselId", vesselId);
    fd.set("occurredAt", occurredAt);
    fd.set("lines", JSON.stringify(lines));
    if (draftId) fd.set("draftId", draftId);
    start(async () => {
      const result = await updateInventoryAction(fd);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.push(backHref);
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Effective Date</label>
            <Input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className="w-44" />
          </div>
          <p className="pb-2 text-xs text-muted-foreground">
            Applies to every row saved in this update. Enter the quantity that&apos;s actually on board now — not how many were used.
          </p>
          {draftSavedAt && (
            <div className="ml-auto pb-2">
              <Badge tone="warning">Draft saved {draftSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {groups.map(([groupLabel, groupRows]) => (
        <Card key={groupLabel}>
          <CardContent className="pt-5">
            <div className="mb-3 text-sm font-semibold">{groupLabel}</div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[960px] table-fixed text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="min-w-[180px] px-2 py-2 font-medium">Item</th>
                    {department !== null && <th className="w-28 px-2 py-2 font-medium">Category</th>}
                    <th className="w-32 px-2 py-2 font-medium">Location</th>
                    <th className="w-28 px-2 py-2 font-medium">Remarks</th>
                    <th className="w-28 px-2 py-2 font-medium">Condition</th>
                    <th className="w-16 px-2 py-2 font-medium text-right">Current</th>
                    <th className="w-24 px-2 py-2 font-medium">New Count</th>
                    <th className="min-w-[140px] px-2 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((r) => {
                    const v = valuesFor(r);
                    const c = computeChange(r, v);
                    return (
                      <tr key={rowKey(r)} className="border-b border-border last:border-0">
                        <td className="px-2 py-2 align-top">{r.label}</td>
                        {department !== null && (
                          <td className="px-2 py-2 align-top">
                            <Select
                              value={currentCategory(r) ?? "DECK"}
                              onChange={(e) => saveCategory(r, e.target.value as StoresCategoryValue)}
                              disabled={savingCategoryKeys.has(rowKey(r))}
                              className="h-8 px-1.5 text-xs"
                            >
                              {STORES_CATEGORIES_BY_DEPARTMENT[department].map((cat) => (
                                <option key={cat} value={cat}>
                                  {STORES_CATEGORY_LABELS[cat]}
                                </option>
                              ))}
                            </Select>
                            {categoryErrors[rowKey(r)] && <p className="mt-1 text-xs text-danger">{categoryErrors[rowKey(r)]}</p>}
                          </td>
                        )}
                        <td className="px-2 py-2 align-top">
                          <ComboboxInput
                            defaultValue={v.location}
                            suggestions={knownLocations}
                            onChange={(val) => setField(r, "location", val)}
                            placeholder="e.g. Paint Locker"
                            className="h-8 w-full px-1.5"
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          <AutoGrowInput
                            value={v.remarks}
                            onChange={(e) => setField(r, "remarks", e.target.value)}
                            placeholder="e.g. Box No. 2"
                            className="w-full px-1.5 py-1 text-sm"
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          <Select value={v.condition} onChange={(e) => setField(r, "condition", e.target.value as InventoryConditionValue)} className="h-8 px-1.5 text-xs">
                            {INVENTORY_CONDITIONS.map((cond) => (
                              <option key={cond} value={cond}>
                                {INVENTORY_CONDITION_LABELS[cond]}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-2 py-2 align-top text-right tabular-nums text-muted-foreground">
                          {c.currentRob} {r.unit}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <Input
                            type="number"
                            step="any"
                            value={v.quantity}
                            onChange={(e) => setField(r, "quantity", e.target.value)}
                            placeholder={String(c.currentRob)}
                            className="h-8 w-full px-1.5"
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          {c.reasonRequired ? (
                            <Input
                              value={v.reason}
                              onChange={(e) => setField(r, "reason", e.target.value)}
                              placeholder={c.hasCount ? "Why the count is higher" : "e.g. Damaged, found short"}
                              className="h-8 w-full px-1.5"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {department !== null && groupRows[0] && groupRows[0].category && (
              <AddItemToGroupForm
                vesselId={vesselId}
                department={department}
                category={groupRows[0].category}
                subGroup={groupRows[0].subGroup}
              />
            )}
          </CardContent>
        </Card>
      ))}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={saveDraft} disabled={savingDraft || pending}>
          {savingDraft ? "Saving Draft…" : "Save Draft"}
        </Button>
        <Button type="button" onClick={() => setConfirming(true)} disabled={pending || savingDraft || changedCount === 0}>
          Post to Ledger ({changedCount} changed)
        </Button>
        <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </Link>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Post these inventory updates?"
        description={`${changedCount} row${changedCount === 1 ? "" : "s"} will be logged as of ${occurredAt}. This can't be edited afterward — a correction is a new event.`}
        confirmLabel="Post"
        confirming={pending}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
