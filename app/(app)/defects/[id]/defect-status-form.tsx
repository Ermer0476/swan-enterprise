"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  updateDefectAction,
  deleteDefectAction,
  type ActionResult,
} from "@/features/defects/actions";
import { DEFECT_STATUSES } from "@/features/defects/schema";
import { humanize, formatDate } from "@/lib/utils";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function DefectStatusForm({
  defectId,
  status,
  actionTaken,
  targetRectificationDate,
  rectifiedAt,
  editable,
  canDelete,
}: {
  defectId: string;
  status: string;
  actionTaken: string;
  /** ISO date (YYYY-MM-DD) or "" — the target close-out date. */
  targetRectificationDate: string;
  /** ISO datetime or null — when this defect was actually closed out. */
  rectifiedAt: string | null;
  editable: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState(status);
  const [action, setAction] = useState(actionTaken);
  const [targetDate, setTargetDate] = useState(targetRectificationDate);
  const [rectifiedDate, setRectifiedDate] = useState(rectifiedAt ? rectifiedAt.slice(0, 10) : "");

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("defectId", defectId);
    fd.set("status", statusValue);
    fd.set("actionTaken", action);
    fd.set("targetRectificationDate", targetDate);
    fd.set("rectifiedAt", rectifiedDate);
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

  // Rectified is a closed record — status, action taken and target date
  // freeze at whatever they were the moment it closed (same convention as
  // CAPA/NCR closure elsewhere), so nothing here is editable once closed,
  // regardless of RBAC. The date it closed is shown instead of an input.
  const isClosed = status === "RECTIFIED";

  if (!editable || isClosed) {
    return (
      <div className="space-y-2">
        {isClosed && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">Closed — Rectified</Badge>
            {rectifiedAt && <span className="text-xs text-muted-foreground">on {formatDate(rectifiedAt)}</span>}
          </div>
        )}
        <p className="text-sm text-muted-foreground">Action taken: {actionTaken || "—"}</p>
        <p className="text-sm text-muted-foreground">
          Target rectification date: {targetRectificationDate ? formatDate(targetRectificationDate) : "—"}
        </p>
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs">Action taken</Label>
          <AutoGrowInput value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action taken…" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Target rectification date</Label>
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
            {DEFECT_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </Select>
        </div>
        <Button variant="outline" onClick={save} disabled={pending}>Save</Button>
      </div>
      {statusValue === "RECTIFIED" && (
        <div className="space-y-1">
          <Label className="text-xs">Date rectified</Label>
          <Input type="date" value={rectifiedDate} onChange={(e) => setRectifiedDate(e.target.value)} className="w-40" />
          <p className="text-xs text-muted-foreground">
            Enter the actual date it was rectified — saving closes this defect and it can no longer be edited afterward.
          </p>
        </div>
      )}
      {canDelete && (
        <Button variant="outline" onClick={() => { if (confirm("Delete this defect?")) remove(); }} disabled={pending}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      )}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
