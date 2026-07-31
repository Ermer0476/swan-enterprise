"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  updateDefectAction,
  deleteDefectAction,
  type ActionResult,
} from "@/features/defects/actions";
import { DEFECT_STATUSES } from "@/features/defects/schema";
import { humanize } from "@/lib/utils";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function DefectStatusForm({
  defectId,
  status,
  actionTaken,
  editable,
  canDelete,
}: {
  defectId: string;
  status: string;
  actionTaken: string;
  editable: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState(status);
  const [action, setAction] = useState(actionTaken);

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("defectId", defectId);
    fd.set("status", statusValue);
    fd.set("actionTaken", action);
    startTransition(async () => {
      const res: ActionResult = await updateDefectAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  function remove() {
    const fd = new FormData();
    fd.set("defectId", defectId);
    startTransition(async () => {
      await deleteDefectAction(fd);
    });
  }

  if (!editable) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Action taken: {actionTaken || "—"}</p>
        {canDelete && (
          <Button variant="outline" onClick={() => { if (confirm("Delete this defect?")) remove(); }} disabled={pending}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs">Action taken</Label>
          <AutoGrowInput value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action taken…" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
            {DEFECT_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </Select>
        </div>
        <Button variant="outline" onClick={save} disabled={pending}>Save</Button>
      </div>
      {canDelete && (
        <Button variant="outline" onClick={() => { if (confirm("Delete this defect?")) remove(); }} disabled={pending}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      )}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
