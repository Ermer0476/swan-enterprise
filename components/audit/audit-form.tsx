"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";
import { AUDIT_STANDARDS, type AuditActionResult } from "./types";

type CreateAction = (
  prev: AuditActionResult,
  fd: FormData,
) => Promise<AuditActionResult>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="intent" value="report" disabled={pending}>
      {pending ? "Saving…" : "Create audit"}
    </Button>
  );
}

function DraftSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
      {pending ? "Saving…" : "Save as Draft"}
    </Button>
  );
}

export function AuditForm({
  createAction,
  vessels,
  cancelHref,
  bodyLabel,
  bodyPlaceholder,
  isShipboard,
  ownVesselId,
  ownVesselName,
  supportsDraft = false,
}: {
  createAction: CreateAction;
  vessels: { id: string; name: string }[];
  cancelHref: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  isShipboard: boolean;
  ownVesselId: string | null;
  ownVesselName: string | null;
  /** Only Internal Audits has a Draft status — External Audits doesn't, so
   * this stays opt-in rather than showing a button that silently does
   * nothing on the shared form's other caller. */
  supportsDraft?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // The browser resets every field in the <form> the moment a form action
  // resolves — even on a rejected (fail()) result. Capture what was
  // submitted so a failed submission only has to point at what's missing,
  // not force the user to retype everything else. Same pattern as
  // near-miss/new/new-near-miss-form.tsx.
  const lastSubmittedFormData = useRef<FormData | null>(null);

  async function guardedCreateAction(
    prev: AuditActionResult,
    formData: FormData,
  ): Promise<AuditActionResult> {
    lastSubmittedFormData.current = formData;
    return createAction(prev, formData);
  }

  const [state, formAction] = useActionState<AuditActionResult, FormData>(
    guardedCreateAction,
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
      // AutoGrowInput only re-measures its height on an "input" event; a
      // direct .value write doesn't fire one, so it'd render collapsed.
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    ["scope", "standard", "vesselId", "auditDate", "auditorName", "auditBody", "summary"].forEach(restore);
  }, [state]);

  return (
    <Card>
      <CardContent className="pt-5">
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="scope">Scope</Label>
            <AutoGrowInput id="scope" name="scope" placeholder="e.g. Full SMS audit, Navigation" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="standard">Standard</Label>
              <Select id="standard" name="standard" defaultValue="ISM Code">
                {AUDIT_STANDARDS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <VesselField
              vessels={vessels}
              isShipboard={isShipboard}
              ownVesselId={ownVesselId}
              ownVesselName={ownVesselName}
              blankLabel="— Shore / office —"
            />
            <div className="space-y-1.5">
              <Label htmlFor="auditDate">Audit date</Label>
              <Input id="auditDate" name="auditDate" type="date" required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="auditorName">Lead auditor</Label>
              <AutoGrowInput id="auditorName" name="auditorName" placeholder="Auditor name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auditBody">{bodyLabel}</Label>
              <AutoGrowInput id="auditBody" name="auditBody" placeholder={bodyPlaceholder} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="summary">Summary</Label>
            <AutoGrowInput id="summary" name="summary" placeholder="Overall summary / outcome…" />
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            {supportsDraft && <DraftSubmitButton />}
            <Link href={cancelHref}><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
