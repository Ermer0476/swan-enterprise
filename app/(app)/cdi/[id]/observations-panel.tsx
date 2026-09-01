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
import {
  CDI_OBSERVATION_CATEGORIES,
  CDI_OBSERVATION_CATEGORY_LABELS,
  CDI_OBSERVATION_STATUSES,
  CDI_OBSERVATION_STATUS_LABELS,
} from "@/features/cdi/schema";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_LABELS,
  ROOT_CAUSE_SUBCATEGORIES,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
  formatRootCause,
  type RootCauseCategoryValue,
} from "@/lib/root-cause";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LIFECYCLE_TONE } from "@/lib/status";
import { AttachmentList, type AttachmentView } from "@/components/attachments/attachment-list";

type Category = (typeof CDI_OBSERVATION_CATEGORIES)[number];
type Status = (typeof CDI_OBSERVATION_STATUSES)[number];

export type PersonnelOption = { id: string; fullName: string; rank: string | null };

export type ObservationView = {
  id: string;
  questionRef: string | null;
  category: Category | null;
  observation: string;
  response: string | null;
  status: Status;
  immediateCause: string | null;
  rootCauseCategory: RootCauseCategoryValue | null;
  rootCauseSubCategory: string | null;
  rootCause: string | null;
  correctiveAction: string | null;
  preventiveMeasure: string | null;
  responsiblePersonId: string | null;
  responsiblePerson: { fullName: string } | null;
  targetDate: string | null; // ISO
  actualCompletionDate: string | null; // ISO
  verifiedById: string | null;
  verifiedBy: { fullName: string } | null;
  attachments: AttachmentView[];
};

