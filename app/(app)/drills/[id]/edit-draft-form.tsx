"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateDraftDrillAction,
  type ActionResult,
} from "@/features/drills/actions";
import type { ScheduleItemOption } from "../new/new-drill-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";

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

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export type EditableDrill = {
  id: string;
  vesselId: string;
  scheduleItemId: string;
  drillDate: string; // yyyy-mm-dd
  drillTime: string;
  position: string;
  participants: string;
  conductedBy: string;
  details: string;
  deficiencies: string;
  correctiveAction: string;
  vesselRemarks: string;
};

/**
 * Full edit of a Draft's own report fields. Only ever rendered for the
 * draft's own reporter — any shipboard user, or the specific office user
 * who created it (see [id]/page.tsx's isOwnDraft gate).
 */
export function EditDraftDrillForm({
  drill,
  vessels,
  scheduleItems,
  isShipboard,
  ownVesselId,
  ownVesselName,
}: {
  drill: EditableDrill;
  vessels: { id: string; name: string }[];
  scheduleItems: ScheduleItemOption[];
  isShipboard: boolean;
  ownVesselId: string | null;
  ownVesselName: string | null;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    (prev, formData) => updateDraftDrillAction(drill.id, prev, formData),
    { ok: false, error: null },
  );

  const grouped = groupByCategory(scheduleItems);

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Edit Draft</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="scheduleItemId">Kind of Drill / Training</Label>
            <Select id="scheduleItemId" name="scheduleItemId" defaultValue={drill.scheduleItemId} required>
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
              defaultValue={drill.vesselId}
            />
            <div className="space-y-1.5">
              <Label htmlFor="drillDate">Date</Label>
              <Input id="drillDate" name="drillDate" type="date" defaultValue={drill.drillDate} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="drillTime">Time</Label>
              <Input id="drillTime" name="drillTime" defaultValue={drill.drillTime} placeholder="e.g. 1000H-1030H" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="position">Position</Label>
            <AutoGrowInput id="position" name="position" defaultValue={drill.position} placeholder="Ship's position/location during the drill" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="conductedBy">Master's Name</Label>
            <AutoGrowInput id="conductedBy" name="conductedBy" defaultValue={drill.conductedBy} placeholder="Name / rank" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="participants">Ranks of Crew Participated</Label>
            <AutoGrowInput id="participants" name="participants" defaultValue={drill.participants} placeholder="Names / ranks / count of participants…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="details">Details of Drill / Training</Label>
            <AutoGrowInput
              id="details"
              name="details"
              className="max-h-none"
              defaultValue={drill.details}
              placeholder="Chronological narrative of the drill — paste directly from the ship's own report if you have one…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deficiencies">Found Deficiencies</Label>
            <AutoGrowInput id="deficiencies" name="deficiencies" defaultValue={drill.deficiencies} placeholder="Leave blank if none noted" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correctiveAction">Master's Opinion for Improvement and Corrective Action</Label>
            <AutoGrowInput id="correctiveAction" name="correctiveAction" defaultValue={drill.correctiveAction} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vesselRemarks">Vessel Remarks</Label>
            <AutoGrowInput id="vesselRemarks" name="vesselRemarks" defaultValue={drill.vesselRemarks} placeholder="Equipment condition, stowage, readiness…" />
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
