"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createFindingAction, type NewFindingState } from "@/features/tmsa/actions";
import { TMSA_ELEMENTS, TMSA_FINDING_SOURCES, TMSA_FINDING_STATUSES, TMSA_FINDING_STATUS_LABELS } from "@/features/tmsa/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initial: NewFindingState = { ok: false, error: null, message: null };

export function NewObservationForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createFindingAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className="mb-4">
        + New Observation
      </Button>
    );
  }

  return (
    <Card className="mb-5">
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">New audit observation</h2>
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>

        <form ref={formRef} action={action} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="elementCode">Element</Label>
              <Select id="elementCode" name="elementCode" required defaultValue="">
                <option value="" disabled>
                  Select…
                </option>
                {TMSA_ELEMENTS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stage">Stage</Label>
              <Select id="stage" name="stage" defaultValue="1">
                {[1, 2, 3, 4].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="questionNo">Question #</Label>
              <Input id="questionNo" name="questionNo" type="number" min={0} placeholder="e.g. 3" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source">Source</Label>
              <Input id="source" name="source" list="tmsa-src-list" placeholder="Equinor, Chevron…" defaultValue="Internal" />
              <datalist id="tmsa-src-list">
                {TMSA_FINDING_SOURCES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observation">Observation</Label>
            <Textarea id="observation" name="observation" required rows={3} placeholder="What the auditor observed…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correctiveAction">Corrective Action</Label>
            <Textarea id="correctiveAction" name="correctiveAction" rows={3} placeholder="Our corrective action…" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="responsible">Responsible</Label>
              <Input id="responsible" name="responsible" placeholder="e.g. Marine Supt." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target">Target date</Label>
              <Input id="target" name="target" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auditYear">Audit year</Label>
              <Input id="auditYear" name="auditYear" type="number" defaultValue={new Date().getFullYear()} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue="OPEN">
                {TMSA_FINDING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TMSA_FINDING_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add observation"}
            </Button>
            {state.error && <p className="text-sm text-danger">{state.error}</p>}
            {state.message && <p className="text-sm text-success">{state.message}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
