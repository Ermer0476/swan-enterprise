"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  planAssignmentAction,
  signOnAction,
  signOffAction,
  transferAction,
} from "@/features/crewing/actions";
import type { ActionResult } from "@/features/shared/action-result";
import { SIGN_OFF_REASONS, SIGN_OFF_REASON_LABELS } from "@/features/crewing/schema";
import { vesselLabel } from "@/features/crewing/ui";
import { SHIP_POSITIONS, rankLabel, rankSeniority } from "@/lib/crew-ranks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "../field";
import { Button } from "@/components/ui/button";

/**
 * The crew-change controls — embark, disembark, transfer and planned reliefs —
 * gathered on the seafarer's own record, which is the one place that already
 * holds the optimistic-lock tokens both the man and his current assignment were
 * rendered with.
 *
 * WHICH CONTROLS APPEAR IS DERIVED, NEVER STORED. The current assignment's
 * status decides it, the same way the badges on the page do:
 *   - shore pool (no open assignment) → sign on now, or plan a future berth
 *   - PLANNED (assigned, not yet joined) → confirm the sign-on
 *   - ABOARD → sign off, or transfer to another vessel
 * A completed tour is history and offers nothing to change here.
 *
 * The crew code (Seafarer.crewCode) is person-level and is never touched by any
 * of these — a man keeps his id across every ship he joins.
 */

// Senior-first, exactly as the create form orders it — SHIP_POSITIONS must not
// be re-sorted (lib/crew-ranks.ts), so the display order comes from seniority.
const RANK_OPTIONS = [...SHIP_POSITIONS].sort((a, b) => rankSeniority(a) - rankSeniority(b));

export type VesselOption = { id: string; name: string; code: string | null };

export type CurrentAssignment = {
  id: string;
  /** ISO `updatedAt` — the optimistic lock for sign-off / transfer / confirm. */
  updatedAt: string;
  vesselId: string;
  status: "PLANNED" | "ABOARD";
};

type OpenForm = "signOnNow" | "plan" | "confirm" | "signOff" | "transfer" | null;

