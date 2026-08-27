"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createCircularAction,
  type ActionResult,
} from "@/features/circulars/actions";
import {
  CIRCULAR_SOURCES,
  CIRCULAR_SOURCE_LABELS,
  CIRCULAR_CATEGORIES,
  type CircularSourceValue,
} from "@/features/circulars/schema";
import type { IssuingBodySuggestions } from "@/features/circulars/queries";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Issuing…" : "Issue Circular"}
    </Button>
  );
}

export function NewCircularForm({
  vessels,
  officeUsers,
  issuingBodySuggestions,
}: {
  vessels: { id: string; name: string }[];
  officeUsers: { id: string; fullName: string; department: string }[];
  issuingBodySuggestions: IssuingBodySuggestions;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createCircularAction,
    { ok: false, error: null },
  );
  const [source, setSource] = useState<CircularSourceValue>("FLAG");
  const suggestions = useMemo(() => issuingBodySuggestions[source], [issuingBodySuggestions, source]);

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <AutoGrowInput id="title" name="title" placeholder="Circular subject" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="source">Source</Label>
              <Select
                id="source"
                name="source"
                value={source}
                onChange={(e) => setSource(e.target.value as CircularSourceValue)}
              >
                {CIRCULAR_SOURCES.map((s) => (
                  <option key={s} value={s}>{CIRCULAR_SOURCE_LABELS[s]}</option>
                ))}
              </Select>
            </div>
            {source !== "COMPANY" && (
              <div className="space-y-1.5">
                <Label htmlFor="issuingBody">
                  {source === "FLAG" ? "Flag state" : source === "CLASS" ? "Classification society" : "Insurer / P&I Club"}
                </Label>
                <Input
                  id="issuingBody"
                  name="issuingBody"
                  list="issuingBodySuggestions"
                  placeholder={source === "INSURANCE" ? "e.g. North of England P&I" : "Type or pick from the list"}
                />
                {suggestions.length > 0 && (
                  <datalist id="issuingBodySuggestions">
                    {suggestions.map((s) => <option key={s} value={s} />)}
                  </datalist>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select id="category" name="category" defaultValue="SAFETY">
                {CIRCULAR_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Distribution</Label>
              <Select id="vesselId" name="vesselId" defaultValue="">
                <option value="">— Fleet-wide —</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="issueDate">Date issued</Label>
              <Input id="issueDate" name="issueDate" type="date" required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="dateReceived">Date received</Label>
              <Input id="dateReceived" name="dateReceived" type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">Content</Label>
            <AutoGrowInput
              id="body"
              name="body"
              className="max-h-none"
              placeholder="Paste or type the circular's content here — this is what makes it searchable later, since search looks inside this text, not just the title."
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="files">Attachment(s)</Label>
            <p className="text-xs text-muted-foreground">
              Attach the actual circular document (PDF, Word, image, etc.) — required for every circular.
            </p>
            <input
              id="files"
              type="file"
              name="files"
              multiple
              required
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.zip"
              className="w-full max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
            />
          </div>

          {officeUsers.length > 0 && (
            <div className="space-y-1.5">
              <Label>Also track acknowledgement from</Label>
              <p className="text-xs text-muted-foreground">
                Every targeted vessel is tracked automatically. Tick anyone in the office (e.g. the Superintendent) who must acknowledge this individually.
              </p>
              <div className="grid grid-cols-1 gap-1.5 rounded-md border border-border p-3 sm:grid-cols-2">
                {officeUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="notifyUserIds" value={u.id} className="h-4 w-4" />
                    {u.fullName} <span className="text-xs text-muted-foreground">— {humanize(u.department)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/circulars"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
