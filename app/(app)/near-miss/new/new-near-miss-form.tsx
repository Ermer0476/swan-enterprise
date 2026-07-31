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
  HOR_CATEGORIES,
  HOR_CATEGORY_LABELS,
} from "@/features/near-miss/schema";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_LABELS,
  ROOT_CAUSE_SUBCATEGORIES,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
} from "@/lib/root-cause";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Textarea, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  positions,
}: {
  vessels: { id: string; name: string }[];
  positions: readonly string[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createNearMissAction,
    { ok: false, error: null },
  );
  const [rootCause, setRootCause] = useState("");
  const [rootCauseSub, setRootCauseSub] = useState("");
  const rootCauseSubOptions =
    rootCause && (ROOT_CAUSE_SUBCATEGORIES as Record<string, readonly string[]>)[rootCause];
  const [capaRowCount, setCapaRowCount] = useState(1);
  const [isHor, setIsHor] = useState(false);

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
              <Label htmlFor="reporterName">Name of Reporter</Label>
              <AutoGrowInput id="reporterName" name="reporterName" placeholder="Full name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reporterPosition">Position / Rank</Label>
              <Select id="reporterPosition" name="reporterPosition" defaultValue="" required>
                <option value="" disabled>— Select position —</option>
                {positions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="rounded-md border border-border">
            <label className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40">
              <input
                type="checkbox"
                name="kind"
                value="HOR"
                checked={isHor}
                onChange={(e) => setIsHor(e.target.checked)}
                className="h-4 w-4"
              />
              This is a Hazard Observation (HOR)
            </label>
            {isHor && (
              <div className="space-y-1.5 border-t border-border bg-muted/40 p-3">
                <Label htmlFor="horCategory">Category</Label>
                <Select id="horCategory" name="horCategory" defaultValue="">
                  <option value="" disabled>— Select category —</option>
                  {HOR_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{HOR_CATEGORY_LABELS[c]}</option>
                  ))}
                </Select>
                <label className="flex items-center gap-2 pt-1 text-sm">
                  <input type="checkbox" name="stopAuthorityExercised" className="h-4 w-4" />
                  Stop Work Authority Exercised?
                </label>
              </div>
            )}
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
              onChange={(e) => {
                setRootCause(e.target.value);
                setRootCauseSub(""); // sub-category list differs per category — reset on change
              }}
            >
              <option value="" disabled>— Select root cause —</option>
              {ROOT_CAUSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{ROOT_CAUSE_LABELS[c]}</option>
              ))}
            </Select>
          </div>

          {rootCauseSubOptions && (
            <div className="space-y-1.5">
              <Label htmlFor="rootCauseSubCategory">Sub-category</Label>
              <Select
                id="rootCauseSubCategory"
                name="rootCauseSubCategory"
                required
                value={rootCauseSub}
                onChange={(e) => setRootCauseSub(e.target.value)}
              >
                <option value="" disabled>— Select sub-category —</option>
                {rootCauseSubOptions.map((s) => (
                  <option key={s} value={s}>
                    {ROOT_CAUSE_SUBCATEGORY_LABELS[rootCause as keyof typeof ROOT_CAUSE_SUBCATEGORY_LABELS][s]}
                  </option>
                ))}
              </Select>
            </div>
          )}

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
