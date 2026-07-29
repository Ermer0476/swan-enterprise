"use client";

import { useActionState, useRef, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";
import {
  addStepAction,
  removeStepAction,
  moveStepAction,
  toggleActiveAction,
  type ActionResult,
} from "@/features/workflow/admin-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AutoGrowInput, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type StepView = {
  id: string;
  order: number;
  name: string;
  approverType: "ROLE" | "DEPARTMENT" | "SPECIFIC_USER";
  approverRole: string | null;
  approverDept: string | null;
};

export type DefinitionView = {
  id: string;
  name: string;
  key: string;
  entityType: string;
  active: boolean;
  steps: StepView[];
};

function approverLabel(s: StepView): string {
  if (s.approverType === "ROLE") return `Role · ${s.approverRole ?? "—"}`;
  if (s.approverType === "DEPARTMENT") return `Dept · ${s.approverDept ?? "—"}`;
  return "Specific user";
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add step"}
    </Button>
  );
}

export function WorkflowEditor({
  definition,
  roleNames,
  departments,
}: {
  definition: DefinitionView;
  roleNames: string[];
  departments: readonly string[];
}) {
  const [pending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);
  const [approverType, setApproverType] = useState<"ROLE" | "DEPARTMENT">("ROLE");

  const [addState, addFormAction] = useActionState<ActionResult, FormData>(
    addStepAction,
    { ok: false, error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (addState.ok) formRef.current?.reset();
  }, [addState.ok]);

  function rowAction(
    action: (fd: FormData) => Promise<ActionResult>,
    fields: Record<string, string>,
  ) {
    setRowError(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) setRowError(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            {definition.name}
            <Badge tone={definition.active ? "success" : "neutral"}>
              {definition.active ? "Active" : "Inactive"}
            </Badge>
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Governs <code className="font-mono">{definition.entityType}</code> ·
            key <code className="font-mono">{definition.key}</code>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            rowAction(toggleActiveAction, { definitionId: definition.id })
          }
        >
          {definition.active ? "Deactivate" : "Activate"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Steps */}
        {definition.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No steps yet — add the first approval step below.
          </p>
        ) : (
          <ol className="divide-y divide-border rounded-md border border-border">
            {definition.steps.map((s, i) => (
              <li
                key={s.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="w-5 text-center font-mono text-xs text-muted-foreground">
                  {s.order}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {approverLabel(s)}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={pending || i === 0}
                  onClick={() =>
                    rowAction(moveStepAction, {
                      stepId: s.id,
                      direction: "up",
                    })
                  }
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={pending || i === definition.steps.length - 1}
                  onClick={() =>
                    rowAction(moveStepAction, {
                      stepId: s.id,
                      direction: "down",
                    })
                  }
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Remove step"
                  disabled={pending}
                  onClick={() =>
                    rowAction(removeStepAction, { stepId: s.id })
                  }
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-danger disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
        {rowError && <p className="text-sm text-danger">{rowError}</p>}

        {/* Add step */}
        <form
          ref={formRef}
          action={addFormAction}
          className="grid grid-cols-1 items-end gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[1fr_auto_1fr_auto]"
        >
          <input type="hidden" name="definitionId" value={definition.id} />
          <div className="space-y-1">
            <Label htmlFor={`name-${definition.id}`}>Step name</Label>
            <AutoGrowInput
              id={`name-${definition.id}`}
              name="name"
              placeholder="e.g. Technical Review"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`type-${definition.id}`}>Approver</Label>
            <Select
              id={`type-${definition.id}`}
              name="approverType"
              value={approverType}
              onChange={(e) =>
                setApproverType(e.target.value as "ROLE" | "DEPARTMENT")
              }
            >
              <option value="ROLE">By role</option>
              <option value="DEPARTMENT">By department</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{approverType === "ROLE" ? "Role" : "Department"}</Label>
            {approverType === "ROLE" ? (
              <Select name="approverRole" defaultValue={roleNames[0] ?? ""}>
                {roleNames.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            ) : (
              <Select name="approverDept" defaultValue={departments[0] ?? ""}>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <AddButton />
          {addState.error && (
            <p className="text-sm text-danger sm:col-span-4">
              {addState.error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