function toDateInput(v: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

function statusTone(s: Status): (typeof LIFECYCLE_TONE)[keyof typeof LIFECYCLE_TONE] {
  if (s === "CLOSED") return LIFECYCLE_TONE.CLOSED;
  if (s === "PENDING_VERIFICATION" || s === "ONGOING") return LIFECYCLE_TONE.UNDER_REVIEW;
  return LIFECYCLE_TONE.OPEN; // OPEN
}

function PersonnelSelect({
  value,
  onChange,
  personnel,
}: {
  value: string;
  onChange: (v: string) => void;
  personnel: PersonnelOption[];
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-full">
      <option value="">— Unassigned —</option>
      {personnel.map((p) => (
        <option key={p.id} value={p.id}>{p.fullName}{p.rank ? ` — ${p.rank}` : ""}</option>
      ))}
    </Select>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add observation"}
    </Button>
  );
}

function ObservationRow({
  obs,
  editable,
  canRespond,
  personnel,
}: {
  obs: ObservationView;
  editable: boolean;
  canRespond: boolean;
  personnel: PersonnelOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [questionRef, setQuestionRef] = useState(obs.questionRef ?? "");
  const [category, setCategory] = useState<Category | "">(obs.category ?? "");
  const [observation, setObservation] = useState(obs.observation);
  const [immediateCause, setImmediateCause] = useState(obs.immediateCause ?? "");
  const [rcCategory, setRcCategory] = useState<RootCauseCategoryValue | "">(obs.rootCauseCategory ?? "");
  const [rcSubCategory, setRcSubCategory] = useState(obs.rootCauseSubCategory ?? "");
  const [rootCause, setRootCause] = useState(obs.rootCause ?? "");
  const [correctiveAction, setCorrectiveAction] = useState(obs.correctiveAction ?? "");
  const [preventiveMeasure, setPreventiveMeasure] = useState(obs.preventiveMeasure ?? "");
  const [responsiblePersonId, setResponsiblePersonId] = useState(obs.responsiblePersonId ?? "");
  const [targetDate, setTargetDate] = useState(toDateInput(obs.targetDate));
  const [actualCompletionDate, setActualCompletionDate] = useState(toDateInput(obs.actualCompletionDate));
  const [verifiedById, setVerifiedById] = useState(obs.verifiedById ?? "");
  const [response, setResponse] = useState(obs.response ?? "");
  const [status, setStatus] = useState<Status>(obs.status);

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("observationId", obs.id);
    fd.set("questionRef", questionRef);
    fd.set("observation", observation);
    fd.set("category", category);
    fd.set("immediateCause", immediateCause);
    fd.set("rootCauseCategory", rcCategory);
    fd.set("rootCauseSubCategory", rcSubCategory);
    fd.set("rootCause", rootCause);
    fd.set("correctiveAction", correctiveAction);
    fd.set("preventiveMeasure", preventiveMeasure);
    fd.set("responsiblePersonId", responsiblePersonId);
    fd.set("targetDate", targetDate);
    fd.set("actualCompletionDate", actualCompletionDate);
    fd.set("verifiedById", verifiedById);
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

  const subOptions = rcCategory ? ROOT_CAUSE_SUBCATEGORIES[rcCategory] : null;

  return (
    <li className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {obs.questionRef && <span className="font-mono">Q {obs.questionRef}</span>}
            {obs.category && <Badge tone="neutral">{CDI_OBSERVATION_CATEGORY_LABELS[obs.category]}</Badge>}
            <Badge tone={statusTone(obs.status)}>{CDI_OBSERVATION_STATUS_LABELS[obs.status]}</Badge>
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
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Question ref</Label>
              <AutoGrowInput value={questionRef} onChange={(e) => setQuestionRef(e.target.value)} placeholder="e.g. 5.2.1" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value as Category)} required>
                <option value="" disabled>— Select category —</option>
                {CDI_OBSERVATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CDI_OBSERVATION_CATEGORY_LABELS[c]}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observation</Label>
            <AutoGrowInput className="max-h-none" value={observation} onChange={(e) => setObservation(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Immediate cause</Label>
            <AutoGrowInput
              className="max-h-none"
              value={immediateCause}
              onChange={(e) => setImmediateCause(e.target.value)}
              placeholder="The direct, on-the-spot cause of the observation…"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Root cause description</Label>
            <AutoGrowInput
              className="max-h-none"
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="Explain the underlying cause identified during investigation…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Corrective action</Label>
            <AutoGrowInput
              className="max-h-none"
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
              placeholder="Action taken to correct this specific finding…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preventive measure</Label>
            <AutoGrowInput
              className="max-h-none"
              value={preventiveMeasure}
              onChange={(e) => setPreventiveMeasure(e.target.value)}
              placeholder="Action taken to prevent recurrence…"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Responsible person</Label>
              <PersonnelSelect value={responsiblePersonId} onChange={setResponsiblePersonId} personnel={personnel} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target completion date</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Actual completion date</Label>
              <Input type="date" value={actualCompletionDate} onChange={(e) => setActualCompletionDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                {CDI_OBSERVATION_STATUSES.map((s) => (
                  <option key={s} value={s}>{CDI_OBSERVATION_STATUS_LABELS[s]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Verification by</Label>
              <PersonnelSelect value={verifiedById} onChange={setVerifiedById} personnel={personnel} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Response</Label>
            <AutoGrowInput value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Response…" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={save} disabled={pending}>Save</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
          {obs.immediateCause && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Immediate cause</div>
              <p className="mt-0.5 whitespace-pre-wrap">{obs.immediateCause}</p>
            </div>
          )}
          {obs.rootCauseCategory && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Root cause</div>
              <p className="mt-0.5">{formatRootCause(obs.rootCauseCategory, obs.rootCauseSubCategory)}</p>
              {obs.rootCause && <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{obs.rootCause}</p>}
            </div>
          )}
          {obs.correctiveAction && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Corrective action</div>
              <p className="mt-0.5 whitespace-pre-wrap">{obs.correctiveAction}</p>
            </div>
          )}
          {obs.preventiveMeasure && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Preventive measure</div>
              <p className="mt-0.5 whitespace-pre-wrap">{obs.preventiveMeasure}</p>
            </div>
          )}
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Responsible person</div>
            <p className="mt-0.5">{obs.responsiblePerson?.fullName ?? "—"}</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Target / actual completion</div>
            <p className="mt-0.5">{toDateInput(obs.targetDate) || "—"} / {toDateInput(obs.actualCompletionDate) || "—"}</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Verification by</div>
            <p className="mt-0.5">{obs.verifiedBy?.fullName ?? "—"}</p>
          </div>
          {canRespond ? (
            <div className="sm:col-span-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div className="space-y-1">
                <Label className="text-xs">Response</Label>
                <AutoGrowInput value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Response…" />
              </div>
              <Select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="w-40">
                {CDI_OBSERVATION_STATUSES.map((s) => (
                  <option key={s} value={s}>{CDI_OBSERVATION_STATUS_LABELS[s]}</option>
                ))}
              </Select>
              <Button size="sm" variant="outline" onClick={save} disabled={pending}>Save</Button>
            </div>
          ) : (
            obs.response && (
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Response</div>
                <p className="mt-0.5 whitespace-pre-wrap">{obs.response}</p>
              </div>
            )
          )}
        </div>
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

function AddObservationForm({ inspectionId, personnel }: { inspectionId: string; personnel: PersonnelOption[] }) {
  const [addState, addAction] = useActionState<ActionResult, FormData>(
    addObservationAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [rcCategory, setRcCategory] = useState<RootCauseCategoryValue | "">("");
  const [rcSubCategory, setRcSubCategory] = useState("");
  const [responsiblePersonId, setResponsiblePersonId] = useState("");
  const [verifiedById, setVerifiedById] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (addState.ok) {
      formRef.current?.reset();
      setRcCategory("");
      setRcSubCategory("");
      setResponsiblePersonId("");
      setVerifiedById("");
      setShowAddForm(false);
    }
  }, [addState.ok]);

  const subOptions = rcCategory ? ROOT_CAUSE_SUBCATEGORIES[rcCategory] : null;

  if (!showAddForm) {
    return (
      <Button type="button" variant="accent" onClick={() => setShowAddForm(true)}>
        <Plus className="h-4 w-4" /> Add observation
      </Button>
    );
  }

  return (
    <form ref={formRef} action={addAction} className="space-y-3 rounded-md border border-dashed border-border p-3">
      <input type="hidden" name="inspectionId" value={inspectionId} />
      <input type="hidden" name="responsiblePersonId" value={responsiblePersonId} />
      <input type="hidden" name="verifiedById" value={verifiedById} />
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
      <div className="space-y-1">
        <Label className="text-xs">Immediate cause</Label>
        <AutoGrowInput name="immediateCause" className="max-h-none" placeholder="The direct, on-the-spot cause of the observation…" />
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
      <div className="space-y-1">
        <Label className="text-xs">Corrective action</Label>
        <AutoGrowInput name="correctiveAction" className="max-h-none" placeholder="Action taken to correct this specific finding…" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Preventive measure</Label>
        <AutoGrowInput name="preventiveMeasure" className="max-h-none" placeholder="Action taken to prevent recurrence…" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Responsible person</Label>
          <PersonnelSelect value={responsiblePersonId} onChange={setResponsiblePersonId} personnel={personnel} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Target completion date</Label>
          <Input type="date" name="targetDate" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Actual completion date</Label>
          <Input type="date" name="actualCompletionDate" />
        </div>
      </div>
      <div className="space-y-1 sm:w-1/2">
        <Label className="text-xs">Verification by</Label>
        <PersonnelSelect value={verifiedById} onChange={setVerifiedById} personnel={personnel} />
      </div>
      <div className="flex items-center gap-2">
        <AddButton />
        <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>
          Cancel
        </Button>
        {addState.error && <p className="text-sm text-danger">{addState.error}</p>}
      </div>
    </form>
  );
}

export function ObservationsPanel({
  inspectionId,
  observations,
  editable,
  canRespond,
  personnel,
}: {
  inspectionId: string;
  observations: ObservationView[];
  editable: boolean;
  canRespond: boolean;
  personnel: PersonnelOption[];
}) {
  return (
    <div className="space-y-4">
      {observations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No observations recorded.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {observations.map((o) => (
            <ObservationRow key={o.id} obs={o} editable={editable} canRespond={canRespond} personnel={personnel} />
          ))}
        </ul>
      )}

      {editable && <AddObservationForm inspectionId={inspectionId} personnel={personnel} />}
    </div>
  );
}
