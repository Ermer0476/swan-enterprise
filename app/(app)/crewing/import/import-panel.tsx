"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  parseCrewManifestAction,
  commitCrewManifestAction,
  type ParseCrewManifestResult,
  type CommitCrewManifestResult,
  type CrewImportOutcome,
  type VesselOption,
} from "@/features/crewing/manifest-import-actions";
import type { ParsedManifestRow } from "@/features/crewing/manifest-import-parser";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PARSE_INITIAL: ParseCrewManifestResult = {
  ok: false,
  error: null,
  vesselName: null,
  suggestedVesselId: null,
  vessels: [],
  rows: [],
  flagged: [],
  counts: { total: 0, parsed: 0, flagged: 0 },
};
const COMMIT_INITIAL: CommitCrewManifestResult = {
  ok: false,
  error: null,
  vesselLabel: null,
  created: 0,
  embarked: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  results: [],
};

type ReviewRow = ParsedManifestRow & { included: boolean };

const OUTCOME_TONE: Record<CrewImportOutcome, "success" | "accent" | "neutral" | "danger"> = {
  created: "success",
  embarked: "success",
  updated: "accent",
  skipped: "neutral",
  error: "danger",
};

function dash(v: string | null): string {
  return v && v.trim() ? v : "—";
}

function vesselOptionLabel(v: VesselOption): string {
  return v.code ? `${v.name} (${v.code})` : v.name;
}

export function ImportPanel() {
  const [parseState, parseAction, parsing] = useActionState(parseCrewManifestAction, PARSE_INITIAL);
  const [commitState, commitAction, committing] = useActionState(commitCrewManifestAction, COMMIT_INITIAL);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [vesselId, setVesselId] = useState<string>("");

  useEffect(() => {
    if (parseState.ok) {
      setRows(parseState.rows.map((r) => ({ ...r, included: true })));
      setVesselId(parseState.suggestedVesselId ?? "");
    }
  }, [parseState]);

  const includedRows = useMemo(() => (rows ?? []).filter((r) => r.included), [rows]);

  function toggle(rowNo: number) {
    setRows((prev) => (prev ? prev.map((r) => (r.rowNo === rowNo ? { ...r, included: !r.included } : r)) : prev));
  }

  function submitCommit() {
    if (includedRows.length === 0 || !vesselId) return;
    const fd = new FormData();
    fd.set("vesselId", vesselId);
    fd.set("rows", JSON.stringify(includedRows.map(({ included: _included, ...rest }) => rest)));
    commitAction(fd);
  }

  // ── Result summary ─────────────────────────────────────────────────────────
  if (commitState.ok) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="text-sm font-semibold">
              Import complete{commitState.vesselLabel ? ` — ${commitState.vesselLabel}` : ""}
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="success">{commitState.created} created</Badge>
              <Badge tone="success">{commitState.embarked} embarked</Badge>
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
                    <th className="w-32 px-3 py-2 font-medium">Crew ID</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="w-28 px-3 py-2 font-medium">Outcome</th>
                    <th className="px-3 py-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {commitState.results.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 align-top text-muted-foreground">{r.rowNo}</td>
                      <td className="px-3 py-2 align-top font-mono text-xs">{dash(r.crewCode)}</td>
                      <td className="px-3 py-2 align-top">{r.name}</td>
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
          <a href="/crewing">
            <Button variant="outline">Back to Crewing</Button>
          </a>
          <button
            type="button"
            onClick={() => {
              setRows(null);
              window.location.reload();
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Import another manifest
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
              <Label htmlFor="file">Crew manifest file (.xlsx, .xls or .xlsm)</Label>
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
              Looks for a header row with CREW ID NO., CREW NAME, RANK, DATE EMBARKED and PORT OF EMBARKATION columns
              (extra or reordered columns are fine). Certificate columns (SIRB, passport, licence, STCW, due-off) are not
              imported. You&apos;ll confirm the vessel and review every row before anything is written.
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
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="accent">{rows.length} row{rows.length === 1 ? "" : "s"} parsed</Badge>
            <Badge tone="neutral">{includedRows.length} to import</Badge>
            {parseState.flagged.length > 0 && <Badge tone="warning">{parseState.flagged.length} need review</Badge>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vesselId">Vessel this manifest is for</Label>
            <Select
              id="vesselId"
              value={vesselId}
              onChange={(e) => setVesselId(e.target.value)}
              className="w-full max-w-md"
            >
              <option value="">Choose a vessel…</option>
              {parseState.vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {vesselOptionLabel(v)}
                </option>
              ))}
            </Select>
            {parseState.vesselName && (
              <p className="text-xs text-muted-foreground">
                The file names its vessel as <span className="font-medium">{parseState.vesselName}</span>.
                {parseState.suggestedVesselId
                  ? " Matched to the ship selected above — confirm or override it."
                  : " No single ship matched that name — choose the right one above."}
              </p>
            )}
            {!vesselId && <p className="text-sm text-danger">Choose the vessel before importing.</p>}
          </div>

          <p className="text-xs text-muted-foreground">
            Each man is matched by crew ID on save — a match reuses the existing seafarer, a new well-formed ID creates
            one — then embarked onto the vessel above. Someone already aboard this ship is left as is; already aboard a
            different ship is flagged for a manual transfer.
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
                  <th className="w-28 px-2 py-2 font-medium">Crew ID</th>
                  <th className="px-2 py-2 font-medium">Last</th>
                  <th className="px-2 py-2 font-medium">First</th>
                  <th className="px-2 py-2 font-medium">Middle</th>
                  <th className="px-2 py-2 font-medium">Rank</th>
                  <th className="w-28 px-2 py-2 font-medium">Embarked</th>
                  <th className="px-2 py-2 font-medium">Port</th>
                  <th className="w-16 px-2 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowNo} className={`border-b border-border last:border-0 ${r.included ? "" : "opacity-40"}`}>
                    <td className="px-2 py-2 align-top text-muted-foreground">{r.rowNo}</td>
                    <td className="px-2 py-2 align-top font-mono text-xs">{dash(r.crewCode)}</td>
                    <td className="px-2 py-2 align-top">{dash(r.lastName)}</td>
                    <td className="px-2 py-2 align-top">{dash(r.firstName)}</td>
                    <td className="px-2 py-2 align-top">{dash(r.middleName)}</td>
                    <td className="px-2 py-2 align-top">
                      {dash(r.rank)}
                      {r.rank && !r.rankCode && (
                        <span className="ml-1 text-xs text-warning" title="Rank kept as typed — not a standard code">
                          (raw)
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 align-top">{dash(r.dateEmbarked)}</td>
                    <td className="px-2 py-2 align-top">{dash(r.signOnPort)}</td>
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
              These rows could not be tied to a seafarer (no crew ID and no name) and were not included above. Add them by
              hand afterward if they are real records.
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {parseState.flagged.map((f, i) => (
                <div key={i} className="rounded-md border border-border p-2 text-xs">
                  <span className="text-muted-foreground">
                    Row {f.rowNo} — {f.reason}:
                  </span>{" "}
                  <span className="font-mono">{f.rawText}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={submitCommit} disabled={committing || includedRows.length === 0 || !vesselId}>
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