function SubmitButton({
  label,
  variant,
}: {
  label: string;
  variant?: "default" | "outline" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function CrewChangePanel({
  seafarerId,
  seafarerUpdatedAt,
  current,
  vessels,
}: {
  seafarerId: string;
  /** ISO `updatedAt` of the Seafarer row — the lock for plan / sign-on-now. */
  seafarerUpdatedAt: string;
  current: CurrentAssignment | null;
  vessels: VesselOption[];
}) {
  const [open, setOpen] = useState<OpenForm>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: (fd: FormData) => Promise<ActionResult>) {
    return async (formData: FormData) => {
      const result = await action(formData);
      // A refused write keeps the form open with its message; a successful one
      // revalidates the page (the server action does) and closes the form.
      if (result.ok) {
        setError(null);
        setOpen(null);
      } else {
        setError(result.error);
      }
    };
  }

  function vesselOptions(exclude?: string) {
    const list = exclude ? vessels.filter((v) => v.id !== exclude) : vessels;
    return list.map((v) => (
      <option key={v.id} value={v.id}>
        {vesselLabel(v)}
      </option>
    ));
  }

  function rankOptions() {
    return RANK_OPTIONS.map((code) => (
      <option key={code} value={code}>
        {rankLabel(code)}
      </option>
    ));
  }

  function reasonOptions() {
    return SIGN_OFF_REASONS.map((r) => (
      <option key={r} value={r}>
        {SIGN_OFF_REASON_LABELS[r]}
      </option>
    ));
  }

  const errorLine = error && (
    <p className="text-sm text-danger" role="alert">
      {error}
    </p>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crew change</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {vessels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active vessels are set up, so there is nowhere to sign him on yet.
          </p>
        ) : current === null ? (
          // ── Shore pool: sign on now, or plan a future berth ──
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={open === "signOnNow" ? "default" : "outline"}
                onClick={() => setOpen(open === "signOnNow" ? null : "signOnNow")}
              >
                Sign on now
              </Button>
              <Button
                type="button"
                variant={open === "plan" ? "default" : "outline"}
                onClick={() => setOpen(open === "plan" ? null : "plan")}
              >
                Plan future assignment
              </Button>
            </div>

            {open === "signOnNow" && (
              <form action={run(signOnAction)} className="space-y-4 border-t border-border pt-4">
                <input type="hidden" name="seafarerId" value={seafarerId} />
                <input type="hidden" name="updatedAt" value={seafarerUpdatedAt} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field id="son-vessel" label="Vessel" required>
                    <Select id="son-vessel" name="vesselId" defaultValue="">
                      <option value="">— Select vessel —</option>
                      {vesselOptions()}
                    </Select>
                  </Field>
                  <Field id="son-rank" label="Rank" required>
                    <Select id="son-rank" name="rankCode" defaultValue="">
                      <option value="">— Select rank —</option>
                      {rankOptions()}
                    </Select>
                  </Field>
                  <Field id="son-planned" label="Planned sign-on" required hint="When he was due to join.">
                    <Input id="son-planned" name="plannedSignOnDate" type="date" />
                  </Field>
                  <Field id="son-actual" label="Actual sign-on" required hint="The day he actually joined.">
                    <Input id="son-actual" name="actualSignOnDate" type="date" />
                  </Field>
                  <Field id="son-port" label="Sign-on port">
                    <Input id="son-port" name="signOnPort" autoComplete="off" />
                  </Field>
                </div>
                <SubmitButton label="Sign on" />
              </form>
            )}

            {open === "plan" && (
              <form action={run(planAssignmentAction)} className="space-y-4 border-t border-border pt-4">
                <input type="hidden" name="seafarerId" value={seafarerId} />
                <input type="hidden" name="updatedAt" value={seafarerUpdatedAt} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field id="plan-vessel" label="Vessel" required>
                    <Select id="plan-vessel" name="vesselId" defaultValue="">
                      <option value="">— Select vessel —</option>
                      {vesselOptions()}
                    </Select>
                  </Field>
                  <Field id="plan-rank" label="Rank" required>
                    <Select id="plan-rank" name="rankCode" defaultValue="">
                      <option value="">— Select rank —</option>
                      {rankOptions()}
                    </Select>
                  </Field>
                  <Field
                    id="plan-planned"
                    label="Planned sign-on"
                    required
                    hint="When he is due to join. May be in the future — he stays Planned until you confirm the sign-on."
                  >
                    <Input id="plan-planned" name="plannedSignOnDate" type="date" />
                  </Field>
                </div>
                <SubmitButton label="Plan assignment" />
              </form>
            )}
          </div>
        ) : current.status === "PLANNED" ? (
          // ── Assigned but not yet joined: confirm the sign-on ──
          <div className="space-y-4">
            <p className="max-w-prose text-sm text-muted-foreground">
              He is assigned to this vessel but has not joined yet. Confirm the sign-on once he is
              aboard.
            </p>
            <Button
              type="button"
              variant={open === "confirm" ? "default" : "outline"}
              onClick={() => setOpen(open === "confirm" ? null : "confirm")}
            >
              Confirm sign-on
            </Button>
            {open === "confirm" && (
              <form action={run(signOnAction)} className="space-y-4 border-t border-border pt-4">
                <input type="hidden" name="assignmentId" value={current.id} />
                <input type="hidden" name="updatedAt" value={current.updatedAt} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field id="cfm-actual" label="Actual sign-on" required hint="The day he joined.">
                    <Input id="cfm-actual" name="actualSignOnDate" type="date" />
                  </Field>
                  <Field id="cfm-port" label="Sign-on port">
                    <Input id="cfm-port" name="signOnPort" autoComplete="off" />
                  </Field>
                </div>
                <SubmitButton label="Confirm sign-on" />
              </form>
            )}
          </div>
        ) : (
          // ── Aboard: sign off, or transfer ──
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={open === "signOff" ? "default" : "outline"}
                onClick={() => setOpen(open === "signOff" ? null : "signOff")}
              >
                Sign off
              </Button>
              <Button
                type="button"
                variant={open === "transfer" ? "default" : "outline"}
                onClick={() => setOpen(open === "transfer" ? null : "transfer")}
              >
                Transfer to another vessel
              </Button>
            </div>

            {open === "signOff" && (
              <form action={run(signOffAction)} className="space-y-4 border-t border-border pt-4">
                <input type="hidden" name="assignmentId" value={current.id} />
                <input type="hidden" name="updatedAt" value={current.updatedAt} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field id="soff-date" label="Sign-off date" required>
                    <Input id="soff-date" name="actualSignOffDate" type="date" />
                  </Field>
                  <Field id="soff-reason" label="Reason" required>
                    <Select id="soff-reason" name="signOffReason" defaultValue="">
                      <option value="">— Select reason —</option>
                      {reasonOptions()}
                    </Select>
                  </Field>
                  <Field id="soff-port" label="Sign-off port">
                    <Input id="soff-port" name="signOffPort" autoComplete="off" />
                  </Field>
                </div>
                <SubmitButton label="Sign off" variant="danger" />
              </form>
            )}

            {open === "transfer" && (
              <form action={run(transferAction)} className="space-y-4 border-t border-border pt-4">
                <input type="hidden" name="fromAssignmentId" value={current.id} />
                <input type="hidden" name="updatedAt" value={current.updatedAt} />
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Off the current vessel
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field id="tr-off-date" label="Sign-off date" required>
                    <Input id="tr-off-date" name="actualSignOffDate" type="date" />
                  </Field>
                  <Field id="tr-off-reason" label="Reason" required>
                    <Select id="tr-off-reason" name="signOffReason" defaultValue="TRANSFER">
                      {reasonOptions()}
                    </Select>
                  </Field>
                  <Field id="tr-off-port" label="Sign-off port">
                    <Input id="tr-off-port" name="signOffPort" autoComplete="off" />
                  </Field>
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Onto the new vessel
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field id="tr-on-vessel" label="Vessel" required>
                    <Select id="tr-on-vessel" name="vesselId" defaultValue="">
                      <option value="">— Select vessel —</option>
                      {vesselOptions(current.vesselId)}
                    </Select>
                  </Field>
                  <Field id="tr-on-rank" label="Rank" required>
                    <Select id="tr-on-rank" name="rankCode" defaultValue="">
                      <option value="">— Select rank —</option>
                      {rankOptions()}
                    </Select>
                  </Field>
                  <Field id="tr-on-planned" label="Planned sign-on" required>
                    <Input id="tr-on-planned" name="plannedSignOnDate" type="date" />
                  </Field>
                  <Field id="tr-on-actual" label="Actual sign-on" required>
                    <Input id="tr-on-actual" name="actualSignOnDate" type="date" />
                  </Field>
                  <Field id="tr-on-port" label="Sign-on port">
                    <Input id="tr-on-port" name="signOnPort" autoComplete="off" />
                  </Field>
                </div>
                <SubmitButton label="Transfer" />
              </form>
            )}
          </div>
        )}

        {errorLine}
      </CardContent>
    </Card>
  );
}
