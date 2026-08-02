"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateDraftNearMissAction,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export type EditableNearMiss = {
  id: string;
  title: string;
  reporterName: string;
  reporterPosition: string;
  kind: "NEAR_MISS" | "HOR";
  horCategory: string | null;
  stopAuthorityExercised: boolean;
  occurredAt: string; // yyyy-mm-dd
  location: string | null;
  description: string;
  potentialConsequence: string;
  potentialSeverity: string;
  immediateAction: string | null;
  rootCauseCategory: string;
  rootCauseSubCategory: string | null;
};

/**
 * Full edit of a Draft's own report fields — everything except the
 * corrective action rows, which the shared CAPA tracker below this card
 * already lets the vessel add/remove/edit in place. Only ever rendered for
 * the DRAFT's own SHIPBOARD reporter (see [id]/page.tsx's isOwnDraft gate);
 * the vessel is locked, so unlike the create form there's no office branch.
 */
export function EditDraftNearMissForm({
  nearMiss,
  positions,
  ownVesselName,
}: {
  nearMiss: EditableNearMiss;
  positions: readonly string[];
  ownVesselName: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // Same fix as the create form: the browser resets every field in the
  // <form> the moment the action resolves, even on a rejected result — so a
  // failed save would otherwise revert the whole form back to the record's
  // OLD saved values, silently discarding whatever was just being edited.
  const lastSubmittedFormData = useRef<FormData | null>(null);
  const pendingHorCategoryRestore = useRef<string | null>(null);

  async function guardedUpdateAction(
    prev: ActionResult,
    formData: FormData,
  ): Promise<ActionResult> {
    lastSubmittedFormData.current = formData;
    return updateDraftNearMissAction(nearMiss.id, prev, formData);
  }

  const [state, formAction] = useActionState<ActionResult, FormData>(
    guardedUpdateAction,
    { ok: false, error: null },
  );

  const [rootCause, setRootCause] = useState(nearMiss.rootCauseCategory);
  const [rootCauseSub, setRootCauseSub] = useState(nearMiss.rootCauseSubCategory ?? "");
  const rootCauseSubOptions =
    rootCause && (ROOT_CAUSE_SUBCATEGORIES as Record<string, readonly string[]>)[rootCause];
  const [isHor, setIsHor] = useState(nearMiss.kind === "HOR");

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
    ["title", "reporterName", "reporterPosition", "occurredAt", "location",
      "description", "immediateAction", "potentialConsequence", "potentialSeverity",
    ].forEach(restore);

    const stopAuthorityEl = form.elements.namedItem("stopAuthorityExercised") as HTMLInputElement | null;
    if (stopAuthorityEl) stopAuthorityEl.checked = fd.get("stopAuthorityExercised") === "on";

    const kindIsHor = fd.get("kind") === "HOR";
    setIsHor(kindIsHor);
    const horCategoryEl = form.elements.namedItem("horCategory") as HTMLSelectElement | null;
    if (kindIsHor && horCategoryEl) {
      horCategoryEl.value = String(fd.get("horCategory") ?? "");
      pendingHorCategoryRestore.current = null;
    } else {
      pendingHorCategoryRestore.current = kindIsHor ? String(fd.get("horCategory") ?? "") : null;
    }

    setRootCause(String(fd.get("rootCauseCategory") ?? ""));
    setRootCauseSub(String(fd.get("rootCauseSubCategory") ?? ""));
  }, [state]);

  useEffect(() => {
    if (!isHor || pendingHorCategoryRestore.current === null) return;
    const el = formRef.current?.elements.namedItem("horCategory") as HTMLSelectElement | null;
    if (el) el.value = pendingHorCategoryRestore.current;
    pendingHorCategoryRestore.current = null;
  }, [isHor]);

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Edit Draft</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <AutoGrowInput id="title" name="title" defaultValue={nearMiss.title} placeholder="Brief summary" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="reporterName">Name of Reporter</Label>
              <AutoGrowInput id="reporterName" name="reporterName" defaultValue={nearMiss.reporterName} placeholder="Full name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reporterPosition">Position / Rank</Label>
              <Select id="reporterPosition" name="reporterPosition" defaultValue={nearMiss.reporterPosition} required>
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
                <Select id="horCategory" name="horCategory" defaultValue={nearMiss.horCategory ?? ""}>
                  <option value="" disabled>— Select category —</option>
                  {HOR_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{HOR_CATEGORY_LABELS[c]}</option>
                  ))}
                </Select>
                <label className="flex items-center gap-2 pt-1 text-sm">
                  <input type="checkbox" name="stopAuthorityExercised" defaultChecked={nearMiss.stopAuthorityExercised} className="h-4 w-4" />
                  Stop Work Authority Exercised?
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Vessel</Label>
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                {ownVesselName ?? "— No vessel assigned —"}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="occurredAt">Occurred on</Label>
              <Input id="occurredAt" name="occurredAt" type="date" defaultValue={nearMiss.occurredAt} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Select id="location" name="location" defaultValue={nearMiss.location ?? ""}>
                <option value="">— Select location —</option>
                {NEARMISS_LOCATIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Details of the Near Miss</Label>
            <AutoGrowInput id="description" name="description" defaultValue={nearMiss.description} required
              placeholder="Describe the near miss…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="potentialConsequence">Potential consequence</Label>
            <Select id="potentialConsequence" name="potentialConsequence" defaultValue={nearMiss.potentialConsequence}>
              {NEARMISS_CONSEQUENCE_TYPES.map((c) => (
                <option key={c} value={c}>{NEARMISS_CONSEQUENCE_LABELS[c]}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="potentialSeverity">Potential severity</Label>
            <Select id="potentialSeverity" name="potentialSeverity" defaultValue={nearMiss.potentialSeverity}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{humanize(s)}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="immediateAction">Immediate action taken</Label>
            <AutoGrowInput id="immediateAction" name="immediateAction" defaultValue={nearMiss.immediateAction ?? ""}
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
                setRootCauseSub("");
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

          {state.error && (
            <p className="text-sm text-danger" role="alert">{state.error}</p>
          )}
          <div className="flex items-center gap-2">
            <SaveButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
