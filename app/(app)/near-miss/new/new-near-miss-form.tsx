"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import {
  createNearMissAction,
  type ActionResult,
} from "@/features/near-miss/actions";
import {
  SEVERITIES,
  NEARMISS_CONSEQUENCE_TYPES,
  NEARMISS_CONSEQUENCE_LABELS,
  NEARMISS_LOCATIONS,
} from "@/features/near-miss/schema";
import { ROOT_CAUSE_CATEGORIES, ROOT_CAUSE_LABELS } from "@/lib/root-cause";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Textarea, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HumanFactorsPicker } from "@/components/incidents/human-factors-picker";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Reporting…" : "Report near miss"}
    </Button>
  );
}

export function NewNearMissForm({
  vessels,
}: {
  vessels: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createNearMissAction,
    { ok: false, error: null },
  );
  const [rootCause, setRootCause] = useState("");
  const isHumanFactors = rootCause === "HUMAN_FACTORS";
  const [capaRowCount, setCapaRowCount] = useState(1);

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <AutoGrowInput id="title" name="title" placeholder="Brief summary" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel</Label>
              <Select id="vesselId" name="vesselId" defaultValue="">
                <option value="">— Shore / N/A —</option>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="occurredAt">Occurred on</Label>
              <Input id="occurredAt" name="occurredAt" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Select id="location" name="location" defaultValue="">
                <option value="">— Select location —</option>
                {NEARMISS_LOCATIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Details of the Near Miss</Label>
            <Textarea id="description" name="description" rows={4} required
              placeholder="Describe the near miss…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="potentialConsequence">Potential consequence</Label>
            <Select id="potentialConsequence" name="potentialConsequence" defaultValue={NEARMISS_CONSEQUENCE_TYPES[0]}>
              {NEARMISS_CONSEQUENCE_TYPES.map((c) => (
                <option key={c} value={c}>{NEARMISS_CONSEQUENCE_LABELS[c]}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="potentialSeverity">Potential severity</Label>
            <Select id="potentialSeverity" name="potentialSeverity" defaultValue="HIGH">
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{humanize(s)}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="immediateAction">Immediate action taken</Label>
            <Textarea id="immediateAction" name="immediateAction" rows={2}
              placeholder="What was done right away?" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rootCauseCategory">Root cause category *</Label>
            <Select
              id="rootCauseCategory"
              name="rootCauseCategory"
              required
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
            >
              <option value="" disabled>— Select root cause —</option>
              {ROOT_CAUSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{ROOT_CAUSE_LABELS[c]}</option>
              ))}
            </Select>
          </div>

          {isHumanFactors && <HumanFactorsPicker />}

          {/* Corrective Action Plan — captured in the same report; the
              vessel monitors/updates these rows afterward on the near miss
              detail page (same CAPA tracker, entity-agnostic). */}
          <div className="space-y-2">
            <Label>Corrective Action Plan</Label>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col />
                  <col className="w-24" />
                  <col className="w-36" />
                </colgroup>
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Responsible</th>
                    <th className="px-3 py-2 font-medium">Target Date</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: capaRowCount }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 align-top">
                        <AutoGrowInput name="caAction" placeholder="Describe the action…" />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Input name="caResponsible" placeholder="C/M" />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Input name="caTargetDate" type="date" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCapaRowCount((n) => n + 1)}
            >
              <Plus className="h-4 w-4" /> Add row
            </Button>
          </div>

          {state.error && (
            <p className="text-sm text-danger" role="alert">{state.error}</p>
          )}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/near-miss">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
