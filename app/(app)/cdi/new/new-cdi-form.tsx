"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCdiAction, type ActionResult } from "@/features/cdi/actions";
import { CDI_SCHEMES } from "@/features/cdi/schema";
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

export function NewCdiForm({ vessels }: { vessels: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createCdiAction,
    { ok: false, error: null },
  );
  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel</Label>
              <Select id="vesselId" name="vesselId" defaultValue="">
                <option value="">— Select —</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scheme">Scheme</Label>
              <Select id="scheme" name="scheme" defaultValue="CDI-M">
                {CDI_SCHEMES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inspectionDate">Inspection date</Label>
              <Input id="inspectionDate" name="inspectionDate" type="date" required />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inspectorName">Inspector name</Label>
              <AutoGrowInput id="inspectorName" name="inspectorName" placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">Port</Label>
              <AutoGrowInput id="port" name="port" placeholder="e.g. Rotterdam" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">Summary</Label>
            <AutoGrowInput id="summary" name="summary" placeholder="Overall summary / outcome…" />
          </div>
          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/cdi"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
