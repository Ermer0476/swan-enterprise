"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Send, CheckCircle2, FileText, RefreshCw } from "lucide-react";
import { submitToOwners, approveByOwners } from "../actions";

type Owner = { stage: string | null; submittedBy: string | null; submittedAt: string | null; approvedBy: string | null; approvedAt: string | null };
type Props = { vesselId: string; vesselName: string; year: number; owner: Owner; hasBudget: boolean; allSubmitted: boolean; reportHref: string };

const fmtDate = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };

export default function OwnerFlowBar({ vesselId, vesselName, year, owner, hasBudget, allSubmitted, reportHref }: Props) {
  const [pending, start] = useTransition();
  const stage = owner.stage;

  const submit = () => {
    const msg = stage === "for_review"
      ? `Re-submit ${vesselName}'s FY ${year} proposal to owners (after your edits)?`
      : `Submit ${vesselName}'s FY ${year} proposal to owners for review? It will appear in the repository as "For review by owners".`;
    if (!confirm(msg)) return;
    start(async () => { await submitToOwners(vesselId, year); });
  };
  const approve = () => {
    if (!confirm(`Owner approved ${vesselName}'s FY ${year} budget? It will be marked "Approved by owners" in the repository.`)) return;
    start(async () => { await approveByOwners(vesselId, year); });
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Current stage line */}
      <div className="mb-3 text-sm">
        {stage === "approved" ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Approved by owners{owner.approvedBy ? ` · ${owner.approvedBy}` : ""}{owner.approvedAt ? ` · ${fmtDate(owner.approvedAt)}` : ""}</span>
        ) : stage === "for_review" ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-violet-700 dark:text-violet-300"><Send className="h-4 w-4" /> For review by owners{owner.submittedBy ? ` · sent by ${owner.submittedBy}` : ""}{owner.submittedAt ? ` · ${fmtDate(owner.submittedAt)}` : ""}</span>
        ) : (
          <span className="text-slate-500">Draft — not yet submitted to owners. Budget proposals live here only; the OPEX Controller is fed by your OPEX data uploads.</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Stage 1: Submit / Re-submit to owners */}
        {stage !== "approved" && (
          <button onClick={submit} disabled={pending || !hasBudget}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50">
            {stage === "for_review" ? <RefreshCw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {pending ? "Working…" : stage === "for_review" ? "Re-submit to owners" : "Submit to owners"}
          </button>
        )}

        {/* The owner report (PDF) — available once submitted */}
        {stage && (
          <Link href={reportHref} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            <FileText className="h-4 w-4" /> Open owner report (PDF)
          </Link>
        )}

        {/* Stage 2: Approved by owners (only after it's been sent) */}
        {stage === "for_review" && (
          <button onClick={approve} disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Approved by owners
          </button>
        )}
      </div>

      {!hasBudget && stage !== "approved" && <p className="mt-2 text-xs text-slate-400">Build at least one category before submitting to owners.</p>}
      {hasBudget && !allSubmitted && !stage && <p className="mt-2 text-xs text-amber-600">Some categories are still Open (not submitted). You can still send, but finish them for a complete proposal.</p>}
      {stage === "for_review" && <p className="mt-2 text-xs text-slate-400">Owner has a counter-proposal? Re-open a category above, edit, then <span className="font-medium">Re-submit to owners</span>. When they sign off, hit <span className="font-medium">Approved by owners</span>.</p>}
    </div>
  );
}
