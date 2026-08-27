"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
import type { ReferenceOption } from "@/lib/reference-registry";
import { CAPA_STATUSES } from "@/features/capa/schema";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_LABELS,
  ROOT_CAUSE_SUBCATEGORIES,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
} from "@/lib/root-cause";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";

function ReportSubmitButton({ blocked, reason }: { blocked: boolean; reason?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="intent"
      value="report"
      disabled={pending || blocked}
      title={blocked ? reason : undefined}
    >
      {pending ? "Reporting…" : "Report near miss"}
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

export function NewNearMissForm({
  vessels,
  positions,
  isShipboard,
  ownVesselId,
  ownVesselName,
}: {
  vessels: { id: string; name: string }[];
  positions: ReferenceOption[];
  isShipboard: boolean;
  ownVesselId: string | null;
  ownVesselName: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // The browser resets every field in the <form> the moment a form action
  // resolves — even on a rejected (fail()) result, since that's still a
  // normal, non-throwing return as far as the browser/React are concerned.
  // We capture exactly what was submitted here so a failed validation only
  // has to point at what's missing, not force the reporter to retype
  // everything else from scratch.
  const lastSubmittedFormData = useRef<FormData | null>(null);
  const pendingHorCategoryRestore = useRef<string | null>(null);

  async function guardedCreateNearMissAction(
    prev: ActionResult,
    formData: FormData,
  ): Promise<ActionResult> {
    lastSubmittedFormData.current = formData;
    return createNearMissAction(prev, formData);
  }

  const [state, formAction] = useActionState<ActionResult, FormData>(
    guardedCreateNearMissAction,
    { ok: false, error: null },
  );
  const [rootCause, setRootCause] = useState("");
  const [rootCauseSub, setRootCauseSub] = useState("");
  const rootCauseSubOptions =
    rootCause && (ROOT_CAUSE_SUBCATEGORIES as Record<string, readonly string[]>)[rootCause];
  const [isHor, setIsHor] = useState(false);

  type CapaRowState = { action: string; responsible: string; targetDate: string; status: string; closedDate: string };
  const blankCapaRow = (): CapaRowState => ({ action: "", responsible: "", targetDate: "", status: "OPEN", closedDate: "" });
  const [capaRows, setCapaRows] = useState<CapaRowState[]>([blankCapaRow()]);

  // Runs after every rejected submission — repairs the fields the browser
  // just wiped (plain inputs directly on the DOM; root cause/HOR/CAPA rows
  // via their own React state) using exactly what the reporter had typed.
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
    ["title", "reporterName", "reporterPosition", "occurredAt", "location",
      "description", "immediateAction", "potentialConsequence", "potentialSeverity",
    ].forEach(restore);

    const stopAuthorityEl = form.elements.namedItem("stopAuthorityExercised") as HTMLInputElement | null;
    if (stopAuthorityEl) stopAuthorityEl.checked = fd.get("stopAuthorityExercised") === "on";

    const kindIsHor = fd.get("kind") === "HOR";
    setIsHor(kindIsHor);
    // If the checkbox was already checked, the Category field is already
    // mounted — restore it directly. Only defer to the follow-up effect
    // when isHor itself is about to flip false→true (field not mounted yet).
    const horCategoryEl = form.elements.namedItem("horCategory") as HTMLSelectElement | null;
    if (kindIsHor && horCategoryEl) {
      horCategoryEl.value = String(fd.get("horCategory") ?? "");
      pendingHorCategoryRestore.current = null;
    } else {
      pendingHorCategoryRestore.current = kindIsHor ? String(fd.get("horCategory") ?? "") : null;
    }

    setRootCause(String(fd.get("rootCauseCategory") ?? ""));
    setRootCauseSub(String(fd.get("rootCauseSubCategory") ?? ""));

    const caAction = fd.getAll("caAction").map(String);
    if (caAction.length > 0) {
      const caResponsible = fd.getAll("caResponsible").map(String);
      const caTargetDate = fd.getAll("caTargetDate").map(String);
      const caStatus = fd.getAll("caStatus").map(String);
      const caClosedDate = fd.getAll("caClosedDate").map(String);
      setCapaRows(
        caAction.map((action, i) => ({
          action,
          responsible: caResponsible[i] ?? "",
          targetDate: caTargetDate[i] ?? "",
          status: caStatus[i] || "OPEN",
          closedDate: caClosedDate[i] ?? "",
        })),
      );
    }
  }, [state]);

  // The Category field only exists in the DOM once isHor is true, so it has
  // to be restored on the render right after that flag flips back on.
  useEffect(() => {
    if (!isHor || pendingHorCategoryRestore.current === null) return;
    const el = formRef.current?.elements.namedItem("horCategory") as HTMLSelectElement | null;
    if (el) el.value = pendingHorCategoryRestore.current;
    pendingHorCategoryRestore.current = null;
  }, [isHor]);
  function setCapaField(i: number, field: keyof CapaRowState, value: string) {
    setCapaRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }
  // Auto-capture today's date the moment an item is marked Closed — same
  // behavior as the shared CapaSummaryTable used on every detail page —
  // relying on someone to separately remember to also type the date is
  // exactly how "Closed with no Closed Out Date" gaps slip through.
  function setCapaStatus(i: number, status: string) {
    setCapaRows((prev) =>
      prev.map((row, idx) =>
        idx === i
          ? { ...row, status, closedDate: status === "CLOSED" && !row.closedDate ? new Date().toISOString().slice(0, 10) : row.closedDate }
          : row,
      ),
    );
  }
  // "Report near miss" needs at least one corrective action on record —
  // otherwise the report should just stay a Draft until there's a plan to
  // report. Shipboard has one further gate on top: every authored action
  // (non-blank Action text) must already be Closed, since only shipboard
  // gets the Status column / can pre-close a row at filing time.
  const hasCapa = capaRows.some((r) => r.action.trim().length > 0);
  const allCapaClosed = capaRows.every((r) => !r.action.trim() || r.status === "CLOSED");
  const reportBlocked = !hasCapa || (isShipboard && !allCapaClosed);
  const reportBlockedReason = !hasCapa
    ? "Add at least one corrective action before reporting"
    : "Close every corrective action in the All CAPA Tracker before reporting to the office";

  return (
    <Card>
      <CardContent className="pt-5">
        <form ref={formRef} action={formAction} className="space-y-4">
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
                  <option key={p.value} value={p.value}>{p.label}</option>
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
            <VesselField
              vessels={vessels}
              isShipboard={isShipboard}
              ownVesselId={ownVesselId}
              ownVesselName={ownVesselName}
            />
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
            <Label htmlFor="description">Details of the {isHor ? "HOR" : "Near Miss"}</Label>
            <AutoGrowInput id="description" name="description" required
              placeholder={isHor ? "Describe the hazard observation…" : "Describe the near miss…"} />
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
            <AutoGrowInput id="immediateAction" name="immediateAction"
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
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col />
                  <col className="w-24" />
                  <col className="w-32" />
                </colgroup>
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Responsible</th>
                    <th className="px-3 py-2 font-medium">Target Date</th>
                  </tr>
                </thead>
                <tbody>
                  {capaRows.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 align-top">
                        <AutoGrowInput
                          name="caAction"
                          placeholder="Describe the action…"
                          value={row.action}
                          onChange={(e) => setCapaField(i, "action", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Input
                          name="caResponsible"
                          placeholder="C/M"
                          value={row.responsible}
                          onChange={(e) => setCapaField(i, "responsible", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Input
                          name="caTargetDate"
                          type="date"
                          value={row.targetDate}
                          onChange={(e) => setCapaField(i, "targetDate", e.target.value)}
                        />
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
              onClick={() => setCapaRows((prev) => [...prev, blankCapaRow()])}
            >
              <Plus className="h-4 w-4" /> Add row
            </Button>
          </div>

          {/* All CAPA Tracker — vessel-only, mirrors the "All CAPA Items"
              section on the near miss detail page. Lets the Master mark a
              corrective action already resolved (or in progress) at the time
              of filing, instead of every row always starting OPEN. */}
          {isShipboard && (
            <div className="space-y-2">
              <Label>All CAPA Tracker</Label>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col />
                    <col className="w-24" />
                    <col className="w-28" />
                    <col className="w-32" />
                    <col className="w-32" />
                  </colgroup>
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Action</th>
                      <th className="px-3 py-2 font-medium">Responsible</th>
                      <th className="px-3 py-2 font-medium">Target Date</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Closed Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capaRows.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 align-top text-muted-foreground">{row.action || "—"}</td>
                        <td className="px-3 py-2 align-top text-muted-foreground">{row.responsible || "—"}</td>
                        <td className="px-3 py-2 align-top text-muted-foreground">{row.targetDate || "—"}</td>
                        <td className="px-3 py-2 align-top">
                          <Select
                            name="caStatus"
                            value={row.status}
                            onChange={(e) => setCapaStatus(i, e.target.value)}
                          >
                            {CAPA_STATUSES.map((s) => (
                              <option key={s} value={s}>{humanize(s)}</option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Input
                            name="caClosedDate"
                            type="date"
                            value={row.closedDate}
                            onChange={(e) => setCapaField(i, "closedDate", e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Already resolved a corrective action before filing this report? Set its status to Closed
                and give the Closed Date here — no need to go back and edit it afterward.
              </p>
            </div>
          )}

          {reportBlocked && (
            <p className="text-xs text-muted-foreground">{reportBlockedReason} — or Save as Draft to keep working on it.</p>
          )}
          {state.error && (
            <p className="text-sm text-danger" role="alert">{state.error}</p>
          )}
          <div className="flex items-center gap-2">
            <ReportSubmitButton blocked={reportBlocked} reason={reportBlockedReason} />
            <DraftSubmitButton />
            <Link href="/near-miss">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
