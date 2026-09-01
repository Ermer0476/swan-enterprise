"use client";

import { useActionState, useRef, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  addObservationAction,
  updateObservationAction,
  deleteObservationAction,
  type ActionResult,
} from "@/features/company-inspections/actions";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_LABELS,
  ROOT_CAUSE_SUBCATEGORIES,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
  formatRootCause,
  type RootCauseCategoryValue,
} from "@/lib/root-cause";
import {
  SIRE_OBSERVATION_CATEGORIES,
  SIRE_OBSERVATION_CATEGORY_LABELS,
  VIQ_CHAPTERS,
  VIQ_CHAPTER_TITLES,
} from "@/features/company-inspections/schema";

type ObservationCategoryValue = (typeof SIRE_OBSERVATION_CATEGORIES)[number];
import { CapaTracker, type CapaRowView } from "@/components/capa/capa-tracker";
import { AttachmentList, type AttachmentView } from "@/components/attachments/attachment-list";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QuestionNumberSuggest } from "@/components/company-inspections/question-number-suggest";
import type { QuestionnaireSuggestItem } from "@/features/sire-questionnaire/queries";

export type ObservationView = {
  id: string;
  seq: number;
  chapter: number | null;
  category: ObservationCategoryValue | null;
  viqRef: string | null;
  observation: string;
  immediateCause: string | null;
  rootCauseCategory: RootCauseCategoryValue | null;
  rootCauseSubCategory: string | null;
  rootCause: string | null;
  immediateCorrectiveAction: string | null;
};

type ObservationEdit = {
  chapter: string;
  category: ObservationCategoryValue | "";
  viqRef: string;
  observation: string;
  immediateCause: string;
  rootCauseCategory: RootCauseCategoryValue | "";
  rootCauseSubCategory: string;
  rootCause: string;
  immediateCorrectiveAction: string;
};

function editValues(o: ObservationView): ObservationEdit {
  return {
    chapter: o.chapter ? String(o.chapter) : "",
    category: o.category ?? "",
    viqRef: o.viqRef ?? "",
    observation: o.observation,
    immediateCause: o.immediateCause ?? "",
    rootCauseCategory: o.rootCauseCategory ?? "",
    rootCauseSubCategory: o.rootCauseSubCategory ?? "",
    rootCause: o.rootCause ?? "",
    immediateCorrectiveAction: o.immediateCorrectiveAction ?? "",
  };
}

