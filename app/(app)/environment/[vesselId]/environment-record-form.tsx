"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { GARBAGE_CATEGORIES, GARBAGE_CATEGORY_LABELS, garbageFieldName, MONTH_NAMES, type GarbageCategoryValue } from "@/features/environment/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select, AutoGrowInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ActionResult = { ok: boolean; error: string | null };

export type UnitOption = { unit: string; unitLabel: string };

export type EnvironmentRecordDefaults = {
  recordId?: string;
  year: string;
  month: string;

  ballastWaterQuantity: string;
  ballastWaterOperations: string;
  ballastWaterMethod: string;
  ballastWaterRemarks: string;

  sewageDischargedAtSea: string;
  sewageDischargedToFacility: string;
  sewageUnit: string;
  sewageReceptionFacility: string;
  sewageRemarks: string;

  greyWaterGenerated: string;
  greyWaterDischarged: string;
  greyWaterRetained: string;
  greyWaterRemarks: string;

  refrigerantGasType: string;
  refrigerantEquipment: string;
  refrigerantAdded: string;
  refrigerantRecovered: string;
  refrigerantDisposedAshore: string;
  refrigerantLeakage: string;
  refrigerantQuantityKg: string;
  refrigerantRemarks: string;

  cargoLoaded: string;
  cargoDischarged: string;
  cargoType: string;
  cargoUnit: string;
  cargoPort: string;

  lubeOilType: string;
  lubeOilAdded: string;
  lubeOilTransferred: string;
  lubeOilLost: string;
  lubeOilEquipment: string;
  lubeOilRemarks: string;

  bilgeGenerated: string;
  bilgeProcessed: string;
  bilgeDischargedOws: string;
  bilgeLandedAshore: string;
  bilgeRetained: string;
  bilgeRemarks: string;

  sludgeGenerated: string;
  sludgeRetained: string;
  sludgeTransferredIncinerator: string;
  sludgeLandedAshore: string;
  sludgeRemarks: string;

  garbage: Record<GarbageCategoryValue, { overboard: string; incinerated: string; ashore: string }>;
};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** Collapsed by default — every category here is genuinely optional most
 * months (a vessel rarely touches all eight in the same period), so the
 * form reads as short at a glance and the crew only opens what actually
 * happened this month. Plain HTML <details>, same pattern as the Voyage
 * Entry form's Section component — no JS state needed for the toggle
 * itself. */
