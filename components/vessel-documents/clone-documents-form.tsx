"use client";

import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { cloneVesselDocumentsAction, type ActionResult } from "@/features/vessel-documents/actions";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CloneDocumentsForm({
  vessels,
  currentVesselId,
}: {
  vessels: { id: string; name: string }[];
  /** The vessel currently filtered to on this page, if any — offers a
   * "this vessel only" scope alongside the fleet-wide default. */
  currentVesselId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sourceVesselId, setSourceVesselId] = useState("");
  const [scope, setScope] = useState<"all" | "current">("all");

  function run() {
    setSuccess(null);
    if (!sourceVesselId) {
      setError("Pick a vessel to copy the document list from");
      return;
    }
    const label = scope === "all" ? "every other active vessel" : "this vessel";
    if (!confirm(`Copy this vessel's document list (as blank entries) to ${label}? Existing documents are left untouched.`)) return;
    setError(null);
    const fd = new FormData();
    fd.set("sourceVesselId", sourceVesselId);
    fd.set("targetVesselId", scope === "current" && currentVesselId ? currentVesselId : "");
    startTransition(async () => {
      const res: ActionResult = await cloneVesselDocumentsAction(fd);
      if (!res.ok) setError(res.error);
      else setSuccess("Copied. Refresh to see the new entries.");
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Copy document list from</label>
        <Select value={sourceVesselId} onChange={(e) => setSourceVesselId(e.target.value)} className="w-56">
          <option value="">Select vessel…</option>
          {vessels.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">To</label>
        <Select value={scope} onChange={(e) => setScope(e.target.value as "all" | "current")} className="w-56">
          <option value="all">All active vessels</option>
          {currentVesselId && <option value="current">This vessel only</option>}
        </Select>
      </div>
      <Button type="button" variant="outline" onClick={run} disabled={pending}>
        <Copy className="h-4 w-4" /> {pending ? "Copying…" : "Copy (blank entries)"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {success && <p className="text-xs text-success">{success}</p>}
    </div>
  );
}
