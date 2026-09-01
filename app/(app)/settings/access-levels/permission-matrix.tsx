"use client";

import { useMemo, useState, useTransition } from "react";
import { Lock } from "lucide-react";
import {
  PERMISSIONS,
  ALL_PERMISSION_KEYS,
  permissionModule,
  type PermissionKey,
} from "@/lib/permissions";
import { saveAccessLevelPermissionsAction } from "@/features/access-levels/actions";
import { Button } from "@/components/ui/button";

type Column = { id: string; name: string; rank: number; keys: string[] };
type Ceiling = { rank: number | null; keys: string[] };

// Catalog keys grouped by module, in catalog order — the grid's row groups.
const MODULE_GROUPS: { module: string; keys: PermissionKey[] }[] = (() => {
  const order: string[] = [];
  const byModule = new Map<string, PermissionKey[]>();
  for (const k of ALL_PERMISSION_KEYS) {
    const m = permissionModule(k);
    const bucket = byModule.get(m);
    if (bucket) {
      bucket.push(k);
    } else {
      byModule.set(m, [k]);
      order.push(m);
    }
  }
  return order.map((m) => ({ module: m, keys: byModule.get(m) ?? [] }));
})();

const cellKey = (levelId: string, key: string) => `${levelId}::${key}`;

/**
 * The grant-only permission matrix. Rows are catalog permission keys grouped by
 * module; columns are the active access levels. A cell is DISABLED (not hidden),
 * mirroring the server's no-escalation refusals exactly, when either:
 *   - the column's level is ranked ABOVE the actor's own level (rank guard), or
 *   - the row's key is NOT in the actor's own effective permission set (ceiling).
 * The actor edits only the cells they control; each column saves on its own, and
 * the server preserves any out-of-ceiling grants the actor can't see.
 */
export function PermissionMatrix({
  columns,
  ceiling,
}: {
  columns: Column[];
  ceiling: Ceiling;
}) {
  const ceilingSet = useMemo(() => new Set(ceiling.keys), [ceiling.keys]);

  // Which (level, key) cells are checked — seeded from the current grants.
  const initial = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const col of columns) {
      for (const k of col.keys) map[cellKey(col.id, k)] = true;
    }
    return map;
  }, [columns]);

  const [checked, setChecked] = useState<Record<string, boolean>>(initial);
  const [status, setStatus] = useState<Record<string, { ok: boolean; msg: string } | undefined>>({});
  const [pending, startSave] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  const columnLocked = (col: Column) => ceiling.rank !== null && col.rank > ceiling.rank;
  const rowLocked = (key: string) => !ceilingSet.has(key);

  function toggle(levelId: string, key: string) {
    const id = cellKey(levelId, key);
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
    setStatus((prev) => ({ ...prev, [levelId]: undefined }));
  }

  // The controllable, checked keys for a column — exactly what gets submitted.
  // Out-of-ceiling keys are never submitted (the server would reject them and
  // preserves them itself).
  function submittedKeys(col: Column): string[] {
    return ALL_PERMISSION_KEYS.filter(
      (k) => ceilingSet.has(k) && checked[cellKey(col.id, k)],
    );
  }

  // A column is dirty when its controllable checked set differs from the initial.
  function isDirty(col: Column): boolean {
    for (const k of ALL_PERMISSION_KEYS) {
      if (!ceilingSet.has(k)) continue;
      const id = cellKey(col.id, k);
      if (Boolean(checked[id]) !== Boolean(initial[id])) return true;
    }
    return false;
  }

  function save(col: Column) {
    const fd = new FormData();
    fd.set("accessLevelId", col.id);
    for (const k of submittedKeys(col)) fd.append("permissionKeys", k);
    setSavingId(col.id);
    startSave(async () => {
      const res = await saveAccessLevelPermissionsAction(fd);
      setSavingId(null);
      if (res.ok) {
        // Rebase the initial snapshot for this column so it reads clean.
        setStatus((prev) => ({ ...prev, [col.id]: { ok: true, msg: "Saved" } }));
        for (const k of ALL_PERMISSION_KEYS) {
          if (ceilingSet.has(k)) initial[cellKey(col.id, k)] = Boolean(checked[cellKey(col.id, k)]);
        }
      } else {
        setStatus((prev) => ({ ...prev, [col.id]: { ok: false, msg: res.error ?? "Save failed" } }));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3" /> Disabled cells are outside what you can grant — a level above
          your own, or a permission your own access level doesn&apos;t hold.
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-muted/40">
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Permission</th>
              {columns.map((col) => (
                <th key={col.id} className="px-3 py-2.5 text-center font-medium">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="normal-case text-foreground">{col.name}</span>
                    <span className="tabular-nums">rank {col.rank}</span>
                    {columnLocked(col) && <Lock className="h-3 w-3" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULE_GROUPS.map((group) => (
              <ModuleRows
                key={group.module}
                module={group.module}
                keys={group.keys}
                columns={columns}
                checked={checked}
                columnLocked={columnLocked}
                rowLocked={rowLocked}
                onToggle={toggle}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/20">
              <td className="px-4 py-3 text-xs text-muted-foreground">Save each level&apos;s changes</td>
              {columns.map((col) => {
                const locked = columnLocked(col);
                const dirty = isDirty(col);
                const st = status[col.id];
                return (
                  <td key={col.id} className="px-3 py-3 text-center align-top">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={locked || !dirty || (pending && savingId === col.id)}
                      onClick={() => save(col)}
                    >
                      {pending && savingId === col.id ? "Saving…" : "Save"}
                    </Button>
                    {st && (
                      <p className={`mt-1 text-xs ${st.ok ? "text-success" : "text-danger"}`}>{st.msg}</p>
                    )}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ModuleRows({
  module,
  keys,
  columns,
  checked,
  columnLocked,
  rowLocked,
  onToggle,
}: {
  module: string;
  keys: PermissionKey[];
  columns: Column[];
  checked: Record<string, boolean>;
  columnLocked: (col: Column) => boolean;
  rowLocked: (key: string) => boolean;
  onToggle: (levelId: string, key: string) => void;
}) {
  return (
    <>
      <tr className="border-b border-border bg-muted/30">
        <td colSpan={columns.length + 1} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {module}
        </td>
      </tr>
      {keys.map((key) => (
        <tr key={key} className="border-b border-border last:border-0 hover:bg-muted/20">
          <td className="px-4 py-2">
            <div className="font-mono text-xs text-foreground">{key}</div>
            <div className="text-xs text-muted-foreground">{PERMISSIONS[key]}</div>
          </td>
          {columns.map((col) => {
            const disabled = columnLocked(col) || rowLocked(key);
            const id = cellKey(col.id, key);
            return (
              <td key={col.id} className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                  checked={Boolean(checked[id])}
                  disabled={disabled}
                  onChange={() => onToggle(col.id, key)}
                  aria-label={`${key} for ${col.name}`}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