function Section({ title, hint, defaultOpen = false, children }: { title: string; hint?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details className="group rounded-md border border-border" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {hint && <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span>}
        </span>
        <span className="text-xs font-normal text-muted-foreground group-open:hidden">Click to expand</span>
      </summary>
      <div className="grid grid-cols-1 gap-4 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/** One garbage ledger row — three inputs plus a client-only computed Total,
 * matching the bunker table's live-preview convention in
 * voyage-entry-form.tsx (the computed value is never itself submitted). */
function GarbageRow({ category, defaults }: { category: GarbageCategoryValue; defaults: { overboard: string; incinerated: string; ashore: string } }) {
  const [overboard, setOverboard] = useState(defaults.overboard);
  const [incinerated, setIncinerated] = useState(defaults.incinerated);
  const [ashore, setAshore] = useState(defaults.ashore);
  const total = (Number(overboard) || 0) + (Number(incinerated) || 0) + (Number(ashore) || 0);

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2 font-medium">{GARBAGE_CATEGORY_LABELS[category]}</td>
      <td className="px-2 py-2">
        <Input
          type="number"
          step="any"
          name={garbageFieldName(category, "overboard")}
          value={overboard}
          onChange={(e) => setOverboard(e.target.value)}
          className="w-24"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          type="number"
          step="any"
          name={garbageFieldName(category, "incinerated")}
          value={incinerated}
          onChange={(e) => setIncinerated(e.target.value)}
          className="w-24"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          type="number"
          step="any"
          name={garbageFieldName(category, "ashore")}
          value={ashore}
          onChange={(e) => setAshore(e.target.value)}
          className="w-24"
        />
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{total.toFixed(3)}</td>
    </tr>
  );
}

/** Discharged at Sea + Discharged to Reception Facility, with a live-computed
 * Total Monthly Discharged readout — same "detail fields + a client-only
 * computed total, never itself submitted" convention as GarbageRow above. */
function SewageFields({ defaults, unitOptions }: { defaults: EnvironmentRecordDefaults; unitOptions: UnitOption[] }) {
  const [atSea, setAtSea] = useState(defaults.sewageDischargedAtSea);
  const [toFacility, setToFacility] = useState(defaults.sewageDischargedToFacility);
  const total = (Number(atSea) || 0) + (Number(toFacility) || 0);

  return (
    <>
      <Field label="Quantity Discharged at Sea">
        <Input name="sewageDischargedAtSea" type="number" step="any" value={atSea} onChange={(e) => setAtSea(e.target.value)} />
      </Field>
      <Field label="Quantity Discharged to Reception Facility">
        <Input name="sewageDischargedToFacility" type="number" step="any" value={toFacility} onChange={(e) => setToFacility(e.target.value)} />
      </Field>
      <Field label="Unit">
        <Select name="sewageUnit" defaultValue={defaults.sewageUnit}>
          <option value="">— Select unit —</option>
          {unitOptions.map((u) => (
            <option key={u.unit} value={u.unit}>
              {u.unitLabel}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reception Facility">
        <AutoGrowInput name="sewageReceptionFacility" defaultValue={defaults.sewageReceptionFacility} />
      </Field>
      <Field label="Total Monthly Discharged">
        <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm tabular-nums text-muted-foreground">
          {total.toFixed(3)}
        </div>
      </Field>
      <Field label="Remarks">
        <AutoGrowInput name="sewageRemarks" defaultValue={defaults.sewageRemarks} />
      </Field>
    </>
  );
}

export function EnvironmentRecordForm({
  action,
  vesselId,
  defaults,
  sewageUnitOptions,
  cargoUnitOptions,
  submitLabel,
  pendingLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  vesselId: string;
  defaults: EnvironmentRecordDefaults;
  sewageUnitOptions: UnitOption[];
  cargoUnitOptions: UnitOption[];
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: false, error: null });

  return (
    <form action={formAction} className="space-y-4">
      {defaults.recordId ? (
        <input type="hidden" name="recordId" value={defaults.recordId} />
      ) : (
        <input type="hidden" name="vesselId" value={vesselId} />
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">Period</div>
          <div className="grid grid-cols-2 gap-4 sm:max-w-xs">
            <div className="space-y-1.5">
              <Label htmlFor="year">Year</Label>
              <Input id="year" name="year" type="number" defaultValue={defaults.year} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="month">Month</Label>
              <Select id="month" name="month" defaultValue={defaults.month} required>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">Garbage Form</div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Category / Type of Garbage</th>
                  <th className="px-2 py-2 font-medium">Overboard to Sea (cu.m.)</th>
                  <th className="px-2 py-2 font-medium">Incinerated (cu.m.)</th>
                  <th className="px-2 py-2 font-medium">Discharge Ashore (cu.m.)</th>
                  <th className="px-3 py-2 text-right font-medium">Total Garbage (cu.m.)</th>
                </tr>
              </thead>
              <tbody>
                {GARBAGE_CATEGORIES.map((category) => (
                  <GarbageRow key={category} category={category} defaults={defaults.garbage[category]} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="px-1 text-sm font-semibold">Environmental Consumption &amp; Discharge Register</div>
        <p className="px-1 text-xs text-muted-foreground">
          Open only the sections that apply this month — everything below is optional.
        </p>

        <Section title="Ballast Water">
          <Field label="Monthly Quantity (m³)">
            <Input name="ballastWaterQuantity" type="number" step="any" defaultValue={defaults.ballastWaterQuantity} />
          </Field>
          <Field label="Number of Operations">
            <Input name="ballastWaterOperations" type="number" step="1" defaultValue={defaults.ballastWaterOperations} />
          </Field>
          <Field label="Treatment / Exchange Method">
            <AutoGrowInput name="ballastWaterMethod" defaultValue={defaults.ballastWaterMethod} />
          </Field>
          <Field label="Remarks">
            <AutoGrowInput name="ballastWaterRemarks" defaultValue={defaults.ballastWaterRemarks} className="sm:col-span-2 lg:col-span-3" />
          </Field>
        </Section>

        <Section title="Sewage">
          <SewageFields defaults={defaults} unitOptions={sewageUnitOptions} />
        </Section>

        <Section title="Grey Water">
          <Field label="Generated Quantity (m³)">
            <Input name="greyWaterGenerated" type="number" step="any" defaultValue={defaults.greyWaterGenerated} />
          </Field>
          <Field label="Discharged Quantity (m³)">
            <Input name="greyWaterDischarged" type="number" step="any" defaultValue={defaults.greyWaterDischarged} />
          </Field>
          <Field label="Retained / Landed Quantity (m³)">
            <Input name="greyWaterRetained" type="number" step="any" defaultValue={defaults.greyWaterRetained} />
          </Field>
          <Field label="Remarks">
            <AutoGrowInput name="greyWaterRemarks" defaultValue={defaults.greyWaterRemarks} className="sm:col-span-2 lg:col-span-3" />
          </Field>
        </Section>

        <Section title="Refrigerant Gas">
          <Field label="Gas Type">
            <AutoGrowInput name="refrigerantGasType" placeholder="e.g. R407F, R410A" defaultValue={defaults.refrigerantGasType} />
          </Field>
          <Field label="Equipment">
            <AutoGrowInput name="refrigerantEquipment" defaultValue={defaults.refrigerantEquipment} />
          </Field>
          <Field label="Quantity (kg)">
            <Input name="refrigerantQuantityKg" type="number" step="any" defaultValue={defaults.refrigerantQuantityKg} />
          </Field>
          <Field label="Added / Charged (kg)">
            <Input name="refrigerantAdded" type="number" step="any" defaultValue={defaults.refrigerantAdded} />
          </Field>
          <Field label="Recovered (kg)">
            <Input name="refrigerantRecovered" type="number" step="any" defaultValue={defaults.refrigerantRecovered} />
          </Field>
          <Field label="Disposed Ashore (kg)">
            <Input name="refrigerantDisposedAshore" type="number" step="any" defaultValue={defaults.refrigerantDisposedAshore} />
          </Field>
          <Field label="Leakage / Loss (kg)">
            <Input name="refrigerantLeakage" type="number" step="any" defaultValue={defaults.refrigerantLeakage} />
          </Field>
          <Field label="Remarks">
            <AutoGrowInput name="refrigerantRemarks" defaultValue={defaults.refrigerantRemarks} className="sm:col-span-2 lg:col-span-1" />
          </Field>
        </Section>

        <Section title="Cargo" hint="Analytics denominator only — never counted as a MARPOL waste quantity">
          <Field label="Cargo Loaded">
            <Input name="cargoLoaded" type="number" step="any" defaultValue={defaults.cargoLoaded} />
          </Field>
          <Field label="Cargo Discharged">
            <Input name="cargoDischarged" type="number" step="any" defaultValue={defaults.cargoDischarged} />
          </Field>
          <Field label="Unit">
            <Select name="cargoUnit" defaultValue={defaults.cargoUnit}>
              <option value="">— Select unit —</option>
              {cargoUnitOptions.map((u) => (
                <option key={u.unit} value={u.unit}>
                  {u.unitLabel}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cargo Type">
            <AutoGrowInput name="cargoType" defaultValue={defaults.cargoType} />
          </Field>
          <Field label="Port">
            <AutoGrowInput name="cargoPort" defaultValue={defaults.cargoPort} />
          </Field>
        </Section>

        <Section title="Stern Tube / Lube Oil">
          <Field label="Oil Type">
            <AutoGrowInput name="lubeOilType" defaultValue={defaults.lubeOilType} />
          </Field>
          <Field label="Equipment">
            <AutoGrowInput name="lubeOilEquipment" defaultValue={defaults.lubeOilEquipment} />
          </Field>
          <Field label="Quantity Added">
            <Input name="lubeOilAdded" type="number" step="any" defaultValue={defaults.lubeOilAdded} />
          </Field>
          <Field label="Quantity Transferred">
            <Input name="lubeOilTransferred" type="number" step="any" defaultValue={defaults.lubeOilTransferred} />
          </Field>
          <Field label="Quantity Lost / Leakage">
            <Input name="lubeOilLost" type="number" step="any" defaultValue={defaults.lubeOilLost} />
          </Field>
          <Field label="Remarks">
            <AutoGrowInput name="lubeOilRemarks" defaultValue={defaults.lubeOilRemarks} />
          </Field>
        </Section>

        <Section title="Bilge">
          <Field label="Generated (m³)">
            <Input name="bilgeGenerated" type="number" step="any" defaultValue={defaults.bilgeGenerated} />
          </Field>
          <Field label="Processed (m³)">
            <Input name="bilgeProcessed" type="number" step="any" defaultValue={defaults.bilgeProcessed} />
          </Field>
          <Field label="Discharged through OWS (m³)">
            <Input name="bilgeDischargedOws" type="number" step="any" defaultValue={defaults.bilgeDischargedOws} />
          </Field>
          <Field label="Landed Ashore (m³)">
            <Input name="bilgeLandedAshore" type="number" step="any" defaultValue={defaults.bilgeLandedAshore} />
          </Field>
          <Field label="Retained (m³)">
            <Input name="bilgeRetained" type="number" step="any" defaultValue={defaults.bilgeRetained} />
          </Field>
          <Field label="Remarks">
            <AutoGrowInput name="bilgeRemarks" defaultValue={defaults.bilgeRemarks} />
          </Field>
        </Section>

        <Section title="Sludge">
          <Field label="Generated (m³)">
            <Input name="sludgeGenerated" type="number" step="any" defaultValue={defaults.sludgeGenerated} />
          </Field>
          <Field label="Retained (m³)">
            <Input name="sludgeRetained" type="number" step="any" defaultValue={defaults.sludgeRetained} />
          </Field>
          <Field label="Transferred to Incinerator (m³)">
            <Input name="sludgeTransferredIncinerator" type="number" step="any" defaultValue={defaults.sludgeTransferredIncinerator} />
          </Field>
          <Field label="Landed Ashore (m³)">
            <Input name="sludgeLandedAshore" type="number" step="any" defaultValue={defaults.sludgeLandedAshore} />
          </Field>
          <Field label="Remarks">
            <AutoGrowInput name="sludgeRemarks" defaultValue={defaults.sludgeRemarks} />
          </Field>
        </Section>
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex gap-2">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
        <Link href={`/environment/${vesselId}`}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
