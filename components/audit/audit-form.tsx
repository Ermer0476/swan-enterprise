"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AUDIT_STANDARDS, type AuditActionResult } from "./types";

type CreateAction = (
  prev: AuditActionResult,
  fd: FormData,
) => Promise<AuditActionResult>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Create audit"}
    </Button>
  );
}

export function AuditForm({
  createAction,
  vessels,
  cancelHref,
  bodyLabel,
  bodyPlaceholder,
}: {
  createAction: CreateAction;
  vessels: { id: string; name: string }[];
  cancelHref: string;
  bodyLabel: string;
  bodyPlaceholder: string;
}) {
  const [state, formAction] = useActionState<AuditActionResult, FormData>(
    createAction,
    { ok: false, error: null },
  );
  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
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
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel</Label>
              <Select id="vesselId" name="vesselId" defaultValue="">
                <option value="">— Shore / office —</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
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
            <Link href={cancelHref}><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
