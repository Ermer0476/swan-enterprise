"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCompanyInspectionAction, type ActionResult } from "@/features/company-inspections/actions";
import {
  COMPANY_INSPECTION_TYPES,
  COMPANY_INSPECTION_TYPE_LABELS,
  COMPANY_INSPECTION_VISIT_KINDS,
  COMPANY_INSPECTION_VISIT_KIND_LABELS,
} from "@/features/company-inspections/schema";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Create inspection"}
    </Button>
  );
}

export function NewCompanyInspectionForm({
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
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createCompanyInspectionAction,
    { ok: false, error: null },
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <VesselField
              label="Vessel"
              vessels={vessels}
              isShipboard={isShipboard}
              ownVesselId={ownVesselId}
              ownVesselName={ownVesselName}
              blankLabel="— Select —"
            />
            <div className="space-y-1.5">
              <Label htmlFor="inspectionDate">Inspection date</Label>
              <Input id="inspectionDate" name="inspectionDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">Port</Label>
              <AutoGrowInput id="port" name="port" placeholder="e.g. Singapore" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="inspectionType">Inspection type</Label>
              <Select id="inspectionType" name="inspectionType" defaultValue="">
                <option value="">— Not specified —</option>
                {COMPANY_INSPECTION_TYPES.map((t) => (
                  <option key={t} value={t}>{COMPANY_INSPECTION_TYPE_LABELS[t]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inspectorName">Inspector name</Label>
              <AutoGrowInput id="inspectorName" name="inspectorName" placeholder="Superintendent conducting the inspection" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visitKind">Kind of inspection</Label>
              <Select id="visitKind" name="visitKind" defaultValue="">
                <option value="">— Not specified —</option>
                {COMPANY_INSPECTION_VISIT_KINDS.map((k) => (
                  <option key={k} value={k}>{COMPANY_INSPECTION_VISIT_KIND_LABELS[k]}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">Remarks</Label>
            <AutoGrowInput id="summary" name="summary" placeholder="Overall remarks…" />
          </div>
          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/company-inspections"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
