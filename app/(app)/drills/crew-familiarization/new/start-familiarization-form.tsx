"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createAndLogFamiliarizationAction, type ActionResult } from "@/features/crew-familiarization/actions";
import type { LsaFfeCatalogItem } from "@/features/crew-familiarization/queries";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8];

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Saving…" : "Start & log this week"}
    </Button>
  );
}

/**
 * Start a new LSA/FFE familiarization. The induction (and its ref number) is
 * created only when this form is saved with a week's items ticked — there's no
 * empty "New Induction" record anymore.
 */
export function StartFamiliarizationForm({
  vessels,
  catalog,
  isShipboard,
  ownVesselId,
  ownVesselName,
  today,
}: {
  vessels: { id: string; name: string }[];
  catalog: LsaFfeCatalogItem[];
  isShipboard: boolean;
  ownVesselId: string | null;
  ownVesselName: string | null;
  today: string;
}) {
  const [week, setWeek] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [state, formAction] = useActionState<ActionResult, FormData>(createAndLogFamiliarizationAction, {
    ok: false,
    error: null,
  });

  const weekItems = useMemo(() => (week ? catalog.filter((i) => i.suggestedWeek === week) : []), [week, catalog]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <VesselField
            vessels={vessels}
            isShipboard={isShipboard}
            ownVesselId={ownVesselId}
            ownVesselName={ownVesselName}
            blankLabel="Select vessel…"
            required
          />

          <div className="space-y-1.5">
            <Label htmlFor="sf-attendees">Attendees</Label>
            <AutoGrowInput id="sf-attendees" name="attendees" placeholder="Who attended this induction" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sf-supervised">Supervised by</Label>
              <Input id="sf-supervised" name="supervisedBy" placeholder="Name / rank" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sf-cycle">Cycle start date</Label>
              <Input id="sf-cycle" name="cycleStartDate" type="date" defaultValue={today} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sf-details">Details of familiarization</Label>
            <AutoGrowInput
              id="sf-details"
              name="details"
              className="max-h-none"
              placeholder="Narrative of what was covered / discussed…"
            />
          </div>

          <div>
            <Label>Which week are you logging?</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {WEEKS.map((w) => {
                const count = catalog.filter((i) => i.suggestedWeek === w).length;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setWeek(w);
                      setChecked(new Set());
                    }}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm transition-colors",
                      week === w
                        ? "border-accent bg-accent/90 text-accent-foreground"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    WK{w}
                    {count > 0 && <span className="ml-1.5 text-xs opacity-70 tabular-nums">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {week != null && (
            <>
              <input type="hidden" name="week" value={week} />
              <div className="space-y-1.5">
                <Label>Items familiarized this week (WK{week})</Label>
                {weekItems.length === 0 ? (
                  <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                    No items are scheduled for this week.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-md border border-border p-3 sm:grid-cols-2">
                    {weekItems.map((item) => (
                      <label key={item.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="checkedItemIds"
                          value={item.id}
                          checked={checked.has(item.id)}
                          onChange={() => toggle(item.id)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        />
                        <span>
                          <span className="mr-1 text-muted-foreground">{item.itemNo}.</span>
                          {item.name}
                          <span className="ml-1 text-xs text-muted-foreground">({item.category})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 sm:max-w-xs">
                <Label htmlFor="sf-date">Date familiarized</Label>
                <Input id="sf-date" name="completedDate" type="date" defaultValue={today} required />
              </div>
            </>
          )}

          {state.error && (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <SubmitButton disabled={week == null || checked.size === 0} />
            <Link href="/drills/crew-familiarization">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
