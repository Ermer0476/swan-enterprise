"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2, Copy } from "lucide-react";
import {
  createScheduleItemAction,
  updateScheduleItemAction,
  deleteScheduleItemAction,
  cloneFlagScheduleAction,
} from "@/features/schedule/actions";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ScheduleItemRow = {
  id: string;
  kind: "DRILL" | "FAMILIARIZATION";
  flag: string;
  category: string | null;
  itemNo: string | null;
  name: string;
  smsReference: string | null;
  frequencyLabel: string | null;
  frequencyDays: number | null;
  sortOrder: number;
};

function ItemRow({ item, onSaved }: { item: ScheduleItemRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(item.category ?? "");
  const [itemNo, setItemNo] = useState(item.itemNo ?? "");
  const [name, setName] = useState(item.name);
  const [smsReference, setSmsReference] = useState(item.smsReference ?? "");
  const [frequencyLabel, setFrequencyLabel] = useState(item.frequencyLabel ?? "");
  const [frequencyDays, setFrequencyDays] = useState(item.frequencyDays?.toString() ?? "");

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("kind", item.kind);
    fd.set("flag", item.flag);
    fd.set("category", category);
    fd.set("itemNo", itemNo);
    fd.set("name", name);
    fd.set("smsReference", smsReference);
    fd.set("frequencyLabel", frequencyLabel);
    fd.set("frequencyDays", frequencyDays);
    startTransition(async () => {
      const res = await updateScheduleItemAction(fd);
      if (!res.ok) setError(res.error);
      else {
        setEditing(false);
        onSaved();
      }
    });
  }

  function remove() {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const fd = new FormData();
    fd.set("id", item.id);
    startTransition(async () => {
      const res = await deleteScheduleItemAction(fd);
      if (!res.ok) setError(res.error);
      else onSaved();
    });
  }

  if (!editing) {
    return (
      <tr className="border-b border-border last:border-0 hover:bg-muted/30">
        <td className="px-3 py-2 text-xs text-muted-foreground">{item.itemNo ?? "—"}</td>
        <td className="px-3 py-2">{item.name}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{item.category ?? "—"}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{item.smsReference ?? "—"}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{item.frequencyLabel ?? "As required"}</td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
            <button type="button" onClick={remove} disabled={pending} aria-label="Delete item"
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger disabled:opacity-30">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border bg-muted/20 last:border-0">
      <td className="px-3 py-2"><Input value={itemNo} onChange={(e) => setItemNo(e.target.value)} className="w-16" /></td>
      <td className="px-3 py-2"><AutoGrowInput value={name} onChange={(e) => setName(e.target.value)} /></td>
      <td className="px-3 py-2"><Input value={category} onChange={(e) => setCategory(e.target.value)} className="w-36" /></td>
      <td className="px-3 py-2"><Input value={smsReference} onChange={(e) => setSmsReference(e.target.value)} className="w-24" /></td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <Input value={frequencyLabel} onChange={(e) => setFrequencyLabel(e.target.value)} placeholder="e.g. Once in 3 months" className="w-40" />
          <Input value={frequencyDays} onChange={(e) => setFrequencyDays(e.target.value)} placeholder="Days" type="number" className="w-40" />
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="success" onClick={save} disabled={pending}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>Cancel</Button>
        </div>
      </td>
      {error && (
        <td colSpan={6} className="px-3 pb-2 text-xs text-danger">{error}</td>
      )}
    </tr>
  );
}

function AddItemForm({ kind, flag, onAdded }: { kind: "DRILL" | "FAMILIARIZATION"; flag: string; onAdded: () => void }) {
  const [show, setShow] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [itemNo, setItemNo] = useState("");
  const [name, setName] = useState("");
  const [smsReference, setSmsReference] = useState("");
  const [frequencyLabel, setFrequencyLabel] = useState("");
  const [frequencyDays, setFrequencyDays] = useState("");

  function reset() {
    setCategory(""); setItemNo(""); setName(""); setSmsReference(""); setFrequencyLabel(""); setFrequencyDays("");
  }

  function add() {
    setError(null);
    if (!name.trim()) { setError("Name is required"); return; }
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("flag", flag);
    fd.set("category", category);
    fd.set("itemNo", itemNo);
    fd.set("name", name);
    fd.set("smsReference", smsReference);
    fd.set("frequencyLabel", frequencyLabel);
    fd.set("frequencyDays", frequencyDays);
    startTransition(async () => {
      const res = await createScheduleItemAction(fd);
      if (!res.ok) setError(res.error);
      else { reset(); setShow(false); onAdded(); }
    });
  }

  if (!show) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setShow(true)}>
        <Plus className="h-4 w-4" /> Add item
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Item no.</Label>
          <Input value={itemNo} onChange={(e) => setItemNo(e.target.value)} placeholder="e.g. 1.0" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Category (section heading)</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. STATUTORY DRILLS" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">SMS reference</Label>
          <Input value={smsReference} onChange={(e) => setSmsReference(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Name</Label>
        <AutoGrowInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fire Drill" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Frequency label</Label>
          <Input value={frequencyLabel} onChange={(e) => setFrequencyLabel(e.target.value)} placeholder="e.g. Once in a month" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Frequency (days)</Label>
          <Input value={frequencyDays} onChange={(e) => setFrequencyDays(e.target.value)} type="number" placeholder="Blank = as required" />
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={add} disabled={pending}>{pending ? "Adding…" : "Add"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShow(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function ItemsTable({ kind, flag, items, onChanged }: {
  kind: "DRILL" | "FAMILIARIZATION";
  flag: string;
  items: ScheduleItemRow[];
  onChanged: () => void;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">No.</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">SMS Ref</th>
                <th className="px-3 py-2 font-medium">Frequency</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => <ItemRow key={i.id} item={i} onSaved={onChanged} />)}
            </tbody>
          </table>
        </div>
      )}
      <AddItemForm kind={kind} flag={flag} onAdded={onChanged} />
    </div>
  );
}

export function FlagScheduleManager({
  flags,
  flagsWithItems,
  selectedFlag,
  drillItems,
  familiarizationItems,
}: {
  flags: string[];
  flagsWithItems: string[];
  selectedFlag: string;
  drillItems: ScheduleItemRow[];
  familiarizationItems: ScheduleItemRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cloneError, setCloneError] = useState<string | null>(null);
  const flagsWithItemsSet = new Set(flagsWithItems);
  const hasOwnSet = selectedFlag ? flagsWithItemsSet.has(selectedFlag) : true;

  function refresh() {
    router.refresh();
  }

  function selectFlag(flag: string) {
    const params = new URLSearchParams();
    if (flag) params.set("flag", flag);
    router.push(`/settings/flag-drill-schedules${params.toString() ? `?${params}` : ""}`);
  }

  function cloneFromDefault() {
    setCloneError(null);
    const fd1 = new FormData();
    fd1.set("kind", "DRILL");
    fd1.set("sourceFlag", "");
    fd1.set("targetFlag", selectedFlag);
    const fd2 = new FormData();
    fd2.set("kind", "FAMILIARIZATION");
    fd2.set("sourceFlag", "");
    fd2.set("targetFlag", selectedFlag);
    startTransition(async () => {
      const [r1, r2] = await Promise.all([cloneFlagScheduleAction(fd1), cloneFlagScheduleAction(fd2)]);
      if (!r1.ok) setCloneError(r1.error);
      else if (!r2.ok) setCloneError(r2.error);
      else refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 pt-4">
          <div className="space-y-1">
            <Label className="text-xs">Flag</Label>
            <Select value={selectedFlag} onChange={(e) => selectFlag(e.target.value)} className="w-64">
              <option value="">Default (fleet-wide fallback)</option>
              {flags.map((f) => (
                <option key={f} value={f}>
                  {f}{flagsWithItemsSet.has(f) ? "" : " — using default"}
                </option>
              ))}
            </Select>
          </div>
          {selectedFlag && !hasOwnSet && (
            <Button type="button" variant="outline" onClick={cloneFromDefault} disabled={pending}>
              <Copy className="h-4 w-4" /> {pending ? "Copying…" : "Clone from Default"}
            </Button>
          )}
          {cloneError && <p className="text-sm text-danger">{cloneError}</p>}
        </CardContent>
      </Card>

      {selectedFlag && !hasOwnSet && (
        <p className="text-sm text-muted-foreground">
          {selectedFlag} has no schedule of its own yet — every vessel flying this flag is currently using the
          Default set below. Clone the Default set to start, or add items directly to create a dedicated set.
        </p>
      )}

      <Card>
        <CardContent className="pt-4">
          <h3 className="mb-3 text-sm font-semibold">Drills</h3>
          <ItemsTable kind="DRILL" flag={selectedFlag} items={drillItems} onChanged={refresh} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <h3 className="mb-3 text-sm font-semibold">Familiarization</h3>
          <ItemsTable kind="FAMILIARIZATION" flag={selectedFlag} items={familiarizationItems} onChanged={refresh} />
        </CardContent>
      </Card>
    </div>
  );
}
