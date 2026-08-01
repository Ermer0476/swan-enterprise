"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createSireAction, type ActionResult } from "@/features/sire/actions";
import {
  SIRE_INSPECTION_TYPES,
  SIRE_INSPECTION_TYPE_LABELS,
  SIRE_OVERALL_RESULTS,
  SIRE_OVERALL_RESULT_LABELS,
} from "@/features/sire/schema";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Create inspection"}
    </Button>
  );
}

export function NewSireForm({ vessels }: { vessels: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createSireAction,
    { ok: false, error: null },
  );
  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inspectorName">Inspector name</Label>
              <AutoGrowInput id="inspectorName" name="inspectorName" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inspectingCompany">Inspecting company (Oil Major / Charterer)</Label>
              <AutoGrowInput id="inspectingCompany" name="inspectingCompany" placeholder="e.g. Shell, BP, Chevron" required />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="inspectionDate">Inspection date</Label>
              <Input id="inspectionDate" name="inspectionDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">Port of inspection</Label>
              <AutoGrowInput id="port" name="port" placeholder="e.g. Singapore" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inspectionType">Type of inspection</Label>
              <Select id="inspectionType" name="inspectionType" defaultValue="">
                <option value="">— Select —</option>
                {SIRE_INSPECTION_TYPES.map((t) => (
                  <option key={t} value={t}>{SIRE_INSPECTION_TYPE_LABELS[t]}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel name</Label>
              <Select id="vesselId" name="vesselId" defaultValue="">
                <option value="">— Select —</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="overallResult">Overall result</Label>
              <Select id="overallResult" name="overallResult" defaultValue="">
                <option value="">— Not yet assessed —</option>
                {SIRE_OVERALL_RESULTS.map((r) => (
                  <option key={r} value={r}>{SIRE_OVERALL_RESULT_LABELS[r]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sireVersion">SIRE version</Label>
              <AutoGrowInput id="sireVersion" name="sireVersion" defaultValue="2.0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">Remarks</Label>
            <AutoGrowInput id="summary" name="summary" placeholder="Overall remarks…" />
          </div>
          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/sire"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
