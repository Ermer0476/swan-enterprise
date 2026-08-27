"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { createSeafarerAction, updateSeafarerAction } from "@/features/crewing/actions";
import type { ActionResult } from "@/features/shared/action-result";
import { vesselLabel } from "@/features/crewing/ui";
import { SHIP_POSITIONS, rankLabel, rankSeniority } from "@/lib/crew-ranks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "./field";

/**
 * The seafarer form — one component for Add and Edit, because the fields are the
 * same fields and two copies would drift.
 *
 * ── WHY THE SENSITIVE SECTION IS A PROP, NOT A CHECK IN HERE ──
 * `sensitive` is decided on the server from the session and passed in. A client
 * component cannot be trusted with that decision, and it does not need to be:
 * when it is null the inputs are not rendered, the values were never sent to the
 * browser (the page read them through the OPERATIONAL tier, which has no such
 * properties), and updateSeafarerAction omits those columns from its write so
 * the absent inputs cannot null them.
 */

// The fields the browser reset wipes on a rejected submit; restored from the
// captured FormData so a validation failure doesn't force a full retype. Same
// pattern as Capt's other create forms (near-miss/new, defects/new).
const RESTORE_FIELDS = [
  "crewCode",
  "lastName",
  "firstName",
  "middleName",
  "suffix",
  "nationality",
  "dateOfBirth",
  "contactPhone",
  "contactEmail",
  "nextOfKinName",
  "nextOfKinRelationship",
  "nextOfKinPhone",
  "vesselId",
  "rankCode",
  "plannedSignOnDate",
  "actualSignOnDate",
];

/**
 * The rank dropdown, senior first. SHIP_POSITIONS is ordered by the dropdowns
 * that shipped before this one and must not be re-sorted, so the order a clerk
 * expects — Master at the top — is applied here, from RANK_SENIORITY, the same
 * key the crew list sorts by.
 */
const RANK_OPTIONS = [...SHIP_POSITIONS].sort((a, b) => rankSeniority(a) - rankSeniority(b));

export type VesselOption = { id: string; name: string; code: string | null };

export type SeafarerFormValues = {
  crewCode: string;
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
};

