"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateDraftInternalAuditAction,
  type ActionResult,
} from "@/features/internal-audits/actions";
import { AUDIT_STANDARDS } from "@/components/audit/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export type EditableInternalAudit = {
  id: string;
  vesselId: string | null;
  scope: string;
  standard: string;
  auditorName: string;
  auditBody: string;
  auditDate: string; // yyyy-mm-dd
  summary: string;
};

/**
 * Full edit of a Draft's own header fields. Only ever rendered for the
 * draft's own creator — no shipboard user ever holds iaudit:create, so
 * unlike other modules' edit-draft forms this one has no isShipboard branch.
 */
export function EditDraftInternalAuditForm({
  audit,
  vessels,
}: {
  audit: EditableInternalAudit;
  vessels: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    (prev, formData) => updateDraftInternalAuditAction(audit.id, prev, formData),
    { ok: false, error: null },
  );

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Edit Draft</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="scope">Scope</Label>
            <AutoGrowInput id="scope" name="scope" defaultValue={audit.scope} placeholder="e.g. Full SMS audit, Navigation" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="standard">Standard</Label>
              <Select id="standard" name="standard" defaultValue={audit.standard}>
                {AUDIT_STANDARDS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <VesselField
              vessels={vessels}
              isShipboard={false}
              blankLabel="— Shore / office —"
              defaultValue={audit.vesselId ?? ""}
            />
            <div className="space-y-1.5">
              <Label htmlFor="auditDate">Audit date</Label>
              <Input id="auditDate" name="auditDate" type="date" defaultValue={audit.auditDate} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="auditorName">Lead auditor</Label>
              <AutoGrowInput id="auditorName" name="auditorName" defaultValue={audit.auditorName} placeholder="Auditor name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auditBody">Auditing team / department</Label>
              <AutoGrowInput id="auditBody" name="auditBody" defaultValue={audit.auditBody} placeholder="e.g. QHSE Department" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="summary">Summary</Label>
            <AutoGrowInput id="summary" name="summary" defaultValue={audit.summary} placeholder="Overall summary / outcome…" />
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SaveButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
