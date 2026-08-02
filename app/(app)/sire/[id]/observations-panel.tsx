"use client";

import { useActionState, useRef, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  addObservationAction,
  updateObservationAction,
  deleteObservationAction,
  addCommentAction,
  type ActionResult,
} from "@/features/sire/actions";
import {
  VIQ_CHAPTERS,
  VIQ_CHAPTER_TITLES,
  SIRE_OBSERVATION_STATUSES,
  SIRE_OBSERVATION_STATUS_LABELS,
  SIRE_OBSERVATION_CATEGORIES,
  SIRE_OBSERVATION_CATEGORY_LABELS,
} from "@/features/sire/schema";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_LABELS,
  ROOT_CAUSE_SUBCATEGORIES,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
  formatRootCause,
  type RootCauseCategoryValue,
} from "@/lib/root-cause";
import { AutoGrowInput, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/lib/utils";
import { LIFECYCLE_TONE } from "@/lib/status";
import { AttachmentList, type AttachmentView } from "@/components/attachments/attachment-list";

export type PersonnelOption = { id: string; fullName: string; rank: string | null };

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  author: { fullName: string } | null;
};

export type ObservationView = {
  id: string;
  seq: number;
  chapter: number | null;
  category: (typeof SIRE_OBSERVATION_CATEGORIES)[number] | null;
  viqRef: string | null;
  question: string | null;
  observation: string;
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
  status: (typeof SIRE_OBSERVATION_STATUSES)[number];
  verifiedById: string | null;
  verifiedBy: { fullName: string } | null;
  attachments: AttachmentView[];
  comments: CommentView[];
};

type ObservationEdit = {
  chapter: string;
  category: (typeof SIRE_OBSERVATION_CATEGORIES)[number] | "";
  viqRef: string;
  question: string;
  observation: string;
  immediateCause: string;
  rootCauseCategory: RootCauseCategoryValue | "";
  rootCauseSubCategory: string;
  rootCause: string;
  correctiveAction: string;
  preventiveMeasure: string;
  responsiblePersonId: string;
  targetDate: string;
  actualCompletionDate: string;
  status: (typeof SIRE_OBSERVATION_STATUSES)[number];
  verifiedById: string;
};

