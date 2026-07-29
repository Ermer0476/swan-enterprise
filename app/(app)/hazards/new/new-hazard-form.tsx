"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createHazardAction,
  type ActionResult,
} from "@/features/hazards/actions";
import {
  SEVERITIES,
  HAZARD_TYPES,
  HAZARD_CATEGORIES,
} from "@/features/hazards/schema";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Textarea, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Submit observation"}
    </Button>
  );
}

export function NewHazardForm({
  vessels,
}: {
  vessels: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createHazardAction,
    { ok: false, error: null },
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <AutoGrowInput id="title" name="title" placeholder="Brief summary" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select id="category" name="category" defaultValue="PPE">
                {HAZARD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hazardType">Type</Label>
              <Select id="hazardType" name="hazardType" defaultValue="UNSAFE_CONDITION">
                {HAZARD_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel</Label>
              <Select id="vesselId" name="vesselId" defaultValue="">
                <option value="">— Shore / N/A —</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="observedAt">Observed at</Label>
              <Input id="observedAt" name="observedAt" type="datetime-local" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="riskLevel">Risk level</Label>
              <Select id="riskLevel" name="riskLevel" defaultValue="MEDIUM">
                {SEVERITIES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <AutoGrowInput id="location" name="location" placeholder="e.g. Pump room" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observation">Observation</Label>
            <Textarea id="observation" name="observation" rows={4} required
              placeholder="Describe the unsafe act or condition…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="immediateAction">Immediate action taken</Label>
            <Textarea id="immediateAction" name="immediateAction" rows={2}
              placeholder="What was done right away?" />
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/hazards"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
