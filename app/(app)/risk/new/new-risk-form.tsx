"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileUp } from "lucide-react";
import {
  createDocumentAction,
  parseRaDocumentAction,
  type ActionResult,
  type ParseRaDocumentResult,
} from "@/features/risk/actions";
import { RISK_CATEGORIES, REVIEW_FREQUENCY_MONTHS, APPROVAL_LEVELS, APPROVAL_LEVEL_LABELS } from "@/features/risk/schema";
import type { ParsedHazardRowDraft } from "@/features/risk/document-parser";
import type { RiskScaleLabels } from "@/features/risk/schema";
import { DraftCard } from "../hazard-row-draft-card";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function ParseButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" size="sm" disabled={pending}>
      <FileUp className="h-4 w-4" /> {pending ? "Reading document…" : "Read document"}
    </Button>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Create Risk Assessment"}
    </Button>
  );
}

const EMPTY_PARSE: ParseRaDocumentResult = {
  ok: false,
  error: null,
  rows: [],
  metadata: { title: null, smsProcedureRefs: null, riskMatrixRef: null, checklistsRequired: null },
};

export function NewRiskAssessmentForm({ scaleLabels }: { scaleLabels: RiskScaleLabels }) {
  const formRef = useRef<HTMLFormElement>(null);
  const uploadFormRef = useRef<HTMLFormElement>(null);
  const lastSubmittedFormData = useRef<FormData | null>(null);

  // Uploading a revised-RA document is optional — if the office has one on
  // hand, reading it fills in the fields it already contains (title, SMS
  // procedure refs, risk matrix, checklists) and stages its hazard rows so
  // there's no separate later trip to the document page to import them.
  const [parseState, parseAction] = useActionState<ParseRaDocumentResult, FormData>(parseRaDocumentAction, EMPTY_PARSE);
  const [drafts, setDrafts] = useState<ParsedHazardRowDraft[] | null>(null);
  const [title, setTitle] = useState("");
  const [smsProcedureRefs, setSmsProcedureRefs] = useState("");
  const [riskMatrixRef, setRiskMatrixRef] = useState("");
  const [checklistsRequired, setChecklistsRequired] = useState("");

  useEffect(() => {
    if (!parseState.ok) return;
    if (parseState.rows.length > 0) setDrafts(parseState.rows);
    const m = parseState.metadata;
    // Only fill fields the office hasn't already typed into — a second
    // upload (or an edit made before uploading) is never silently clobbered.
    if (m.title) setTitle((v) => v || m.title!);
    if (m.smsProcedureRefs) setSmsProcedureRefs((v) => v || m.smsProcedureRefs!);
    if (m.riskMatrixRef) setRiskMatrixRef((v) => v || m.riskMatrixRef!);
    if (m.checklistsRequired) setChecklistsRequired((v) => v || m.checklistsRequired!);
  }, [parseState]);

  function updateDraft(index: number, next: ParsedHazardRowDraft) {
    setDrafts((prev) => (prev ? prev.map((d, i) => (i === index ? next : d)) : prev));
  }

  function removeDraft(index: number) {
    setDrafts((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  async function guardedCreateDocumentAction(
    prev: ActionResult,
    formData: FormData,
  ): Promise<ActionResult> {
    lastSubmittedFormData.current = formData;
    return createDocumentAction(prev, formData);
  }

  const [state, formAction] = useActionState<ActionResult, FormData>(
    guardedCreateDocumentAction,
    { ok: false, error: null },
  );

  useEffect(() => {
    if (state.ok || !state.error) return;
    const fd = lastSubmittedFormData.current;
    const form = formRef.current;
    if (!fd || !form) return;

    const restore = (name: string) => {
      const el = form.elements.namedItem(name) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement
        | null;
      if (!el) return;
      el.value = String(fd.get(name) ?? "");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    ["category", "description", "applicableVesselType", "reviewFrequencyMonths", "approvalLevel"].forEach(restore);
  }, [state]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div>
            <h2 className="text-sm font-semibold">Have a revised RA document already?</h2>
            <p className="text-xs text-muted-foreground">
              Upload it here first — the title, SMS procedure refs, risk matrix, checklists, and hazard
              rows it already contains get read in below, so there's less to retype. Optional — skip
              straight to the form if you don't have one yet.
            </p>
          </div>
          <form ref={uploadFormRef} action={parseAction} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Revised RA document (.docx)</Label>
              <input
                type="file"
                name="file"
                required
                accept=".docx"
                className="max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
              />
            </div>
            <ParseButton />
          </form>
          {parseState.error && <p className="text-sm text-danger">{parseState.error}</p>}
          {drafts && drafts.length > 0 && (
            <p className="text-sm text-success">
              Read {drafts.length} hazard row{drafts.length === 1 ? "" : "s"} and prefilled what the document had below — check everything before creating.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <form ref={formRef} action={formAction} className="space-y-4">
            <input type="hidden" name="rows" value={JSON.stringify(drafts ?? [])} />

            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <AutoGrowInput
                id="title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Hot Work in the ER Workshop"
                className="max-h-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <Select id="category" name="category" defaultValue={RISK_CATEGORIES[0]}>
                  {RISK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reviewFrequencyMonths">Review frequency</Label>
                <Select id="reviewFrequencyMonths" name="reviewFrequencyMonths" defaultValue="12">
                  {REVIEW_FREQUENCY_MONTHS.map((m) => <option key={m} value={m}>{m} months</option>)}
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description / scope</Label>
              <AutoGrowInput id="description" name="description" className="max-h-none" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="applicableVesselType">Applicable vessel type</Label>
              <Input id="applicableVesselType" name="applicableVesselType" placeholder="Leave blank for all types" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="smsProcedureRefs">SMS Procedure</Label>
              <Input
                id="smsProcedureRefs"
                name="smsProcedureRefs"
                value={smsProcedureRefs}
                onChange={(e) => setSmsProcedureRefs(e.target.value)}
                placeholder="e.g. SSP-11 (Rev.4), SSP-13 (Rev.12), SSP-03"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="riskMatrixRef">Risk Matrix</Label>
                <Input
                  id="riskMatrixRef"
                  name="riskMatrixRef"
                  value={riskMatrixRef}
                  onChange={(e) => setRiskMatrixRef(e.target.value)}
                  placeholder="e.g. SSP-13 Appendix 13"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checklistsRequired">Checklists Required</Label>
                <Input
                  id="checklistsRequired"
                  name="checklistsRequired"
                  value={checklistsRequired}
                  onChange={(e) => setChecklistsRequired(e.target.value)}
                  placeholder="e.g. CK-003 Hot Work Permit"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="approvalLevel">Approval Level</Label>
              <Select id="approvalLevel" name="approvalLevel" defaultValue="LOCAL">
                {APPROVAL_LEVELS.map((a) => <option key={a} value={a}>{APPROVAL_LEVEL_LABELS[a]}</option>)}
              </Select>
            </div>

            {drafts && drafts.length > 0 && (
              <div className="space-y-3 rounded-md border border-dashed border-accent/40 p-4">
                <p className="text-sm font-semibold">
                  Hazard table — {drafts.length} row{drafts.length === 1 ? "" : "s"} from the uploaded document
                </p>
                <p className="text-xs text-muted-foreground">
                  Fix anything the reader got wrong, or remove a row entirely. These are saved as Rev 1 the
                  moment you create the Risk Assessment below — no separate import step.
                </p>
                <div className="space-y-3">
                  {drafts.map((d, i) => (
                    <DraftCard key={i} draft={d} index={i} scaleLabels={scaleLabels} onChange={updateDraft} onRemove={removeDraft} />
                  ))}
                </div>
              </div>
            )}

            {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
            <div className="flex items-center gap-2">
              <SubmitButton />
              <Link href="/risk/library"><Button type="button" variant="ghost">Cancel</Button></Link>
            </div>
            {!drafts && (
              <p className="text-xs text-muted-foreground">
                No document uploaded — you'll add hazard rows one at a time, or upload one above, once this
                is created.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
