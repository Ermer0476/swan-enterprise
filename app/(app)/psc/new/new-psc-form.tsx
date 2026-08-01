"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createPscAction, type ActionResult } from "@/features/psc/actions";
import { MOU_REGIONS } from "@/features/psc/schema";
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

export function NewPscForm({ vessels }: { vessels: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createPscAction,
    { ok: false, error: null },
  );
  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="authority">Port State authority</Label>
            <AutoGrowInput id="authority" name="authority" placeholder="e.g. Australia AMSA" required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel</Label>
              <Select id="vesselId" name="vesselId" defaultValue="">
                <option value="">— Select —</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mouRegion">MOU region</Label>
              <Select id="mouRegion" name="mouRegion" defaultValue="Tokyo MOU">
                {MOU_REGIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inspectionDate">Inspection date</Label>
              <Input id="inspectionDate" name="inspectionDate" type="date" required />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="port">Port</Label>
              <AutoGrowInput id="port" name="port" placeholder="e.g. Fremantle" />
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" name="detained" className="h-4 w-4 rounded border-input" />
              Vessel detained
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">Summary</Label>
            <AutoGrowInput id="summary" name="summary" placeholder="Overall summary / outcome…" />
          </div>
          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/psc"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
