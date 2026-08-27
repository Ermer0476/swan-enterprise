"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createVesselDocumentAction,
  updateVesselDocumentAction,
  type ActionResult,
} from "@/features/vessel-documents/actions";
import { VESSEL_DOCUMENT_TYPES } from "@/features/vessel-documents/schema";
import type { DocumentNameSuggestion } from "@/features/vessel-documents/queries";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { ComboboxInput } from "@/components/ui/combobox-input";
import { VesselField } from "@/components/ui/vessel-field";
import { Button } from "@/components/ui/button";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function toDateInputValue(d: string | Date | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export type DocumentFormValues = {
  id?: string;
  vesselId: string | null;
  vesselName?: string | null;
  type: string;
  refNo: string | null;
  name: string;
  issuingBody: string | null;
  certNo: string | null;
  interval: string | null;
  issuedDate: string | Date | null;
  expiredDate: string | Date | null;
  remarks: string | null;
};

export function DocumentForm({
  origin,
  vessels,
  vesselDocTypes,
  companyDocTypes,
  namesByType,
  initial,
  initialVesselId,
  cancelHref,
}: {
  origin: "vessel" | "company";
  /** Only used when origin === "vessel". */
  vessels?: { id: string; name: string }[];
  /** Controlled Document Type options for the vessel picker, read from the
   * office-editable reference list by the server page. Falls back to the
   * built-in VESSEL_DOCUMENT_TYPES constant when not provided, so the picker
   * renders the identical options it always did. */
  vesselDocTypes?: { value: string; label: string }[];
  /** Extra free-text types already used for Company Documents — merged into
   * the datalist alongside a blank option, since there's no fixed list. */
  companyDocTypes?: string[];
  /** Document names already on file for each Type — vessel origin only.
   * Once a Type is picked, the Name field suggests from this list (still
   * free text, since not every certificate has been seen before). Picking a
   * suggestion also carries over its established Ref, company-wide, so the
   * same certificate keeps the same reference number on every vessel. */
  namesByType?: Record<string, DocumentNameSuggestion[]>;
  initial?: DocumentFormValues;
  /** Create mode only — pre-selects the vessel dropdown with whichever
   * vessel the list page was already filtered to. */
  initialVesselId?: string;
  cancelHref: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = !!initial?.id;
  const action = isEdit ? updateVesselDocumentAction : createVesselDocumentAction;
  const [state, formAction] = useActionState<ActionResult, FormData>(action, {
    ok: false,
    error: null,
  });
  const [type, setType] = useState(initial?.type ?? "");
  const typeOptions = vesselDocTypes ?? VESSEL_DOCUMENT_TYPES.map((t) => ({ value: t, label: t }));
  const [refNo, setRefNo] = useState(initial?.refNo ?? "");
  const typeSuggestions = namesByType?.[type] ?? [];
  const nameSuggestions = typeSuggestions.map((s) => s.name);
  const refByName = new Map(typeSuggestions.map((s) => [s.name, s.refNo]));

  return (
    <Card>
      <CardContent className="pt-5">
        <form ref={formRef} action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={initial!.id} />}

          {/* Which vessel (or none, for a Company document) a document belongs
              to is fixed at creation — edited elsewhere by re-filing, not by
              reassigning here — so the edit form shows it read-only. */}
          {isEdit ? (
            <div className="space-y-1.5">
              <Label>Vessel</Label>
              <input type="hidden" name="vesselId" value={initial?.vesselId ?? ""} />
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                {initial?.vesselName ?? "— Company document —"}
              </div>
            </div>
          ) : origin === "vessel" ? (
            <VesselField
              vessels={vessels ?? []}
              isShipboard={false}
              blankLabel="Select vessel…"
              required
              defaultValue={initialVesselId ?? ""}
            />
          ) : (
            <input type="hidden" name="vesselId" value="" />
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="type">Document Type</Label>
              {origin === "vessel" ? (
                <Select
                  id="type"
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                >
                  <option value="" disabled>Select type…</option>
                  {typeOptions.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              ) : (
                <>
                  <Input
                    id="type"
                    name="type"
                    list="company-doc-types"
                    defaultValue={initial?.type ?? ""}
                    placeholder="e.g. Business Permits"
                    required
                  />
                  <datalist id="company-doc-types">
                    {(companyDocTypes ?? []).map((t) => <option key={t} value={t} />)}
                  </datalist>
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="refNo">Ref (optional)</Label>
              <Input
                id="refNo"
                name="refNo"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="e.g. 101.03"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interval">Interval (optional)</Label>
              <Input id="interval" name="interval" defaultValue={initial?.interval ?? ""} placeholder="e.g. 1Y, 5Y, as needed" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Document / Certificate Name</Label>
            {origin === "vessel" ? (
              <ComboboxInput
                id="name"
                name="name"
                defaultValue={initial?.name ?? ""}
                suggestions={nameSuggestions}
                placeholder="e.g. Certificate of Ships Registry"
                required
                onSelect={(selectedName) => {
                  const existingRef = refByName.get(selectedName);
                  if (existingRef) setRefNo(existingRef);
                }}
              />
            ) : (
              <AutoGrowInput id="name" name="name" defaultValue={initial?.name ?? ""} placeholder="e.g. Certificate of Ships Registry" required />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="issuingBody">Issuing Body</Label>
              <AutoGrowInput id="issuingBody" name="issuingBody" defaultValue={initial?.issuingBody ?? ""} placeholder="e.g. Panama Maritime Authority" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="certNo">Cert. No.</Label>
              <Input id="certNo" name="certNo" defaultValue={initial?.certNo ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="issuedDate">Issued</Label>
              <Input id="issuedDate" name="issuedDate" type="date" defaultValue={toDateInputValue(initial?.issuedDate ?? null)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiredDate">Expired</Label>
              <Input id="expiredDate" name="expiredDate" type="date" defaultValue={toDateInputValue(initial?.expiredDate ?? null)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="remarks">Remarks</Label>
            <AutoGrowInput id="remarks" name="remarks" defaultValue={initial?.remarks ?? ""} className="max-h-none" />
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton label={isEdit ? "Save Changes" : "Add Document"} />
            <Link href={cancelHref}><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