function ObservationCard({
  obs,
  editable,
  canRespond,
  correctiveRows,
  attachments,
  questionnaireItems,
}: {
  obs: ObservationView;
  editable: boolean;
  canRespond: boolean;
  correctiveRows: CapaRowView[];
  attachments: AttachmentView[];
  questionnaireItems: QuestionnaireSuggestItem[];
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
    fd.set("observation", values.observation);
    fd.set("immediateCause", values.immediateCause);
    fd.set("rootCauseCategory", values.rootCauseCategory);
    fd.set("rootCauseSubCategory", values.rootCauseSubCategory);
    fd.set("rootCause", values.rootCause);
    fd.set("immediateCorrectiveAction", values.immediateCorrectiveAction);
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
        <span className="text-sm font-semibold">Observation No. {obs.seq}</span>
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
              <Select
                value={values.category}
                onChange={(e) => setField("category", e.target.value as ObservationCategoryValue | "")}
              >
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
            <Label className="text-xs">Finding / Inspector observation</Label>
            <AutoGrowInput className="max-h-none" value={values.observation} onChange={(e) => setField("observation", e.target.value)} required />
          </div>
          <QuestionNumberSuggest
            observationText={values.observation}
            items={questionnaireItems}
            onPick={(item) => {
              setField("chapter", String(item.chapter));
              setField("viqRef", item.no);
            }}
          />
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
                  setField("rootCauseSubCategory", "");
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
            <AutoGrowInput className="max-h-none" value={values.rootCause} onChange={(e) => setField("rootCause", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Immediate corrective action</Label>
            <AutoGrowInput className="max-h-none" value={values.immediateCorrectiveAction} onChange={(e) => setField("immediateCorrectiveAction", e.target.value)} />
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
          {obs.chapter && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Chapter</div>
              <p className="mt-0.5">{obs.chapter}. {VIQ_CHAPTER_TITLES[obs.chapter]}</p>
            </div>
          )}
          {obs.category && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Category</div>
              <p className="mt-0.5">{SIRE_OBSERVATION_CATEGORY_LABELS[obs.category]}</p>
            </div>
          )}
          {obs.viqRef && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Question number</div>
              <p className="mt-0.5">{obs.viqRef}</p>
            </div>
          )}
          <div className="sm:col-span-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Finding / Inspector observation</div>
            <p className="mt-0.5 whitespace-pre-wrap">{obs.observation}</p>
          </div>
          {obs.immediateCause && (
            <div className="sm:col-span-2">
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
          {obs.immediateCorrectiveAction && (
            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Immediate corrective action</div>
              <p className="mt-0.5 whitespace-pre-wrap">{obs.immediateCorrectiveAction}</p>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-border pt-3 space-y-3">
        <h4 className="text-sm font-semibold">CAPA (follow-up)</h4>
        <CapaTracker
          entityType="CompanyInspectionObservation"
          entityId={obs.id}
          kind="CORRECTIVE"
          title="Corrective Actions"
          editable={editable}
          canRespond={canRespond}
          rows={correctiveRows}
        />
      </div>

      <div className="border-t border-border pt-3 space-y-1.5">
        <Label className="text-xs">Attachments</Label>
        <AttachmentList
          entityType="CompanyInspectionObservation"
          entityId={obs.id}
          attachments={attachments}
          editable={editable}
        />
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
  correctiveRowsByObservation,
  attachmentsByObservation,
  editable,
  canRespond,
  questionnaireItems,
}: {
  inspectionId: string;
  observations: ObservationView[];
  correctiveRowsByObservation: Record<string, CapaRowView[]>;
  attachmentsByObservation: Record<string, AttachmentView[]>;
  editable: boolean;
  canRespond: boolean;
  questionnaireItems: QuestionnaireSuggestItem[];
}) {
  const [addState, addAction] = useActionState<ActionResult, FormData>(
    addObservationAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [addRootCauseCategory, setAddRootCauseCategory] = useState<RootCauseCategoryValue | "">("");
  const [addChapter, setAddChapter] = useState("");
  const [addViqRef, setAddViqRef] = useState("");
  const [addObservationText, setAddObservationText] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  useEffect(() => {
    if (addState.ok) {
      formRef.current?.reset();
      setAddRootCauseCategory("");
      setAddChapter("");
      setAddViqRef("");
      setAddObservationText("");
      setShowAddForm(false);
    }
  }, [addState.ok]);

  return (
    <div className="space-y-4">
      {observations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No observations recorded.</p>
      ) : (
        <div className="space-y-4">
          {observations.map((o) => (
            <ObservationCard
              key={o.id}
              obs={o}
              editable={editable}
              canRespond={canRespond}
              correctiveRows={correctiveRowsByObservation[o.id] ?? []}
              attachments={attachmentsByObservation[o.id] ?? []}
              questionnaireItems={questionnaireItems}
            />
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
              <Select name="chapter" value={addChapter} onChange={(e) => setAddChapter(e.target.value)}>
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
              <AutoGrowInput
                name="viqRef"
                placeholder="e.g. 3.5.1"
                value={addViqRef}
                onChange={(e) => setAddViqRef(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Finding / Inspector observation</Label>
            <AutoGrowInput
              className="max-h-none"
              name="observation"
              required
              value={addObservationText}
              onChange={(e) => setAddObservationText(e.target.value)}
            />
          </div>
          <QuestionNumberSuggest
            observationText={addObservationText}
            items={questionnaireItems}
            onPick={(item) => {
              setAddChapter(String(item.chapter));
              setAddViqRef(item.no);
            }}
          />
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
            <Label className="text-xs">Immediate corrective action</Label>
            <AutoGrowInput className="max-h-none" name="immediateCorrectiveAction" />
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
