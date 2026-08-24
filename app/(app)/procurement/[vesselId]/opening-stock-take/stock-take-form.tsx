"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postOpeningStockTakeAction } from "@/features/procurement/actions";
import {
  INVENTORY_CONDITIONS,
  INVENTORY_CONDITION_LABELS,
  REQUISITION_DEPARTMENT_LABELS,
  type InventoryConditionValue,
  type RequisitionDepartmentValue,
} from "@/features/procurement/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ComboboxInput } from "@/components/ui/combobox-input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Row = {
  itemType: "STORES" | "SPARES";
  itemId: string;
  label: string;
  unit: string;
  department: RequisitionDepartmentValue | null;
  groupLabel: string;
  location: string | null;
  locationEditable: boolean;
};

// Spares doesn't carry a department yet, so its rows fall into their own
// "Spares" section rather than under Deck or Engine.
const SPARES_SECTION = "Spares";

export function StockTakeForm({ vesselId, rows, knownLocations }: { vesselId: string; rows: Row[]; knownLocations: string[] }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [location, setLocation] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Two-level grouping — Department first (Deck, then Engine, then Spares
  // last since it isn't department-scoped), Category/location within each.
  const sections = useMemo(() => {
    const bySection = new Map<string, Map<string, Row[]>>();
    for (const r of rows) {
      const sectionLabel = r.department ? REQUISITION_DEPARTMENT_LABELS[r.department] : SPARES_SECTION;
      const byGroup = bySection.get(sectionLabel) ?? new Map<string, Row[]>();
      const list = byGroup.get(r.groupLabel) ?? [];
      list.push(r);
      byGroup.set(r.groupLabel, list);
      bySection.set(sectionLabel, byGroup);
    }
    const order = [REQUISITION_DEPARTMENT_LABELS.DECK, REQUISITION_DEPARTMENT_LABELS.ENGINE, SPARES_SECTION];
    return order
      .filter((label) => bySection.has(label))
      .map((label) => ({
        sectionLabel: label,
        groups: Array.from(bySection.get(label)!.entries()).sort(([a], [b]) => a.localeCompare(b)),
      }));
  }, [rows]);

  const countedCount = Object.values(qty).filter((v) => Number(v) > 0).length;

  const submit = () => {
    const lines: {
      itemType: "STORES" | "SPARES";
      itemId: string;
      condition: InventoryConditionValue;
      qtyCounted: number;
      location: string;
      remarks: string;
    }[] = [];
    for (const r of rows) {
      const rowKey = `${r.itemType}:${r.itemId}`;
      const lineLocation = r.locationEditable ? (location[rowKey] ?? "").trim() : r.location ?? "";
      const lineRemarks = r.locationEditable ? (remarks[rowKey] ?? "").trim() : "";
      for (const condition of INVENTORY_CONDITIONS) {
        const value = Number(qty[`${rowKey}:${condition}`] ?? 0);
        if (value > 0) lines.push({ itemType: r.itemType, itemId: r.itemId, condition, qtyCounted: value, location: lineLocation, remarks: lineRemarks });
      }
    }

    const fd = new FormData();
    fd.set("vesselId", vesselId);
    fd.set("lines", JSON.stringify(lines));
    start(async () => {
      const result = await postOpeningStockTakeAction(fd);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {sections.map(({ sectionLabel, groups }) => (
        <div key={sectionLabel} className="space-y-4">
          <h2 className="text-base font-semibold">{sectionLabel}</h2>
          {groups.map(([groupLabel, groupRows]) => (
            <Card key={groupLabel}>
              <CardContent className="pt-5">
                <div className="mb-3 text-sm font-semibold">{groupLabel}</div>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Item</th>
                        <th className="px-3 py-2 font-medium">Unit</th>
                        <th className="px-3 py-2 font-medium">Location</th>
                        <th className="px-3 py-2 font-medium">Remarks</th>
                        {INVENTORY_CONDITIONS.map((c) => (
                          <th key={c} className="px-3 py-2 font-medium">{INVENTORY_CONDITION_LABELS[c]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupRows.map((r) => {
                        const rowKey = `${r.itemType}:${r.itemId}`;
                        return (
                          <tr key={rowKey} className="border-b border-border last:border-0">
                            <td className="px-3 py-2">{r.label}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.unit}</td>
                            <td className="px-3 py-2">
                              {r.locationEditable ? (
                                <ComboboxInput
                                  defaultValue={location[rowKey] ?? ""}
                                  suggestions={knownLocations}
                                  onChange={(val) => setLocation((prev) => ({ ...prev, [rowKey]: val }))}
                                  className="h-8 w-40"
                                  placeholder="e.g. Bosun Store"
                                />
                              ) : (
                                <span className="text-muted-foreground">{r.location ?? "—"}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {r.locationEditable ? (
                                <Input
                                  type="text"
                                  className="h-8 w-32"
                                  placeholder="e.g. Box No. 3"
                                  value={remarks[rowKey] ?? ""}
                                  onChange={(e) => setRemarks((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                                />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            {INVENTORY_CONDITIONS.map((c) => {
                              const key = `${rowKey}:${c}`;
                              return (
                                <td key={c} className="px-3 py-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step="any"
                                    className="h-8 w-24"
                                    value={qty[key] ?? ""}
                                    onChange={(e) => setQty((prev) => ({ ...prev, [key]: e.target.value }))}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => setConfirming(true)} disabled={pending || countedCount === 0}>
          Post Opening Stock Take ({countedCount} counted)
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Post the Opening Stock Take?"
        description="This is a one-time action — it cannot be undone or re-posted. Every counted quantity becomes the vessel's opening inventory balance."
        confirmLabel="Post"
        confirming={pending}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