function toDateInput(v: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

function editValues(o: ObservationView): ObservationEdit {
  return {
    chapter: o.chapter ? String(o.chapter) : "",
    category: o.category ?? "",
    viqRef: o.viqRef ?? "",
    question: o.question ?? "",
    observation: o.observation,
    immediateCause: o.immediateCause ?? "",
    rootCauseCategory: o.rootCauseCategory ?? "",
    rootCauseSubCategory: o.rootCauseSubCategory ?? "",
    rootCause: o.rootCause ?? "",
    correctiveAction: o.correctiveAction ?? "",
    preventiveMeasure: o.preventiveMeasure ?? "",
    responsiblePersonId: o.responsiblePersonId ?? "",
    targetDate: toDateInput(o.targetDate),
    actualCompletionDate: toDateInput(o.actualCompletionDate),
    status: o.status,
    verifiedById: o.verifiedById ?? "",
  };
}

function statusTone(s: ObservationView["status"]): BadgeTone {
  if (s === "CLOSED") return LIFECYCLE_TONE.CLOSED;
  if (s === "PENDING_VERIFICATION" || s === "ONGOING") return LIFECYCLE_TONE.UNDER_REVIEW;
  return LIFECYCLE_TONE.OPEN; // OPEN
}

function formatDateTime(v: string): string {
  return new Date(v).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PersonnelSelect({
  value,
  onChange,
  personnel,
  disabled,
}: {
  value: string;
  onChange?: (v: string) => void;
  personnel: PersonnelOption[];
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      disabled={disabled}
      className="w-full"
    >
      <option value="">— Unassigned —</option>
      {personnel.map((p) => (
        <option key={p.id} value={p.id}>{p.fullName}{p.rank ? ` — ${p.rank}` : ""}</option>
      ))}
    </Select>
  );
}

function CommentsThread({ observationId, comments, editable }: {
  observationId: string;
  comments: CommentView[];
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function post() {
    if (!body.trim()) return;
    setError(null);
    const fd = new FormData();
    fd.set("observationId", observationId);
    fd.set("body", body);
    startTransition(async () => {
      const res = await addCommentAction(fd);
      if (res.ok) setBody("");
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Comments</Label>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-2 border-l-2 border-border pl-3">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{c.author?.fullName ?? "Unknown"}</span>
                {" · "}{formatDateTime(c.createdAt)}
              </div>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="flex items-end gap-2">
          <AutoGrowInput
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            className="w-full"
          />
          <Button size="sm" variant="outline" onClick={post} disabled={pending || !body.trim()}>
            Post
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function ObservationCard({
  obs,
  editable,
  personnel,
}: {
  obs: ObservationView;
  editable: boolean;
  personnel: PersonnelOption[];
}) {
  const [values, setValues] = useState<ObservationEdit>(() => editValues(obs));
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const base = editValues(obs);
  const isDirty = JSON.stringify(values) !== JSON.stringify(base);

  function setField<K extends keyof ObservationEdit>(field: K, value: ObservationEdit[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("observationId", obs.id);
    fd.set("chapter", values.chapter);
    fd.set("category", values.category);
    fd.set("viqRef", values.viqRef);
    fd.set("question", values.question);
    fd.set("observation", values.observation);
    fd.set("immediateCause", values.immediateCause);
    fd.set("rootCauseCategory", values.rootCauseCategory);
    fd.set("rootCauseSubCategory", values.rootCauseSubCategory);
    fd.set("rootCause", values.rootCause);
    fd.set("correctiveAction", values.correctiveAction);
    fd.set("preventiveMeasure", values.preventiveMeasure);
    fd.set("responsiblePersonId", values.responsiblePersonId);
    fd.set("targetDate", values.targetDate);
    fd.set("actualCompletionDate", values.actualCompletionDate);
    fd.set("status", values.status);
    fd.set("verifiedById", values.verifiedById);
    startTransition(async () => {
      const res = await updateObservationAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  function remove() {
    if (!confirm(`Delete Observation No. ${obs.seq}?`)) return;
    const fd = new FormData();
    fd.set("observationId", obs.id);
    startDeleting(async () => {
      await deleteObservationAction(fd);
    });
  }

  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Observation No. {obs.seq}</span>
          {obs.chapter && (
            <span className="text-xs text-muted-foreground">
              Chapter {obs.chapter} — {VIQ_CHAPTER_TITLES[obs.chapter]}
            </span>
          )}
          {obs.viqRef && <span className="font-mono text-xs text-muted-foreground">Q{obs.viqRef}</span>}
          {obs.category && <Badge tone="neutral">{SIRE_OBSERVATION_CATEGORY_LABELS[obs.category]}</Badge>}
          <Badge tone={statusTone(obs.status)}>{SIRE_OBSERVATION_STATUS_LABELS[obs.status]}</Badge>
        </div>
        {editable && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            aria-label="Delete observation"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {editable ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Chapter</Label>
              <Select value={values.chapter} onChange={(e) => setField("chapter", e.target.value)}>
                <option value="">— Select —</option>
                {VIQ_CHAPTERS.map((c) => <option key={c.no} value={c.no}>{c.no}. {c.title}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={values.category} onChange={(e) => setField("category", e.target.value as ObservationEdit["category"])}>
                <option value="">— Select —</option>
                {SIRE_OBSERVATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{SIRE_OBSERVATION_CATEGORY_LABELS[c]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Question number</Label>
              <AutoGrowInput value={values.viqRef} onChange={(e) => setField("viqRef", e.target.value)} placeholder="e.g. 3.5.1" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Question</Label>
            <Textarea value={values.question} onChange={(e) => setField("question", e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Finding / Inspector observation</Label>
            <Textarea value={values.observation} onChange={(e) => setField("observation", e.target.value)} rows={3} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Immediate cause</Label>
            <Textarea value={values.immediateCause} onChange={(e) => setField("immediateCause", e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Root cause category</Label>
              <Select
                value={values.rootCauseCategory}
                onChange={(e) => {
                  setField("rootCauseCategory", e.target.value as RootCauseCategoryValue | "");
                  setField("rootCauseSubCategory", ""); // sub-category list differs per category — reset on change
                }}
              >
                <option value="">— Select —</option>
                {ROOT_CAUSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{ROOT_CAUSE_LABELS[c]}</option>
                ))}
              </Select>
            </div>
            {values.rootCauseCategory && (
              <div className="space-y-1">
                <Label className="text-xs">Sub-category</Label>
                <Select
                  value={values.rootCauseSubCategory}
                  onChange={(e) => setField("rootCauseSubCategory", e.target.value)}
                >
                  <option value="">— Select —</option>
                  {ROOT_CAUSE_SUBCATEGORIES[values.rootCauseCategory].map((s) => (
                    <option key={s} value={s}>{ROOT_CAUSE_SUBCATEGORY_LABELS[values.rootCauseCategory as RootCauseCategoryValue][s]}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Root cause description</Label>
            <Textarea value={values.rootCause} onChange={(e) => setField("rootCause", e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Corrective action</Label>
            <Textarea value={values.correctiveAction} onChange={(e) => setField("correctiveAction", e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preventive measure</Label>
            <Textarea value={values.preventiveMeasure} onChange={(e) => setField("preventiveMeasure", e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Responsible person</Label>
              <PersonnelSelect value={values.responsiblePersonId} onChange={(v) => setField("responsiblePersonId", v)} personnel={personnel} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target completion date</Label>
              <Input type="date" value={values.targetDate} onChange={(e) => setField("targetDate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Actual completion date</Label>
              <Input type="date" value={values.actualCompletionDate} onChange={(e) => setField("actualCompletionDate", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={values.status} onChange={(e) => setField("status", e.target.value as ObservationEdit["status"])}>
                {SIRE_OBSERVATION_STATUSES.map((s) => (
                  <option key={s} value={s}>{SIRE_OBSERVATION_STATUS_LABELS[s]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Verification by</Label>
              <PersonnelSelect value={values.verifiedById} onChange={(v) => setField("verifiedById", v)} personnel={personnel} />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant={isDirty ? "success" : "outline"}
              disabled={!isDirty || pending}
              onClick={save}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
          {obs.question && (
            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Question</div>
              <p className="mt-0.5 whitespace-pre-wrap">{obs.question}</p>
            </div>
          )}
          <div className="sm:col-span-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Finding / Inspector observation</div>
            <p className="mt-0.5 whitespace-pre-wrap">{obs.observation}</p>
          </div>
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
            </div>
          )}
          {obs.rootCause && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Root cause description</div>
              <p className="mt-0.5 whitespace-pre-wrap">{obs.rootCause}</p>
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
        </div>
      )}

      <div className="space-y-1.5 border-t border-border pt-3">
        <Label className="text-xs">Evidence attachments</Label>
        <AttachmentList
          entityType="SireObservation"
          entityId={obs.id}
          attachments={obs.attachments}
          editable={editable}
        />
      </div>

      <div className="border-t border-border pt-3">
        <CommentsThread observationId={obs.id} comments={obs.comments} editable={editable} />
      </div>
    </div>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add observation"}
    </Button>
  );
}

export function ObservationsPanel({
  inspectionId,
  observations,
  personnel,
  editable,
}: {
  inspectionId: string;
  observations: ObservationView[];
  personnel: PersonnelOption[];
  editable: boolean;
}) {
  const [addState, addAction] = useActionState<ActionResult, FormData>(
    addObservationAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [addRootCauseCategory, setAddRootCauseCategory] = useState<RootCauseCategoryValue | "">("");
  useEffect(() => {
    if (addState.ok) {
      formRef.current?.reset();
      setAddRootCauseCategory("");
    }
  }, [addState.ok]);

  return (
    <div className="space-y-4">
      {observations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No observations recorded.</p>
      ) : (
        <div className="space-y-4">
          {observations.map((o) => (
            <ObservationCard key={o.id} obs={o} editable={editable} personnel={personnel} />
          ))}
        </div>
      )}

      {editable && (
        <form ref={formRef} action={addAction} className="space-y-3 rounded-md border border-dashed border-border p-4">
          <input type="hidden" name="inspectionId" value={inspectionId} />
          <p className="text-sm font-semibold">New observation</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Chapter</Label>
              <Select name="chapter" defaultValue="">
                <option value="">— Select —</option>
                {VIQ_CHAPTERS.map((c) => <option key={c.no} value={c.no}>{c.no}. {c.title}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select name="category" defaultValue="">
                <option value="">— Select —</option>
                {SIRE_OBSERVATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{SIRE_OBSERVATION_CATEGORY_LABELS[c]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Question number</Label>
              <AutoGrowInput name="viqRef" placeholder="e.g. 3.5.1" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Question</Label>
            <Textarea name="question" rows={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Finding / Inspector observation</Label>
            <Textarea name="observation" rows={3} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Immediate cause</Label>
            <Textarea name="immediateCause" rows={2} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Root cause category</Label>
              <Select
                name="rootCauseCategory"
                value={addRootCauseCategory}
                onChange={(e) => setAddRootCauseCategory(e.target.value as RootCauseCategoryValue | "")}
              >
                <option value="">— Select —</option>
                {ROOT_CAUSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{ROOT_CAUSE_LABELS[c]}</option>
                ))}
              </Select>
            </div>
            {addRootCauseCategory && (
              <div className="space-y-1">
                <Label className="text-xs">Sub-category</Label>
                <Select name="rootCauseSubCategory" defaultValue="">
                  <option value="">— Select —</option>
                  {ROOT_CAUSE_SUBCATEGORIES[addRootCauseCategory].map((s) => (
                    <option key={s} value={s}>{ROOT_CAUSE_SUBCATEGORY_LABELS[addRootCauseCategory][s]}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Root cause description</Label>
            <Textarea name="rootCause" rows={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Corrective action</Label>
            <Textarea name="correctiveAction" rows={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preventive measure</Label>
            <Textarea name="preventiveMeasure" rows={2} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Responsible person</Label>
              <Select name="responsiblePersonId" defaultValue="">
                <option value="">— Unassigned —</option>
                {personnel.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}{p.rank ? ` — ${p.rank}` : ""}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target completion date</Label>
              <Input name="targetDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Actual completion date</Label>
              <Input name="actualCompletionDate" type="date" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select name="status" defaultValue="OPEN">
                {SIRE_OBSERVATION_STATUSES.map((s) => (
                  <option key={s} value={s}>{SIRE_OBSERVATION_STATUS_LABELS[s]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Verification by</Label>
              <Select name="verifiedById" defaultValue="">
                <option value="">— Unassigned —</option>
                {personnel.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}{p.rank ? ` — ${p.rank}` : ""}</option>
                ))}
              </Select>
            </div>
          </div>
          <AddButton />
          {addState.error && <p className="text-sm text-danger">{addState.error}</p>}
        </form>
      )}
    </div>
  );
}
