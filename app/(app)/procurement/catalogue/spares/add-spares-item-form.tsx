"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addSparesItemAction, type ActionResult } from "@/features/procurement/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initial: ActionResult = { ok: false, error: null };

export function AddSparesItemForm({ vesselId }: { vesselId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addSparesItemAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.ok]);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className="mb-4">
        + Add Spares Item
      </Button>
    );
  }

  return (
    <Card className="mb-5">
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">New Spares catalogue item</h2>
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
        <form ref={formRef} action={action} className="space-y-4">
          <input type="hidden" name="vesselId" value={vesselId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="makerName">Maker</Label>
              <Input id="makerName" name="makerName" required placeholder="e.g. MAN B&W" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="equipmentName">Equipment</Label>
              <Input id="equipmentName" name="equipmentName" required placeholder="e.g. Main Engine" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partNo">Part No.</Label>
              <Input id="partNo" name="partNo" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" name="unit" required placeholder="pc, set, kit…" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="e.g. Bosun Store Box No. 3" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="criticalSpare" />
            Critical Spare (ISM 10.3)
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add item"}
            </Button>
            {state.error && <p className="text-sm text-danger">{state.error}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
