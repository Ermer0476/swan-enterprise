"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  createDrillAction,
  type ActionResult,
} from "@/features/drills/actions";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";

export type ScheduleItemOption = {
  id: string;
  category: string | null;
  itemNo: string | null;
  name: string;
};

function groupByCategory(items: ScheduleItemOption[]): [string, ScheduleItemOption[]][] {
  const groups = new Map<string, ScheduleItemOption[]>();
  for (const item of items) {
    const key = item.category ?? "Other";
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }
  return Array.from(groups.entries());
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="intent" value="report" disabled={pending}>
      {pending ? "Saving…" : "Record Drill"}
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

// Mirrors SMS form R-AS-021 "Report of Drill / Training onboard" (Appendix 6).
export function NewDrillForm({
  vessels,
  scheduleItems,
  isShipboard,
  ownVesselId,
  ownVesselName,
}: {
  vessels: { id: string; name: string }[];
  scheduleItems: ScheduleItemOption[];
  isShipboard: boolean;
  ownVesselId: string | null;
  ownVesselName: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // The browser resets every field in the <form> the moment a form action
  // resolves — even on a rejected (fail()) result. Capture what was
  // submitted so a failed submission only has to point at what's missing,
  // not force the user to retype everything else. Same pattern as
  // near-miss/new/new-near-miss-form.tsx.
  const lastSubmittedFormData = useRef<FormData | null>(null);

  async function guardedCreateDrillAction(
    prev: ActionResult,
    formData: FormData,
  ): Promise<ActionResult> {
    lastSubmittedFormData.current = formData;
    return createDrillAction(prev, formData);
  }

  const [state, formAction] = useActionState<ActionResult, FormData>(
    guardedCreateDrillAction,
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
    ["scheduleItemId", "vesselId", "drillDate", "drillTime", "position",
      "conductedBy", "participants", "details", "deficiencies",
      "correctiveAction", "vesselRemarks",
    ].forEach(restore);
  }, [state]);

  const grouped = groupByCategory(scheduleItems);

  return (
    <Card>
      <CardContent className="pt-5">
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="scheduleItemId">Kind of Drill / Training</Label>
            <Select id="scheduleItemId" name="scheduleItemId" defaultValue="" required>
              <option value="" disabled>— Select drill —</option>
              {grouped.map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.itemNo ? `${item.itemNo} — ` : ""}{item.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <VesselField
              vessels={vessels}
              isShipboard={isShipboard}
              ownVesselId={ownVesselId}
              ownVesselName={ownVesselName}
              blankLabel="Select vessel…"
              required
            />
            <div className="space-y-1.5">
              <Label htmlFor="drillDate">Date</Label>
              <Input id="drillDate" name="drillDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="drillTime">Time</Label>
              <Input id="drillTime" name="drillTime" placeholder="e.g. 1000H-1030H" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="position">Position</Label>
            <AutoGrowInput id="position" name="position" placeholder="Ship's position/location during the drill" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="conductedBy">Master's Name</Label>
            <AutoGrowInput id="conductedBy" name="conductedBy" placeholder="Name / rank" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="participants">Ranks of Crew Participated</Label>
            <AutoGrowInput id="participants" name="participants" placeholder="Names / ranks / count of participants…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="details">Details of Drill / Training</Label>
            <AutoGrowInput
              id="details"
              name="details"
              className="max-h-none"
              placeholder="Chronological narrative of the drill — paste directly from the ship's own report if you have one…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deficiencies">Found Deficiencies</Label>
            <AutoGrowInput id="deficiencies" name="deficiencies" placeholder="Leave blank if none noted" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correctiveAction">Master's Opinion for Improvement and Corrective Action</Label>
            <AutoGrowInput id="correctiveAction" name="correctiveAction" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vesselRemarks">Vessel Remarks</Label>
            <AutoGrowInput id="vesselRemarks" name="vesselRemarks" placeholder="Equipment condition, stowage, readiness…" />
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <DraftSubmitButton />
            <Link href="/drills"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
