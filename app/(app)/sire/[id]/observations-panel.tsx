"use client";

import { useActionState, useRef, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2, FileUp, X } from "lucide-react";
import {
  addObservationAction,
  updateObservationAction,
  deleteObservationAction,
  addCommentAction,
  parseSireDocumentAction,
  bulkAddObservationsAction,
  type ActionResult,
  type ParseDocumentResult,
} from "@/features/sire/actions";
import type { ParsedObservationDraft } from "@/features/sire/document-parser";
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
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
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
    // Both feed the SIRE KPI — block the save client-side rather than
    // round-tripping to the server just to find out they're missing.
    if (!values.category) return setError("Category is required");
    if (!values.rootCauseCategory) return setError("Root cause category is required");
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
              <Select value={values.category} onChange={(e) => setField("category", e.target.value as ObservationEdit["category"])} required>
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
            <AutoGrowInput className="max-h-none" value={values.question} onChange={(e) => setField("question", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Finding / Inspector observation</Label>
            <AutoGrowInput className="max-h-none" value={values.observation} onChange={(e) => setField("observation", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Immediate cause</Label>
            <AutoGrowInput className="max-h-none" value={values.immediateCause} onChange={(e) => setField("immediateCause", e.target.value)} />
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
                required
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
            <AutoGrowInput className="max-h-none" value={values.rootCause} onChange={(e) => setField("rootCause", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Corrective action</Label>
            <AutoGrowInput className="max-h-none" value={values.correctiveAction} onChange={(e) => setField("correctiveAction", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preventive measure</Label>
            <AutoGrowInput className="max-h-none" value={values.preventiveMeasure} onChange={(e) => setField("preventiveMeasure", e.target.value)} />
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

function ParseButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <FileUp className="h-4 w-4" /> {pending ? "Reading document…" : "Parse document"}
    </Button>
  );
}

/** One review row for a parsed draft — every field stays editable so the
 * uploader can fix anything the parser got wrong or left blank before it's
 * actually saved; nothing here is written until "Confirm & add all". */
function DraftCard({
  draft,
  index,
  onChange,
  onRemove,
}: {
  draft: ParsedObservationDraft;
  index: number;
  onChange: (index: number, next: ParsedObservationDraft) => void;
  onRemove: (index: number) => void;
}) {
  function setField<K extends keyof ParsedObservationDraft>(field: K, value: ParsedObservationDraft[K]) {
    onChange(index, { ...draft, [field]: value });
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{draft.groupLabel}</span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label="Remove this draft"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-danger"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Chapter</Label>
          <Select
            value={draft.chapter ? String(draft.chapter) : ""}
            onChange={(e) => setField("chapter", e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Select —</option>
            {VIQ_CHAPTERS.map((c) => <option key={c.no} value={c.no}>{c.no}. {c.title}</option>)}
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select
            value={draft.category ?? ""}
            onChange={(e) => setField("category", (e.target.value || null) as ParsedObservationDraft["category"])}
            required
          >
            <option value="">— Select —</option>
            {SIRE_OBSERVATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>{SIRE_OBSERVATION_CATEGORY_LABELS[c]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Question number</Label>
          <AutoGrowInput value={draft.viqRef ?? ""} onChange={(e) => setField("viqRef", e.target.value || null)} placeholder="e.g. 3.5.1" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Question</Label>
        <AutoGrowInput className="max-h-none" value={draft.question ?? ""} onChange={(e) => setField("question", e.target.value || null)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Finding / Inspector observation</Label>
        <AutoGrowInput className="max-h-none" value={draft.observation} onChange={(e) => setField("observation", e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Immediate cause</Label>
        <AutoGrowInput className="max-h-none" value={draft.immediateCause ?? ""} onChange={(e) => setField("immediateCause", e.target.value || null)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Root cause category</Label>
          <Select
            value={draft.rootCauseCategory ?? ""}
            onChange={(e) => {
              // One combined update, not two setField calls — setField
              // spreads the `draft` prop, which doesn't change until the
              // next render, so a second call in the same handler would
              // overwrite the first (this dropped the category pick back to
              // blank every time — same bug as the fix below sidesteps).
              const value = (e.target.value || null) as ParsedObservationDraft["rootCauseCategory"];
              onChange(index, { ...draft, rootCauseCategory: value, rootCauseSubCategory: null });
            }}
            required
          >
            <option value="">— Select —</option>
            {ROOT_CAUSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{ROOT_CAUSE_LABELS[c]}</option>
            ))}
          </Select>
        </div>
        {draft.rootCauseCategory && (
          <div className="space-y-1">
            <Label className="text-xs">Sub-category</Label>
            <Select
              value={draft.rootCauseSubCategory ?? ""}
              onChange={(e) => setField("rootCauseSubCategory", e.target.value || null)}
            >
              <option value="">— Select —</option>
              {ROOT_CAUSE_SUBCATEGORIES[draft.rootCauseCategory].map((s) => (
                <option key={s} value={s}>{ROOT_CAUSE_SUBCATEGORY_LABELS[draft.rootCauseCategory!][s]}</option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Root cause description</Label>
        <AutoGrowInput className="max-h-none" value={draft.rootCause ?? ""} onChange={(e) => setField("rootCause", e.target.value || null)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Corrective action</Label>
        <AutoGrowInput className="max-h-none" value={draft.correctiveAction ?? ""} onChange={(e) => setField("correctiveAction", e.target.value || null)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Preventive measure</Label>
        <AutoGrowInput className="max-h-none" value={draft.preventiveMeasure ?? ""} onChange={(e) => setField("preventiveMeasure", e.target.value || null)} />
      </div>
    </div>
  );
}

function ImportDraftsPanel({ inspectionId, onImported }: { inspectionId: string; onImported: () => void }) {
  const [parseState, parseAction] = useActionState<ParseDocumentResult, FormData>(
    parseSireDocumentAction,
    { ok: false, error: null, drafts: [] },
  );
  const [drafts, setDrafts] = useState<ParsedObservationDraft[] | null>(null);
  const [confirming, startConfirming] = useTransition();
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const fileFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (parseState.ok && parseState.drafts.length > 0) {
      setDrafts(parseState.drafts);
    }
  }, [parseState]);

  function updateDraft(index: number, next: ParsedObservationDraft) {
    setDrafts((prev) => (prev ? prev.map((d, i) => (i === index ? next : d)) : prev));
  }

  function removeDraft(index: number) {
    setDrafts((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  function cancel() {
    setDrafts(null);
    setConfirmError(null);
    fileFormRef.current?.reset();
  }

  function confirm() {
    if (!drafts || drafts.length === 0) return;
    setConfirmError(null);
    // Both feed the SIRE KPI — block the import client-side (this button
    // doesn't go through a native form submit, so `required` on the selects
    // alone wouldn't stop it) rather than round-tripping to the server.
    const incomplete = drafts.filter((d) => !d.category || !d.rootCauseCategory);
    if (incomplete.length > 0) {
      setConfirmError(
        `Category and root cause category are required — missing on: ${incomplete.map((d) => d.groupLabel).join(", ")}`,
      );
      return;
    }
    const fd = new FormData();
    fd.set("inspectionId", inspectionId);
    fd.set("drafts", JSON.stringify(drafts));
    startConfirming(async () => {
      const res = await bulkAddObservationsAction(fd);
      if (!res.ok) {
        setConfirmError(res.error);
        return;
      }
      cancel();
      onImported();
    });
  }

  if (drafts && drafts.length > 0) {
    return (
      <div className="space-y-4 rounded-md border border-dashed border-border p-4">
        <p className="text-sm font-semibold">
          Review {drafts.length} observation{drafts.length === 1 ? "" : "s"} found in the document
        </p>
        <p className="text-xs text-muted-foreground">
          Check each one before adding — fix anything the reader got wrong or left blank, or remove a row entirely.
        </p>
        <div className="space-y-3">
          {drafts.map((d, i) => (
            <DraftCard key={i} draft={d} index={i} onChange={updateDraft} onRemove={removeDraft} />
          ))}
        </div>
        {confirmError && <p className="text-sm text-danger">{confirmError}</p>}
        <div className="flex items-center gap-2">
          <Button type="button" disabled={confirming} onClick={confirm}>
            {confirming ? "Adding…" : `Confirm & add all (${drafts.length})`}
          </Button>
          <Button type="button" variant="ghost" disabled={confirming} onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={fileFormRef}
      action={parseAction}
      className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-4"
    >
      <div className="space-y-1">
        <Label className="text-xs">Import from document (.docx)</Label>
        <input
          type="file"
          name="file"
          required
          accept=".docx"
          className="max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
        />
      </div>
      <ParseButton />
      {parseState.error && <p className="w-full text-sm text-danger">{parseState.error}</p>}
    </form>
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
  const [showAddForm, setShowAddForm] = useState(false);
  useEffect(() => {
    if (addState.ok) {
      formRef.current?.reset();
      setAddRootCauseCategory("");
      setShowAddForm(false);
    }
  }, [addState.ok]);

  return (
    <div className="space-y-4">
      {editable && <ImportDraftsPanel inspectionId={inspectionId} onImported={() => {}} />}

      {observations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No observations recorded.</p>
      ) : (
        <div className="space-y-4">
          {observations.map((o) => (
            <ObservationCard key={o.id} obs={o} editable={editable} personnel={personnel} />
          ))}
        </div>
      )}

      {editable && !showAddForm && (
        <Button type="button" variant="outline" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" /> Add observation
        </Button>
      )}

      {editable && showAddForm && (
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
              <Select name="category" defaultValue="" required>
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
            <AutoGrowInput className="max-h-none" name="question" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Finding / Inspector observation</Label>
            <AutoGrowInput className="max-h-none" name="observation" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Immediate cause</Label>
            <AutoGrowInput className="max-h-none" name="immediateCause" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Root cause category</Label>
              <Select
                name="rootCauseCategory"
                value={addRootCauseCategory}
                onChange={(e) => setAddRootCauseCategory(e.target.value as RootCauseCategoryValue | "")}
                required
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
            <AutoGrowInput className="max-h-none" name="rootCause" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Corrective action</Label>
            <AutoGrowInput className="max-h-none" name="correctiveAction" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preventive measure</Label>
            <AutoGrowInput className="max-h-none" name="preventiveMeasure" />
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
          <div className="flex items-center gap-2">
            <AddButton />
            <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>
          {addState.error && <p className="text-sm text-danger">{addState.error}</p>}
        </form>
      )}
    </div>
  );
}
