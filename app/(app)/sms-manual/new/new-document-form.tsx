"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createDocumentAction,
  type ActionResult,
} from "@/features/sms-manual/actions";
import { DEPARTMENTS } from "@/features/sms-manual/schema";
import { Card, CardContent } from "@/components/ui/card";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create document"}
    </Button>
  );
}

export function NewDocumentForm() {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createDocumentAction,
    { ok: false, error: null },
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Document code</Label>
              <AutoGrowInput id="code" name="code" placeholder="ADM-10" required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <AutoGrowInput
                id="title"
                name="title"
                placeholder="Management Review Procedure"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <AutoGrowInput
                id="category"
                name="category"
                placeholder="Administration"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Select id="department" name="department" defaultValue="MARINE">
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <AutoGrowInput
              id="description"
              name="description"
              placeholder="Short summary of the document's purpose"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content">Content (revision 1)</Label>
            <AutoGrowInput
              id="content"
              name="content"
              placeholder="Procedure text (Markdown supported)…"
            />
          </div>

          {state.error && (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <SubmitButton />
            <Link href="/sms-manual">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
