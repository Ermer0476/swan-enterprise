"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  saveAccessLevelAction,
  toggleAccessLevelActiveAction,
  type ActionResult,
} from "@/features/access-levels/actions";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const INITIAL: ActionResult = { ok: false, error: null };

export type LevelRowView = {
  id: string;
  name: string;
  rank: number;
  description: string | null;
  isSystem: boolean;
  active: boolean;
  userCount: number;
};

function LevelRow({ level }: { level: LevelRowView }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(saveAccessLevelAction, INITIAL);
  const [togglePending, startToggle] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  function toggleActive() {
    setToggleError(null);
    const fd = new FormData();
    fd.set("accessLevelId", level.id);
    startToggle(async () => {
      const res = await toggleAccessLevelActiveAction(fd);
      if (!res.ok) setToggleError(res.error);
    });
  }

  if (editing) {
    return (
      <tr className="border-b border-border last:border-0 bg-primary/[0.03]">
        <td colSpan={6} className="px-4 py-3">
          <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-start">
            <input type="hidden" name="accessLevelId" value={level.id} />
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input name="name" defaultValue={level.name} className="h-8" />
              {state.fieldErrors?.name && <p className="text-xs text-danger">{state.fieldErrors.name}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rank</Label>
              <Input name="rank" type="number" step="1" defaultValue={level.rank} className="h-8" />
              {state.fieldErrors?.rank && <p className="text-xs text-danger">{state.fieldErrors.rank}</p>}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Input name="description" defaultValue={level.description ?? ""} className="h-8" />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
            {state.error && <p className="text-sm text-danger sm:col-span-4" role="alert">{state.error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30">
      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{level.rank}</td>
      <td className="px-4 py-2.5">
        <span className="font-medium">{level.name}</span>
        {level.isSystem && <Badge tone="neutral" className="ml-2 align-middle">System</Badge>}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">{level.description || "—"}</td>
      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{level.userCount}</td>
      <td className="px-4 py-2.5">
        <Badge tone={level.active ? "success" : "neutral"}>{level.active ? "Active" : "Deactivated"}</Badge>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3 text-xs">
          {level.active && (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-accent hover:underline">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
          {/* A system level can't be deactivated; while active it shows no
              deactivate control. Once deactivated (only non-system rows can be)
              it can always be reactivated. */}
          {(!level.active || !level.isSystem) && (
            <button
              type="button"
              onClick={toggleActive}
              disabled={togglePending}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {level.active ? "Deactivate" : "Reactivate"}
            </button>
          )}
        </div>
        {toggleError && <p className="mt-1 text-xs text-danger" role="alert">{toggleError}</p>}
      </td>
    </tr>
  );
}

function AddLevelForm() {
  const [expanded, setExpanded] = useState(false);
  const [state, action, pending] = useActionState(saveAccessLevelAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
        <Plus className="h-4 w-4" /> Add access level
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="mb-4 space-y-2 rounded-md border border-dashed border-border p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input name="name" placeholder="e.g. Auditor" autoComplete="off" className="h-8" />
          {state.fieldErrors?.name && <p className="text-xs text-danger">{state.fieldErrors.name}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rank</Label>
          <Input name="rank" type="number" step="1" defaultValue={0} className="h-8" />
          {state.fieldErrors?.rank && <p className="text-xs text-danger">{state.fieldErrors.rank}</p>}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Description</Label>
          <Input name="description" placeholder="What this level is for" autoComplete="off" className="h-8" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Higher rank = more privilege. Superadmin is 100; gaps leave room to slot a level between two existing ones.</p>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add access level"}
        </Button>
        <button type="button" onClick={() => setExpanded(false)} className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function AccessLevelsPanel({ rows }: { rows: LevelRowView[] }) {
  return (
    <div>
      <AddLevelForm />
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Rank</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium">Users</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No access levels yet.
                </td>
              </tr>
            ) : (
              rows.map((l) => <LevelRow key={l.id} level={l} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
