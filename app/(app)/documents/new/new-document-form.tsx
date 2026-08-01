"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createDocumentAction,
  type ActionResult,
} from "@/features/documents/actions";
import { DOCUMENT_CATEGORIES } from "@/features/documents/schema";
import { humanize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Add Document"}
    </Button>
  );
}

export function NewDocumentForm({
  vessels,
}: {
  vessels: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createDocumentAction,
    { ok: false, error: null },
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <AutoGrowInput id="title" name="title" placeholder="Document title" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select id="category" name="category" defaultValue="FORM">
                {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vesselId">Vessel</Label>
              <Select id="vesselId" name="vesselId" defaultValue="">
                <option value="">— Fleet-wide —</option>
                {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="version">Version</Label>
              <AutoGrowInput id="version" name="version" placeholder="e.g. Rev 3" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="issueDate">Issue date</Label>
              <Input id="issueDate" name="issueDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reviewDate">Review date</Label>
              <Input id="reviewDate" name="reviewDate" type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="owner">Owner / issuing department</Label>
            <AutoGrowInput id="owner" name="owner" placeholder="e.g. QHSE Department" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <AutoGrowInput id="description" name="description" placeholder="Purpose / scope of this document…" />
          </div>

          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/documents"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
