"use client";

import { Save, CheckCircle2, Lock, Unlock } from "lucide-react";

export type ReviewInfo = { submitted: boolean; lastEditor: string | null; at: string | null };

const fmtWhen = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function WorksheetActions({
  review, isAdmin, pending, onSaveDraft, onSubmit, onReopen, onCancel,
}: {
  review: ReviewInfo;
  isAdmin: boolean;
  pending: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
  onReopen: () => void;
  onCancel: () => void;
}) {
  const editedBy = review.lastEditor ? `last updated by ${review.lastEditor}${review.at ? ` · ${fmtWhen(review.at)}` : ""}` : "";

  if (review.submitted) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/20">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Submitted for review
        </span>
        {editedBy && <span className="text-xs text-emerald-700/80 dark:text-emerald-300/80">{editedBy}</span>}
        <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Lock className="h-3.5 w-3.5" /> locked</span>
        <div className="ml-auto flex items-center gap-3">
          {isAdmin && (
            <button onClick={onReopen} disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Unlock className="h-3.5 w-3.5" /> {pending ? "…" : "Reopen for editing (Admin)"}
            </button>
          )}
          <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">Back to proposal</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button onClick={onSaveDraft} disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
        <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save & back to proposal"}
      </button>
      <button onClick={onSubmit} disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
        <CheckCircle2 className="h-4 w-4" /> {pending ? "…" : "Completed — Submit for Review"}
      </button>
      <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
      {editedBy && <span className="ml-auto text-xs text-slate-400">{editedBy}</span>}
    </div>
  );
}