export type SeafarerSensitiveValues = {
  nationality: string;
  dateOfBirth: string;
  contactPhone: string;
  contactEmail: string;
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinPhone: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function SeafarerForm({
  mode,
  seafarerId,
  updatedAt,
  values,
  sensitive,
  vessels,
}: {
  mode: "create" | "edit";
  seafarerId?: string;
  /** The row's `updatedAt` at render time — the optimistic lock. */
  updatedAt?: string;
  values: SeafarerFormValues;
  /** null = this caller may not see or write the sensitive tier. */
  sensitive: SeafarerSensitiveValues | null;
  /**
   * The vessels a FIRST assignment may name, or null for "no first-assignment
   * block" — the edit form and any caller without crew:assign. Decided on the
   * server, like `sensitive`, and for the same reason.
   */
  vessels?: VesselOption[] | null;
}) {
  const action = mode === "create" ? createSeafarerAction : updateSeafarerAction;

  const formRef = useRef<HTMLFormElement>(null);
  const lastSubmitted = useRef<FormData | null>(null);

  async function capturing(prev: ActionResult, formData: FormData): Promise<ActionResult> {
    lastSubmitted.current = formData;
    return action(prev, formData);
  }

  const [state, formAction] = useActionState<ActionResult, FormData>(capturing, {
    ok: false,
    error: null,
  });

  useEffect(() => {
    if (state.ok || !state.error) return;
    const fd = lastSubmitted.current;
    const form = formRef.current;
    if (!fd || !form) return;
    for (const name of RESTORE_FIELDS) {
      const el = form.elements.namedItem(name);
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      ) {
        el.value = String(fd.get(name) ?? "");
      }
    }
  }, [state]);

  const fieldErrors = state.fieldErrors;
  // The issue year the auto-assign hint quotes — the same year
  // createSeafarerAction mints under. Read at render so it rolls over.
  const crewIdYear = new Date().getFullYear();

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {mode === "edit" && (
        <>
          <input type="hidden" name="seafarerId" value={seafarerId ?? ""} />
          <input type="hidden" name="updatedAt" value={updatedAt ?? ""} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              id="lastName"
              label="Surname"
              required
              error={fieldErrors?.lastName}
              hint="As it appears on his SIRB and contract."
            >
              <Input id="lastName" name="lastName" defaultValue={values.lastName} autoComplete="off" />
            </Field>
            <Field id="firstName" label="First name" required error={fieldErrors?.firstName}>
              <Input id="firstName" name="firstName" defaultValue={values.firstName} autoComplete="off" />
            </Field>
            <Field
              id="middleName"
              label="Middle name"
              error={fieldErrors?.middleName}
              hint="The mother's maiden surname — it identifies him on official documents."
            >
              <Input id="middleName" name="middleName" defaultValue={values.middleName} autoComplete="off" />
            </Field>
            <Field
              id="suffix"
              label="Suffix"
              error={fieldErrors?.suffix}
              hint="Jr., Sr., III — father and son do sail for the same company."
            >
              <Input id="suffix" name="suffix" defaultValue={values.suffix} autoComplete="off" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="crewCode"
              label="Crew ID"
              error={fieldErrors?.crewCode}
              hint={
                mode === "create"
                  ? `Leave blank to auto-assign the next ${crewIdYear}-#####, or enter an existing crew ID. It is also the only way the ship can tell two men of the same name apart.`
                  : "A legacy value is kept as it is; a new one must look like 2026-00042 (year, dash, five digits)."
              }
            >
              <Input
                id="crewCode"
                name="crewCode"
                defaultValue={values.crewCode}
                autoComplete="off"
                placeholder={mode === "create" ? `${crewIdYear}-00042` : undefined}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {mode === "create" && vessels && vessels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>First assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="max-w-prose rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              Optional. Leave the vessel blank for a man in the shore pool between contracts — he is
              still on the register, and his sign-on can be recorded whenever it happens. What you
              enter here is not stored on the man: it is a crew assignment, which is what keeps
              &ldquo;which ship was he on in March&rdquo; answerable years later.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                id="vesselId"
                label="Vessel"
                error={fieldErrors?.vesselId}
                hint="The ship he is joining, with its fleet code."
              >
                <Select id="vesselId" name="vesselId" defaultValue="">
                  <option value="">— None (shore pool) —</option>
                  {vessels.map((v) => (
                    <option key={v.id} value={v.id}>
                      {vesselLabel(v)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                id="rankCode"
                label="Rank"
                error={fieldErrors?.rankCode}
                hint="The rank he signs on in — not necessarily the one he last held."
              >
                <Select id="rankCode" name="rankCode" defaultValue="">
                  <option value="">— Select rank —</option>
                  {RANK_OPTIONS.map((code) => (
                    <option key={code} value={code}>
                      {rankLabel(code)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                id="plannedSignOnDate"
                label="Planned sign-on"
                error={fieldErrors?.plannedSignOnDate}
                hint="When he is due to join. May be in the future."
              >
                <Input id="plannedSignOnDate" name="plannedSignOnDate" type="date" />
              </Field>
              <Field
                id="actualSignOnDate"
                label="Actual sign-on"
                error={fieldErrors?.actualSignOnDate}
                hint="Only if he has already joined. Blank means he shows as Planned, not aboard."
              >
                <Input id="actualSignOnDate" name="actualSignOnDate" type="date" />
              </Field>
            </div>
          </CardContent>
        </Card>
      )}

      {sensitive && (
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="max-w-prose rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              These fields are personal data under the Data Privacy Act and are visible only to the
              crewing desk — never to a vessel. Record only what the register needs. The next of kin
              is a separate person who never dealt with the company: their details are held for
              emergency use only, and they will be told so on request.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field id="nationality" label="Nationality" error={fieldErrors?.nationality}>
                <Input id="nationality" name="nationality" defaultValue={sensitive.nationality} autoComplete="off" />
              </Field>
              <Field
                id="dateOfBirth"
                label="Date of birth"
                error={fieldErrors?.dateOfBirth}
                hint="Needed for contract and certificate validity."
              >
                <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={sensitive.dateOfBirth} />
              </Field>
              <Field id="contactPhone" label="Personal phone" error={fieldErrors?.contactPhone}>
                <Input id="contactPhone" name="contactPhone" defaultValue={sensitive.contactPhone} autoComplete="off" />
              </Field>
              <Field id="contactEmail" label="Personal email" error={fieldErrors?.contactEmail}>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  defaultValue={sensitive.contactEmail}
                  autoComplete="off"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field id="nextOfKinName" label="Next of kin" error={fieldErrors?.nextOfKinName}>
                <Input id="nextOfKinName" name="nextOfKinName" defaultValue={sensitive.nextOfKinName} autoComplete="off" />
              </Field>
              <Field
                id="nextOfKinRelationship"
                label="Relationship"
                error={fieldErrors?.nextOfKinRelationship}
              >
                <Input
                  id="nextOfKinRelationship"
                  name="nextOfKinRelationship"
                  defaultValue={sensitive.nextOfKinRelationship}
                  autoComplete="off"
                />
              </Field>
              <Field id="nextOfKinPhone" label="Next of kin phone" error={fieldErrors?.nextOfKinPhone}>
                <Input id="nextOfKinPhone" name="nextOfKinPhone" defaultValue={sensitive.nextOfKinPhone} autoComplete="off" />
              </Field>
            </div>
          </CardContent>
        </Card>
      )}

      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <SubmitButton label={mode === "create" ? "Add Seafarer" : "Save Changes"} />
        <Link href={mode === "edit" && seafarerId ? `/crewing/seafarers/${seafarerId}` : "/crewing/seafarers"}>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
