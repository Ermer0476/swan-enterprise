"use client";

import { useState, useTransition, useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  addDeficiencyAction,
  updateDeficiencyAction,
  deleteDeficiencyAction,
  type ActionResult,
} from "@/features/psc/actions";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type DeficiencyView = {
  id: string;
  natureCode: string | null;
  reference: string | null;
  actionCode: string | null;
  description: string;
  rectification: string | null;
  status: "OPEN" | "CLOSED";
};

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add deficiency"}
    </Button>
  );
}

function DeficiencyRow({ def, editable }: { def: DeficiencyView; editable: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rectification, setRectification] = useState(def.rectification ?? "");
  const [status, setStatus] = useState<"OPEN" | "CLOSED">(def.status);

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("deficiencyId", def.id);
    fd.set("rectification", rectification);
    fd.set("status", status);
    startTransition(async () => {
      const res = await updateDeficiencyAction(fd);
      if (!res.ok) setError(res.error);
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
    <li className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {def.natureCode && <span className="font-mono">Code {def.natureCode}</span>}
            {def.reference && <span>· {def.reference}</span>}
            {def.actionCode && <Badge tone="accent">Action {def.actionCode}</Badge>}
            <Badge tone={def.status === "CLOSED" ? "success" : "warning"}>
              {def.status === "CLOSED" ? "Rectified" : "Open"}
            </Badge>
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

      {editable ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs">Rectification / action taken</Label>
            <AutoGrowInput value={rectification} onChange={(e) => setRectification(e.target.value)} placeholder="Action taken…" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as "OPEN" | "CLOSED")} className="w-36">
            <option value="OPEN">Open</option>
            <option value="CLOSED">Rectified</option>
          </Select>
          <Button size="sm" variant="outline" onClick={save} disabled={pending}>Save</Button>
        </div>
      ) : (
        def.rectification && <p className="text-sm text-muted-foreground">Rectification: {def.rectification}</p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </li>
  );
}

export function DeficienciesPanel({
  inspectionId,
  deficiencies,
  editable,
}: {
  inspectionId: string;
  deficiencies: DeficiencyView[];
  editable: boolean;
}) {
  const [addState, addAction] = useActionState<ActionResult, FormData>(
    addDeficiencyAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (addState.ok) formRef.current?.reset();
  }, [addState.ok]);

  return (
    <div className="space-y-4">
      {deficiencies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deficiencies recorded.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {deficiencies.map((d) => <DeficiencyRow key={d.id} def={d} editable={editable} />)}
        </ul>
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
