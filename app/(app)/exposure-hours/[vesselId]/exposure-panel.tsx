"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Users, Building2, Check, X } from "lucide-react";
import {
  addCrewEntryAction,
  updateCrewEntryAction,
  deleteCrewEntryAction,
  addInjuryCaseAction,
  updateInjuryCaseAction,
  deleteInjuryCaseAction,
} from "@/features/exposure-hours/actions";
import {
  EXPOSURE_ENTERED_BY_LABELS,
  INJURY_CLASSIFICATIONS,
  INJURY_CLASSIFICATION_LABELS,
  type InjuryClassificationValue,
} from "@/features/exposure-hours/schema";
import { AutoGrowInput, Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDate, cn } from "@/lib/utils";

export type CrewEntryView = {
  id: string;
  crew: number;
  effectiveFrom: string; // ISO
  enteredBy: "VESSEL" | "OFFICE";
};

export type InjuryCaseView = {
  id: string;
  classification: InjuryClassificationValue;
  description: string | null;
  occurredOn: string; // ISO
};

const CLASSIFICATION_COLOR: Record<InjuryClassificationValue, string> = {
  FAT: "text-danger",
  PTD: "text-warning",
  PPD: "text-amber-600 dark:text-amber-400",
  LWC: "text-purple-600 dark:text-purple-400",
  RWC: "text-success",
  MTC: "text-accent",
  FAC: "text-muted-foreground",
};

