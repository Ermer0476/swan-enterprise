"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  createDocumentAction,
  type ActionResult,
} from "@/features/risk/actions";
import { RISK_CATEGORIES, REVIEW_FREQUENCY_MONTHS, APPROVAL_LEVELS, APPROVAL_LEVEL_LABELS } from "@/features/risk/schema";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Create Risk Assessment"}
    </Button>
  );
}

export function NewRiskAssessmentForm({
  vessels,
  isShipboard,
  ownVesselId,
  ownVesselName,
}: {
  vessels: { id: string; name: string }[];
  isShipboard: boolean;
  ownVesselId: string | null;
  ownVesselName: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const lastSubmittedFormData = useRef<FormData | null>(null);

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
    [
      "title", "category", "description", "vesselId", "applicableVesselType",
      "reviewFrequencyMonths", "smsProcedureRefs", "riskMatrixRef", "checklistsRequired", "approvalLevel",
    ].forEach(restore);
  }, [state]);

  return (
    <Card>
      <CardContent className="pt-5">
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <AutoGrowInput id="title" name="title" placeholder="e.g. Hot Work in the ER Workshop" className="max-h-none" required />
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <VesselField
              vessels={vessels}
              isShipboard={isShipboard}
              ownVesselId={ownVesselId}
              ownVesselName={ownVesselName}
              blankLabel="— Fleet-wide —"
            />
            <div className="space-y-1.5">
              <Label htmlFor="applicableVesselType">Applicable vessel type</Label>
              <Input id="applicableVesselType" name="applicableVesselType" placeholder="Leave blank for all types" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="smsProcedureRefs">SMS Procedure</Label>
            <Input id="smsProcedureRefs" name="smsProcedureRefs" placeholder="e.g. SSP-11 (Rev.4), SSP-13 (Rev.12), SSP-03" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="riskMatrixRef">Risk Matrix</Label>
              <Input id="riskMatrixRef" name="riskMatrixRef" placeholder="e.g. SSP-13 Appendix 13" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checklistsRequired">Checklists Required</Label>
              <Input id="checklistsRequired" name="checklistsRequired" placeholder="e.g. CK-003 Hot Work Permit" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="approvalLevel">Approval Level</Label>
            <Select id="approvalLevel" name="approvalLevel" defaultValue="LOCAL">
              {APPROVAL_LEVELS.map((a) => <option key={a} value={a}>{APPROVAL_LEVEL_LABELS[a]}</option>)}
            </Select>
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/risk/library"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
          <p className="text-xs text-muted-foreground">
            After creating, you'll add hazard rows one at a time on the document page.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
