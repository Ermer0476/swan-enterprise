"use client";

import { useState, useTransition, useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  addObservationAction,
  updateObservationAction,
  deleteObservationAction,
  type ActionResult,
} from "@/features/cdi/actions";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AttachmentList, type AttachmentView } from "@/components/attachments/attachment-list";
import { lifecycleStatusTone } from "@/lib/status";

export type ObservationView = {
  id: string;
  questionRef: string | null;
  observation: string;
  response: string | null;
  status: "OPEN" | "CLOSED";
  attachments: AttachmentView[];
};

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add observation"}
    </Button>
  );
}

function ObservationRow({ obs, editable }: { obs: ObservationView; editable: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState(obs.response ?? "");
  const [status, setStatus] = useState<"OPEN" | "CLOSED">(obs.status);

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("observationId", obs.id);
    fd.set("response", response);
    fd.set("status", status);
    startTransition(async () => {
      const res = await updateObservationAction(fd);
      if (!res.ok) setError(res.error);
    });
  }
  function remove() {
    const fd = new FormData();
    fd.set("observationId", obs.id);
    startTransition(async () => {
      await deleteObservationAction(fd);
    });
  }

  return (
    <li className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {obs.questionRef && <span className="font-mono">Q {obs.questionRef}</span>}
            <Badge tone={lifecycleStatusTone(obs.status)}>
              {obs.status === "CLOSED" ? "Closed" : "Open"}
            </Badge>
          </div>
          <p className="mt-1 text-sm">{obs.observation}</p>
        </div>
        {editable && (
          <button type="button" onClick={remove} disabled={pending} aria-label="Delete observation"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-danger disabled:opacity-30">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {editable ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs">Response / corrective action</Label>
            <AutoGrowInput value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Response…" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as "OPEN" | "CLOSED")} className="w-32">
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
          </Select>
          <Button size="sm" variant="outline" onClick={save} disabled={pending}>Save</Button>
        </div>
      ) : (
        obs.response && <p className="text-sm text-muted-foreground">Response: {obs.response}</p>
      )}

      <div className="space-y-1.5 border-t border-border pt-2">
        <Label className="text-xs">Attachments</Label>
        <AttachmentList
          entityType="CdiObservation"
          entityId={obs.id}
          attachments={obs.attachments}
          editable={editable}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </li>
  );
}

export function ObservationsPanel({
  inspectionId,
  observations,
  editable,
}: {
  inspectionId: string;
  observations: ObservationView[];
  editable: boolean;
}) {
  const [addState, addAction] = useActionState<ActionResult, FormData>(
    addObservationAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (addState.ok) formRef.current?.reset();
  }, [addState.ok]);

  return (
    <div className="space-y-4">
      {observations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No observations recorded.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {observations.map((o) => <ObservationRow key={o.id} obs={o} editable={editable} />)}
        </ul>
      )}

      {editable && (
        <form ref={formRef} action={addAction}
          className="grid grid-cols-1 items-end gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[8rem_1fr_auto]">
          <input type="hidden" name="inspectionId" value={inspectionId} />
          <div className="space-y-1">
            <Label className="text-xs">Question ref</Label>
            <AutoGrowInput name="questionRef" placeholder="e.g. 5.2.1" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observation</Label>
            <AutoGrowInput name="observation" placeholder="Describe the observation" required />
          </div>
          <AddButton />
          {addState.error && <p className="text-sm text-danger sm:col-span-3">{addState.error}</p>}
        </form>
      )}
    </div>
  );
}
