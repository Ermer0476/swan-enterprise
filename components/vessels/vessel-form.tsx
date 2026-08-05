"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { VESSEL_STATUSES, humanize } from "@/features/vessels/schema";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ActionResult = { ok: boolean; error: string | null };

export type VesselFormValues = {
  id?: string;
  name: string;
  code: string;
  imo: string;
  officialNumber: string;
  callSign: string;
  mmsi: string;
  flag: string;
  type: string;
  classificationSociety: string;
  yearBuilt: string;
  grossTonnage: string;
  loa: string;
  breadth: string;
  depth: string;
  status: string;
  capacityCbm: string;
  netTonnage: string;
  deadweight: string;
  tradeArea: string;
  registeredOwner: string;
  headOwner: string;
  charterer: string;
  yearWithSwan: string;
  lastDryDock: string;
  dryDockPlace: string;
  nextDryDockDue: string;
};

const EMPTY: VesselFormValues = {
  name: "",
  code: "",
  imo: "",
  officialNumber: "",
  callSign: "",
  mmsi: "",
  flag: "",
  type: "LPG Carrier",
  classificationSociety: "",
  yearBuilt: "",
  grossTonnage: "",
  loa: "",
  breadth: "",
  depth: "",
  status: "ACTIVE",
  capacityCbm: "",
  netTonnage: "",
  deadweight: "",
  tradeArea: "",
  registeredOwner: "",
  headOwner: "",
  charterer: "",
  yearWithSwan: "",
  lastDryDock: "",
  dryDockPlace: "",
  nextDryDockDue: "",
};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function VesselForm({
  action,
  values,
  submitLabel,
  pendingLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  values?: Partial<VesselFormValues>;
  submitLabel: string;
  pendingLabel: string;
}) {
  const v = { ...EMPTY, ...values };
  const [state, formAction] = useActionState<ActionResult, FormData>(action, {
    ok: false,
    error: null,
  });

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-6">
      {v.id && <input type="hidden" name="vesselId" value={v.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Vessel Name</Label>
          <AutoGrowInput id="name" name="name" defaultValue={v.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="code">Vessel Code</Label>
          <Input id="code" name="code" defaultValue={v.code} placeholder="e.g. SWA" maxLength={6} />
          <p className="text-xs text-muted-foreground">Prefixed onto this vessel's NCR numbers (e.g. SWA-NCR-2026-0001). Can be filled in later.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="imo">IMO Number</Label>
          <Input id="imo" name="imo" defaultValue={v.imo} placeholder="7 digits — can be filled in later" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="officialNumber">Official Number</Label>
          <Input id="officialNumber" name="officialNumber" defaultValue={v.officialNumber} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="callSign">Call Sign</Label>
          <Input id="callSign" name="callSign" defaultValue={v.callSign} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mmsi">MMSI Number</Label>
          <Input id="mmsi" name="mmsi" defaultValue={v.mmsi} placeholder="9 digits" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="flag">Flag State</Label>
          <AutoGrowInput id="flag" name="flag" defaultValue={v.flag} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">Type of Ship</Label>
          <Input id="type" name="type" defaultValue={v.type} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="classificationSociety">Classification Society</Label>
          <AutoGrowInput
            id="classificationSociety"
            name="classificationSociety"
            defaultValue={v.classificationSociety}
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Particulars</legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="yearBuilt">Year Built</Label>
            <Input id="yearBuilt" name="yearBuilt" type="number" defaultValue={v.yearBuilt} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grossTonnage">Gross Tonnage</Label>
            <Input id="grossTonnage" name="grossTonnage" type="number" step="any" defaultValue={v.grossTonnage} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loa">LOA (m)</Label>
            <Input id="loa" name="loa" type="number" step="any" defaultValue={v.loa} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="breadth">Breadth (m)</Label>
            <Input id="breadth" name="breadth" type="number" step="any" defaultValue={v.breadth} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="depth">Depth (m)</Label>
            <Input id="depth" name="depth" type="number" step="any" defaultValue={v.depth} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Fleet Register</legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="capacityCbm">Capacity (CBM)</Label>
            <Input id="capacityCbm" name="capacityCbm" type="number" step="any" defaultValue={v.capacityCbm} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="netTonnage">Net Tonnage</Label>
            <Input id="netTonnage" name="netTonnage" type="number" step="any" defaultValue={v.netTonnage} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deadweight">Deadweight (DWT)</Label>
            <Input id="deadweight" name="deadweight" type="number" step="any" defaultValue={v.deadweight} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tradeArea">Trade Area</Label>
            <AutoGrowInput id="tradeArea" name="tradeArea" defaultValue={v.tradeArea} placeholder="e.g. FE / SEA" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="registeredOwner">Registered Owner</Label>
            <AutoGrowInput id="registeredOwner" name="registeredOwner" defaultValue={v.registeredOwner} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="headOwner">Head Owner</Label>
            <AutoGrowInput id="headOwner" name="headOwner" defaultValue={v.headOwner} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="charterer">Charterer</Label>
            <AutoGrowInput id="charterer" name="charterer" defaultValue={v.charterer} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="yearWithSwan">Year Joined Fleet</Label>
            <Input id="yearWithSwan" name="yearWithSwan" type="number" defaultValue={v.yearWithSwan} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastDryDock">Last Dry Dock</Label>
            <Input id="lastDryDock" name="lastDryDock" type="date" defaultValue={v.lastDryDock} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dryDockPlace">Dry Dock Place</Label>
            <AutoGrowInput id="dryDockPlace" name="dryDockPlace" defaultValue={v.dryDockPlace} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nextDryDockDue">Next Dry Dock Due</Label>
            <Input id="nextDryDockDue" name="nextDryDockDue" type="date" defaultValue={v.nextDryDockDue} />
          </div>
        </div>
      </fieldset>

      <div className="space-y-1.5 sm:w-48">
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue={v.status}>
          {VESSEL_STATUSES.map((s) => (
            <option key={s} value={s}>{humanize(s)}</option>
          ))}
        </Select>
      </div>

      {state.error && (
        <p className="text-sm text-danger" role="alert">{state.error}</p>
      )}
      <div className="flex items-center gap-2">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
        <Link href="/vessels"><Button type="button" variant="ghost">Cancel</Button></Link>
      </div>
        </form>
      </CardContent>
    </Card>
  );
}
