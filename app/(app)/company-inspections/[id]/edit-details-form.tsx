"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  COMPANY_INSPECTION_TYPES,
  COMPANY_INSPECTION_TYPE_LABELS,
  COMPANY_INSPECTION_VISIT_KINDS,
  COMPANY_INSPECTION_VISIT_KIND_LABELS,
} from "@/features/company-inspections/schema";
import { updateCompanyInspectionDetailsAction, type ActionResult } from "@/features/company-inspections/actions";
import type { CompanyInspectionType, CompanyInspectionVisitKind } from "@/lib/generated/prisma";

export function EditDetailsForm({
  inspectionId,
  inspectionType,
  visitKind,
  inspectorName,
  port,
}: {
  inspectionId: string;
  inspectionType: CompanyInspectionType | null;
  visitKind: CompanyInspectionVisitKind | null;
  inspectorName: string | null;
  port: string | null;
}) {
  const [type, setType] = useState(inspectionType ?? "");
  const [kind, setKind] = useState(visitKind ?? "");
  const [inspector, setInspector] = useState(inspectorName ?? "");
  const [portValue, setPortValue] = useState(port ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("inspectionId", inspectionId);
    fd.set("inspectionType", type);
    fd.set("visitKind", kind);
    fd.set("inspectorName", inspector);
    fd.set("port", portValue);
    startTransition(async () => {
      const res: ActionResult = await updateCompanyInspectionDetailsAction({ ok: false, error: null }, fd);
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="edit-inspectionType">Type of inspection</Label>
          <Select
            id="edit-inspectionType"
            value={type}
            onChange={(e) => {
              setType(e.target.value as CompanyInspectionType | "");
              setSaved(false);
            }}
          >
            <option value="">— Not specified —</option>
            {COMPANY_INSPECTION_TYPES.map((t) => (
              <option key={t} value={t}>{COMPANY_INSPECTION_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-visitKind">Kind of inspection</Label>
          <Select
            id="edit-visitKind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as CompanyInspectionVisitKind | "");
              setSaved(false);
            }}
          >
            <option value="">— Not specified —</option>
            {COMPANY_INSPECTION_VISIT_KINDS.map((k) => (
              <option key={k} value={k}>{COMPANY_INSPECTION_VISIT_KIND_LABELS[k]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-port">Port of inspection</Label>
          <Input
            id="edit-port"
            value={portValue}
            placeholder="e.g. Singapore"
            onChange={(e) => {
              setPortValue(e.target.value);
              setSaved(false);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-inspectorName">Inspector name</Label>
          <Input
            id="edit-inspectorName"
            value={inspector}
            placeholder="Superintendent conducting the inspection"
            onChange={(e) => {
              setInspector(e.target.value);
              setSaved(false);
            }}
          />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && !error && (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <Check className="h-4 w-4" /> Details saved.
        </p>
      )}

      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </Button>
    </div>
  );
}
