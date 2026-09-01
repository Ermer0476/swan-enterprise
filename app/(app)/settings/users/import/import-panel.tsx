"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  parseUserImportAction,
  commitUserImportAction,
  type ParseUserImportResult,
  type CommitUserImportResult,
  type UserImportOutcome,
} from "@/features/users/masterlist-import-actions";
import type { ParsedUserRow } from "@/features/users/masterlist-import-parser";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PARSE_INITIAL: ParseUserImportResult = {
  ok: false,
  error: null,
  rows: [],
  flagged: [],
  counts: { total: 0, parsed: 0, flagged: 0 },
};
const COMMIT_INITIAL: CommitUserImportResult = {
  ok: false,
  error: null,
  created: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  results: [],
};

type ReviewRow = ParsedUserRow & { included: boolean };

const OUTCOME_TONE: Record<UserImportOutcome, "success" | "accent" | "neutral" | "danger"> = {
  created: "success",
  updated: "accent",
  skipped: "neutral",
  error: "danger",
};

function dash(v: string | null): string {
  return v && v.trim() ? v : "—";
}

export function ImportPanel() {
  const [parseState, parseAction, parsing] = useActionState(parseUserImportAction, PARSE_INITIAL);
  const [commitState, commitAction, committing] = useActionState(commitUserImportAction, COMMIT_INITIAL);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);

  useEffect(() => {
    if (parseState.ok) setRows(parseState.rows.map((r) => ({ ...r, included: true })));
  }, [parseState]);

  const includedRows = useMemo(() => (rows ?? []).filter((r) => r.included), [rows]);

  function toggle(rowNo: number) {
    setRows((prev) => (prev ? prev.map((r) => (r.rowNo === rowNo ? { ...r, included: !r.included } : r)) : prev));
  }

  function submitCommit() {
    if (includedRows.length === 0) return;
    const fd = new FormData();
    fd.set("rows", JSON.stringify(includedRows.map(({ included: _included, ...rest }) => rest)));
    commitAction(fd);
  }

  // ── Result summary ─────────────────────────────────────────────────────────
  if (commitState.ok) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="text-sm font-semibold">Import complete</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="success">{commitState.created} created</Badge>
              <Badge tone="accent">{commitState.updated} updated</Badge>
              <Badge tone="neutral">{commitState.skipped} skipped</Badge>
              {commitState.errors > 0 && <Badge tone="danger">{commitState.errors} error(s)</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 text-sm font-semibold">Per-row result ({commitState.results.length})</div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-16 px-3 py-2 font-medium">Row</th>
                    <th className="w-40 px-3 py-2 font-medium">Employee ID</th>
                    <th className="w-28 px-3 py-2 font-medium">Outcome</th>
                    <th className="px-3 py-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {commitState.results.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 align-top text-muted-foreground">{r.rowNo}</td>
                      <td className="px-3 py-2 align-top font-mono text-xs">{dash(r.employeeId)}</td>
                      <td className="px-3 py-2 align-top">
                        <Badge tone={OUTCOME_TONE[r.outcome]}>{r.outcome}</Badge>
                      </td>
                      <td className="px-3 py-2 align-top text-muted-foreground">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <a href="/settings/users">
            <Button variant="outline">Back to Users</Button>
          </a>
          <button
            type="button"
            onClick={() => {
              setRows(null);
              window.location.reload();
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Import another file
          </button>
        </div>
      </div>
    );
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  if (!rows) {
    return (
      <Card>
        <CardContent className="pt-5">
          <form action={parseAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="file">Masterlist file (.xlsx, .xls or .xlsm)</Label>
              <input
                id="file"
                name="file"
                type="file"
                accept=".xlsx,.xls,.xlsm"
                required
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Looks for a header row with LAST, FIRST and EMPLOYEE ID columns (extra or reordered columns are fine). AGE and Years of Service are
              recomputed from the dates, never imported. You&apos;ll review every row before anything is written.
            </p>
            <Button type="submit" disabled={parsing}>
              {parsing ? "Reading file…" : "Parse file"}
            </Button>
            {parseState.error && <p className="text-sm text-danger">{parseState.error}</p>}
          </form>
        </CardContent>
      </Card>
    );
  }

  // ── Review ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 pt-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="accent">{rows.length} row{rows.length === 1 ? "" : "s"} parsed</Badge>
            <Badge tone="neutral">{includedRows.length} to import</Badge>
            {parseState.flagged.length > 0 && <Badge tone="warning">{parseState.flagged.length} need review</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            Rows are matched to existing accounts by Employee ID on save — a match updates its masterlist fields, a new ID with an email creates a
            guest account. A row with no Employee ID, or a new one with no email, is skipped.
          </p>
          {commitState.error && <p className="text-sm text-danger">{commitState.error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 text-sm font-semibold">
            Review parsed rows ({includedRows.length} of {rows.length} included)
          </div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-12 px-2 py-2 font-medium">Row</th>
                  <th className="w-36 px-2 py-2 font-medium">Employee ID</th>
                  <th className="px-2 py-2 font-medium">Last</th>
                  <th className="px-2 py-2 font-medium">First</th>
                  <th className="px-2 py-2 font-medium">Designation</th>
                  <th className="w-28 px-2 py-2 font-medium">Birth Date</th>
                  <th className="w-28 px-2 py-2 font-medium">Date Hired</th>
                  <th className="px-2 py-2 font-medium">Email</th>
                  <th className="w-16 px-2 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowNo} className={`border-b border-border last:border-0 ${r.included ? "" : "opacity-40"}`}>
                    <td className="px-2 py-2 align-top text-muted-foreground">{r.rowNo}</td>
                    <td className="px-2 py-2 align-top font-mono text-xs">{dash(r.employeeId)}</td>
                    <td className="px-2 py-2 align-top">{dash(r.lastName)}</td>
                    <td className="px-2 py-2 align-top">{dash(r.firstName)}</td>
                    <td className="px-2 py-2 align-top">{dash(r.designation)}</td>
                    <td className="px-2 py-2 align-top">{dash(r.birthDate)}</td>
                    <td className="px-2 py-2 align-top">{dash(r.dateHired)}</td>
                    <td className="px-2 py-2 align-top">{dash(r.email)}</td>
                    <td className="px-2 py-2 align-top text-right">
                      <button
                        type="button"
                        onClick={() => toggle(r.rowNo)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {r.included ? "Remove" : "Undo"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {parseState.flagged.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 text-sm font-semibold text-warning">Needs manual review ({parseState.flagged.length})</div>
            <p className="mb-3 text-xs text-muted-foreground">
              These rows could not be tied to a person (no name, employee ID or email) and were not included above. Add them by hand afterward if
              they are real records.
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {parseState.flagged.map((f, i) => (
                <div key={i} className="rounded-md border border-border p-2 text-xs">
                  <span className="text-muted-foreground">Row {f.rowNo} — {f.reason}:</span>{" "}
                  <span className="font-mono">{f.rawText}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={submitCommit} disabled={committing || includedRows.length === 0}>
          {committing ? "Importing…" : `Import ${includedRows.length} row${includedRows.length === 1 ? "" : "s"}`}
        </Button>
        <button
          type="button"
          onClick={() => setRows(null)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
