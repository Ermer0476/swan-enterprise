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
import { CDI_OBSERVATION_CATEGORIES, CDI_OBSERVATION_CATEGORY_LABELS } from "@/features/cdi/schema";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_LABELS,
  ROOT_CAUSE_SUBCATEGORIES,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
  formatRootCause,
  type RootCauseCategoryValue,
} from "@/lib/root-cause";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AttachmentList, type AttachmentView } from "@/components/attachments/attachment-list";
import { lifecycleStatusTone } from "@/lib/status";

type Category = (typeof CDI_OBSERVATION_CATEGORIES)[number];

export type ObservationView = {
  id: string;
  questionRef: string | null;
  category: Category | null;
  observation: string;
  response: string | null;
  status: "OPEN" | "CLOSED";
  rootCauseCategory: RootCauseCategoryValue | null;
  rootCauseSubCategory: string | null;
  rootCause: string | null;
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
  const [category, setCategory] = useState<Category | "">(obs.category ?? "");
  const [rcCategory, setRcCategory] = useState<RootCauseCategoryValue | "">(obs.rootCauseCategory ?? "");
  const [rcSubCategory, setRcSubCategory] = useState(obs.rootCauseSubCategory ?? "");
  const [rootCause, setRootCause] = useState(obs.rootCause ?? "");

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("observationId", obs.id);
    fd.set("response", response);
    fd.set("status", status);
    fd.set("category", category);
    fd.set("rootCauseCategory", rcCategory);
    fd.set("rootCauseSubCategory", rcSubCategory);
    fd.set("rootCause", rootCause);
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

  const subOptions = rcCategory ? ROOT_CAUSE_SUBCATEGORIES[rcCategory] : null;

  return (
    <li className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {obs.questionRef && <span className="font-mono">Q {obs.questionRef}</span>}
            {obs.category && <Badge tone="neutral">{CDI_OBSERVATION_CATEGORY_LABELS[obs.category]}</Badge>}
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

      <div className="rounded-md border border-border p-3">
        <h4 className="mb-2 text-sm font-semibold">Root cause</h4>
        {editable ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value as Category)} required>
                <option value="" disabled>— Select category —</option>
                {CDI_OBSERVATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CDI_OBSERVATION_CATEGORY_LABELS[c]}</option>
                ))}
              </Select>
            </div>
            <div />
            <div className="space-y-1">
              <Label className="text-xs">Root cause category</Label>
              <Select
                value={rcCategory}
                onChange={(e) => {
                  setRcCategory(e.target.value as RootCauseCategoryValue | "");
                  setRcSubCategory("");
                }}
                required
              >
                <option value="" disabled>— Select root cause —</option>
                {ROOT_CAUSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{ROOT_CAUSE_LABELS[c]}</option>
                ))}
              </Select>
            </div>
            {subOptions && (
              <div className="space-y-1">
                <Label className="text-xs">Sub-category</Label>
                <Select value={rcSubCategory} onChange={(e) => setRcSubCategory(e.target.value)}>
                  <option value="" disabled>— Select sub-category —</option>
                  {subOptions.map((s) => (
                    <option key={s} value={s}>{ROOT_CAUSE_SUBCATEGORY_LABELS[rcCategory as RootCauseCategoryValue][s]}</option>
                  ))}
                </Select>
              </div>
            )}
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Root cause description</Label>
              <AutoGrowInput
                className="max-h-none"
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                placeholder="Explain the underlying cause identified during investigation…"
              />
            </div>
          </div>
        ) : obs.rootCauseCategory ? (
          <div className="space-y-1">
            <p className="text-sm">{formatRootCause(obs.rootCauseCategory, obs.rootCauseSubCategory)}</p>
            {obs.rootCause && <p className="text-sm text-muted-foreground">{obs.rootCause}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No root cause recorded yet.</p>
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

function AddObservationForm({ inspectionId }: { inspectionId: string }) {
  const [addState, addAction] = useActionState<ActionResult, FormData>(
    addObservationAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [rcCategory, setRcCategory] = useState<RootCauseCategoryValue | "">("");
  const [rcSubCategory, setRcSubCategory] = useState("");

  useEffect(() => {
    if (addState.ok) {
      formRef.current?.reset();
      setRcCategory("");
      setRcSubCategory("");
    }
  }, [addState.ok]);

  const subOptions = rcCategory ? ROOT_CAUSE_SUBCATEGORIES[rcCategory] : null;

  return (
    <form ref={formRef} action={addAction} className="space-y-3 rounded-md border border-dashed border-border p-3">
      <input type="hidden" name="inspectionId" value={inspectionId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Question ref</Label>
          <AutoGrowInput name="questionRef" placeholder="e.g. 5.2.1" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select name="category" defaultValue="" required>
            <option value="" disabled>— Select category —</option>
            {CDI_OBSERVATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CDI_OBSERVATION_CATEGORY_LABELS[c]}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Observation</Label>
        <AutoGrowInput name="observation" placeholder="Describe the observation" required />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Root cause category</Label>
          <Select
            name="rootCauseCategory"
            value={rcCategory}
            onChange={(e) => {
              setRcCategory(e.target.value as RootCauseCategoryValue | "");
              setRcSubCategory("");
            }}
            required
          >
            <option value="" disabled>— Select root cause —</option>
            {ROOT_CAUSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{ROOT_CAUSE_LABELS[c]}</option>
            ))}
          </Select>
        </div>
        {subOptions && (
          <div className="space-y-1">
            <Label className="text-xs">Sub-category</Label>
            <Select name="rootCauseSubCategory" value={rcSubCategory} onChange={(e) => setRcSubCategory(e.target.value)}>
              <option value="" disabled>— Select sub-category —</option>
              {subOptions.map((s) => (
                <option key={s} value={s}>{ROOT_CAUSE_SUBCATEGORY_LABELS[rcCategory as RootCauseCategoryValue][s]}</option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Root cause description</Label>
        <AutoGrowInput name="rootCause" className="max-h-none" placeholder="Explain the underlying cause…" />
      </div>
      <div className="flex items-center gap-2">
        <AddButton />
        {addState.error && <p className="text-sm text-danger">{addState.error}</p>}
      </div>
    </form>
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
  return (
    <div className="space-y-4">
      {observations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No observations recorded.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {observations.map((o) => <ObservationRow key={o.id} obs={o} editable={editable} />)}
        </ul>
      )}

      {editable && <AddObservationForm inspectionId={inspectionId} />}
    </div>
  );
}