function RowActionButtons({
  onSave,
  saveDisabled,
  saving,
  onDelete,
  deleting,
  deleteLabel = "Delete",
}: {
  onSave?: () => void;
  saveDisabled?: boolean;
  saving?: boolean;
  onDelete?: () => void;
  deleting: boolean;
  deleteLabel?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {onSave && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={onSave}
          disabled={saveDisabled || saving}
          aria-label="Save"
          className="h-7 w-7 border-success text-success hover:bg-success/10"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      )}
      {onDelete && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={onDelete}
          disabled={deleting}
          aria-label={deleteLabel}
          className="h-7 w-7 border-danger text-danger hover:bg-danger/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Crew roster — drives total exposure hours automatically ──────────────

type CrewFormValues = { crew: string; effectiveFrom: string };

function blankCrewValues(): CrewFormValues {
  return { crew: "", effectiveFrom: "" };
}

function crewValuesFrom(e: CrewEntryView): CrewFormValues {
  return { crew: String(e.crew), effectiveFrom: e.effectiveFrom.slice(0, 10) };
}

function CrewEntryAddRow({
  vesselId,
  initial,
  onDone,
}: {
  vesselId: string;
  initial?: CrewFormValues;
  onDone: () => void;
}) {
  const [values, setValues] = useState<CrewFormValues>(initial ?? blankCrewValues());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof CrewFormValues>(field: K, value: CrewFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function submit() {
    if (!values.crew || !values.effectiveFrom) {
      setError("Crew count and effective date are required");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("vesselId", vesselId);
    fd.set("crew", values.crew);
    fd.set("effectiveFrom", values.effectiveFrom);
    startTransition(async () => {
      const res = await addCrewEntryAction({ ok: false, error: null }, fd);
      if (!res.ok) setError(res.error);
      else onDone();
    });
  }

  return (
    <tr className="border-b border-dashed border-border bg-muted/20">
      <td className="px-3 py-2">
        <Input type="number" min={0} className="w-20" value={values.crew} onChange={(e) => setField("crew", e.target.value)} placeholder="Crew" />
      </td>
      <td className="px-3 py-2">
        <Input type="date" className="w-40" value={values.effectiveFrom} onChange={(e) => setField("effectiveFrom", e.target.value)} />
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">—</td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <Button type="button" size="icon" variant="outline" onClick={submit} disabled={pending} aria-label="Add" className="h-7 w-7 border-success text-success hover:bg-success/10">
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant="outline" onClick={onDone} aria-label="Cancel" className="h-7 w-7">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {error && <p className="mt-1 whitespace-nowrap text-xs text-danger">{error}</p>}
      </td>
    </tr>
  );
}

function CrewEntryRow({
  entryId,
  initial,
  enteredBy,
  canManage,
  canDelete,
  onDelete,
  deleting,
}: {
  entryId: string;
  initial: CrewFormValues;
  enteredBy: "VESSEL" | "OFFICE";
  canManage: boolean;
  canDelete: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [values, setValues] = useState<CrewFormValues>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function setField<K extends keyof CrewFormValues>(field: K, value: CrewFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  function save() {
    if (!values.crew || !values.effectiveFrom) {
      setError("Crew count and effective date are required");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("entryId", entryId);
    fd.set("crew", values.crew);
    fd.set("effectiveFrom", values.effectiveFrom);
    startTransition(async () => {
      const res = await updateCrewEntryAction({ ok: false, error: null }, fd);
      if (!res.ok) setError(res.error);
      else setDirty(false);
    });
  }

  const enteredByCell = (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
      <Building2 className="h-3 w-3" /> {EXPOSURE_ENTERED_BY_LABELS[enteredBy]}
    </span>
  );

  if (!canManage) {
    return (
      <tr className="border-b border-border last:border-0">
        <td className="px-3 py-2 font-medium tabular-nums">{values.crew}</td>
        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(values.effectiveFrom)}</td>
        <td className="px-3 py-2">{enteredByCell}</td>
        {canDelete && (
          <td className="px-3 py-2">
            <RowActionButtons onDelete={onDelete} deleting={deleting} deleteLabel="Delete crew entry" />
          </td>
        )}
      </tr>
    );
  }

  return (
    <tr className="border-b border-border align-top last:border-0">
      <td className="px-3 py-2">
        <Input type="number" min={0} className="w-20" value={values.crew} onChange={(e) => setField("crew", e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <Input type="date" className="w-40" value={values.effectiveFrom} onChange={(e) => setField("effectiveFrom", e.target.value)} />
      </td>
      <td className="px-3 py-2">{enteredByCell}</td>
      <td className="px-3 py-2">
        <RowActionButtons
          onSave={save}
          saveDisabled={!dirty}
          saving={pending}
          onDelete={canDelete ? onDelete : undefined}
          deleting={deleting}
          deleteLabel="Delete crew entry"
        />
        {error && <p className="mt-1 whitespace-nowrap text-xs text-danger">{error}</p>}
      </td>
    </tr>
  );
}

export function CrewRosterPanel({
  vesselId,
  entries,
  canCreate,
  canManage,
  canDelete,
  suggestedStartDate,
  suggestedCrew,
}: {
  vesselId: string;
  entries: CrewEntryView[];
  canCreate: boolean;
  canManage: boolean;
  canDelete: boolean;
  // When this vessel has no crew history yet, pre-fill the first entry from
  // its Ship's Particulars (Delivery Date / Total Complement) instead of
  // making the office retype what's already on file — exposure hours
  // should start counting from when the vessel actually entered service.
  suggestedStartDate?: string;
  suggestedCrew?: number;
}) {
  const [addingNew, setAddingNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<CrewEntryView | null>(null);
  const [, startDeleting] = useTransition();

  function requestDelete(e: CrewEntryView) {
    setDeleteError(null);
    setConfirmTarget(e);
  }

  function confirmDelete() {
    if (!confirmTarget) return;
    const id = confirmTarget.id;
    setConfirmTarget(null);
    setDeletingId(id);
    setDeleteError(null);
    const fd = new FormData();
    fd.set("entryId", id);
    startDeleting(async () => {
      try {
        const res = await deleteCrewEntryAction(fd);
        if (!res.ok) setDeleteError(res.error);
      } catch {
        setDeleteError("You don't have permission to delete crew entries.");
      }
      setDeletingId(null);
    });
  }

  const hasActionsColumn = canManage || canDelete;
  const isFirstEntry = entries.length === 0;
  const firstEntryInitial: CrewFormValues | undefined = isFirstEntry
    ? { crew: suggestedCrew ? String(suggestedCrew) : "", effectiveFrom: suggestedStartDate ?? "" }
    : undefined;

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Users className="h-4 w-4 text-accent" /> Crew Roster
      </div>
      <p className="text-xs text-muted-foreground">
        Log the total crew onboard whenever it changes — total exposure hours are calculated automatically, day by
        day, from this history, up to today.
      </p>
      {isFirstEntry && !addingNew ? (
        <p className="text-sm text-muted-foreground">
          No crew count logged yet.
          {suggestedStartDate && ` Exposure hours should start from this vessel's delivery date — ${formatDate(suggestedStartDate)}.`}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Crew</th>
                <th className="px-3 py-2 font-medium">Effective From</th>
                <th className="px-3 py-2 font-medium">Added By</th>
                {hasActionsColumn && <th className="px-3 py-2 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <CrewEntryRow
                  key={e.id}
                  entryId={e.id}
                  initial={crewValuesFrom(e)}
                  enteredBy={e.enteredBy}
                  canManage={canManage}
                  canDelete={canDelete}
                  onDelete={() => requestDelete(e)}
                  deleting={deletingId === e.id}
                />
              ))}
              {canCreate && addingNew && (
                <CrewEntryAddRow vesselId={vesselId} initial={firstEntryInitial} onDone={() => setAddingNew(false)} />
              )}
            </tbody>
          </table>
        </div>
      )}
      {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
      {canCreate && !addingNew && (
        <Button type="button" size="sm" variant="outline" onClick={() => setAddingNew(true)}>
          <Plus className="h-4 w-4" /> Update Crew Count
        </Button>
      )}
      <ConfirmDialog
        open={confirmTarget !== null}
        title="Delete this crew count entry?"
        description="This can't be undone. Exposure hours for any period covering this entry's effective date will be recalculated from what remains."
        details={
          confirmTarget && (
            <>
              <div className="font-medium">{confirmTarget.crew} crew</div>
              <div className="text-muted-foreground">Effective from {formatDate(confirmTarget.effectiveFrom)}</div>
            </>
          )
        }
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </Card>
  );
}

// ─── Injury cases — logged independently, any time ─────────────────────────

type CaseFormValues = { classification: InjuryClassificationValue | ""; description: string; occurredOn: string };

function blankCaseValues(): CaseFormValues {
  return { classification: "", description: "", occurredOn: "" };
}

function caseValuesFrom(c: InjuryCaseView): CaseFormValues {
  return { classification: c.classification, description: c.description ?? "", occurredOn: c.occurredOn.slice(0, 10) };
}

function ClassificationSelect({
  value,
  onChange,
}: {
  value: InjuryClassificationValue | "";
  onChange: (v: InjuryClassificationValue | "") => void;
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as InjuryClassificationValue | "")} className="w-40">
      <option value="">No Case</option>
      {INJURY_CLASSIFICATIONS.map((c) => (
        <option key={c} value={c}>{INJURY_CLASSIFICATION_LABELS[c]}</option>
      ))}
    </Select>
  );
}

function InjuryCaseAddRow({ vesselId, onDone }: { vesselId: string; onDone: () => void }) {
  const [values, setValues] = useState<CaseFormValues>(blankCaseValues());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof CaseFormValues>(field: K, value: CaseFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function submit() {
    if (!values.classification) {
      setError("Select a final classification");
      return;
    }
    if (!values.occurredOn) {
      setError("Date is required");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("vesselId", vesselId);
    fd.set("classification", values.classification);
    fd.set("description", values.description);
    fd.set("occurredOn", values.occurredOn);
    startTransition(async () => {
      const res = await addInjuryCaseAction({ ok: false, error: null }, fd);
      if (!res.ok) setError(res.error);
      else onDone();
    });
  }

  return (
    <tr className="border-b border-dashed border-border bg-muted/20 align-top">
      <td className="px-3 py-2">
        <ClassificationSelect value={values.classification} onChange={(v) => setField("classification", v)} />
      </td>
      <td className="px-3 py-2">
        <Input type="date" className="w-36" value={values.occurredOn} onChange={(e) => setField("occurredOn", e.target.value)} />
      </td>
      <td className="min-w-[200px] px-3 py-2">
        <AutoGrowInput value={values.description} onChange={(e) => setField("description", e.target.value)} placeholder="Who / what happened" />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <Button type="button" size="icon" variant="outline" onClick={submit} disabled={pending} aria-label="Add case" className="h-7 w-7 border-success text-success hover:bg-success/10">
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant="outline" onClick={onDone} aria-label="Cancel" className="h-7 w-7">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {error && <p className="mt-1 whitespace-nowrap text-xs text-danger">{error}</p>}
      </td>
    </tr>
  );
}

function InjuryCaseRow({
  caseId,
  initial,
  editable,
  onDelete,
  deleting,
}: {
  caseId: string;
  initial: CaseFormValues;
  editable: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [values, setValues] = useState<CaseFormValues>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function setField<K extends keyof CaseFormValues>(field: K, value: CaseFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  function save() {
    if (!values.classification) {
      setError("Select a final classification");
      return;
    }
    if (!values.occurredOn) {
      setError("Date is required");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("caseId", caseId);
    fd.set("classification", values.classification);
    fd.set("description", values.description);
    fd.set("occurredOn", values.occurredOn);
    startTransition(async () => {
      const res = await updateInjuryCaseAction({ ok: false, error: null }, fd);
      if (!res.ok) setError(res.error);
      else setDirty(false);
    });
  }

  if (!editable) {
    return (
      <tr className="border-b border-border last:border-0">
        <td className="px-3 py-2">
          <Badge tone="accent" className={cn(CLASSIFICATION_COLOR[values.classification as InjuryClassificationValue], "bg-transparent border border-current")}>
            {values.classification}
          </Badge>
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(values.occurredOn)}</td>
        <td className="px-3 py-2 text-muted-foreground">{values.description || "—"}</td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border align-top last:border-0">
      <td className="px-3 py-2">
        <ClassificationSelect value={values.classification} onChange={(v) => setField("classification", v)} />
      </td>
      <td className="px-3 py-2">
        <Input type="date" className="w-36" value={values.occurredOn} onChange={(e) => setField("occurredOn", e.target.value)} />
      </td>
      <td className="min-w-[200px] px-3 py-2">
        <AutoGrowInput value={values.description} onChange={(e) => setField("description", e.target.value)} placeholder="Who / what happened" />
      </td>
      <td className="px-3 py-2">
        <RowActionButtons onSave={save} saveDisabled={!dirty} saving={pending} onDelete={onDelete} deleting={deleting} deleteLabel="Delete case" />
        {error && <p className="mt-1 whitespace-nowrap text-xs text-danger">{error}</p>}
      </td>
    </tr>
  );
}

export function InjuryCasesPanel({
  vesselId,
  cases,
  editable,
}: {
  vesselId: string;
  cases: InjuryCaseView[];
  editable: boolean;
}) {
  const [addingNew, setAddingNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<InjuryCaseView | null>(null);
  const [, startDeleting] = useTransition();

  function requestDelete(c: InjuryCaseView) {
    setDeleteError(null);
    setConfirmTarget(c);
  }

  function confirmDelete() {
    if (!confirmTarget) return;
    const id = confirmTarget.id;
    setConfirmTarget(null);
    setDeletingId(id);
    setDeleteError(null);
    const fd = new FormData();
    fd.set("caseId", id);
    startDeleting(async () => {
      try {
        const res = await deleteInjuryCaseAction(fd);
        if (!res.ok) setDeleteError(res.error);
      } catch {
        setDeleteError("You don't have permission to delete injury cases.");
      }
      setDeletingId(null);
    });
  }

  return (
    <Card className="space-y-3 p-5">
      <p className="text-sm font-semibold">Injury Cases</p>
      <p className="text-xs text-muted-foreground">
        One final classification each — tallied automatically into FAT/PTD/PPD/LWC/RWC/MTC. Add a case any time; it
        isn&apos;t tied to a monthly report.
      </p>
      {cases.length === 0 && !addingNew ? (
        <p className="text-sm text-muted-foreground">No recordable cases logged.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Classification</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Description</th>
                {editable && <th className="px-3 py-2 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <InjuryCaseRow
                  key={c.id}
                  caseId={c.id}
                  initial={caseValuesFrom(c)}
                  editable={editable}
                  onDelete={() => requestDelete(c)}
                  deleting={deletingId === c.id}
                />
              ))}
              {editable && addingNew && <InjuryCaseAddRow vesselId={vesselId} onDone={() => setAddingNew(false)} />}
            </tbody>
          </table>
        </div>
      )}
      {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
      {editable && !addingNew && (
        <Button type="button" size="sm" variant="outline" onClick={() => setAddingNew(true)}>
          <Plus className="h-4 w-4" /> Add Case
        </Button>
      )}
      <ConfirmDialog
        open={confirmTarget !== null}
        title="Delete this injury case?"
        description="This can't be undone. It will be removed from the FAT/PTD/PPD/LWC/RWC/MTC tallies and LTIF/TRCF calculations."
        details={
          confirmTarget && (
            <>
              <div className={cn("font-medium", CLASSIFICATION_COLOR[confirmTarget.classification])}>
                {INJURY_CLASSIFICATION_LABELS[confirmTarget.classification]}
              </div>
              <div className="text-muted-foreground">{formatDate(confirmTarget.occurredOn)}</div>
              {confirmTarget.description && <div className="text-muted-foreground">{confirmTarget.description}</div>}
            </>
          )
        }
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </Card>
  );
}
