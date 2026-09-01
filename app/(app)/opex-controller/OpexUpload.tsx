"use client";

import { useActionState } from "react";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { uploadOpexExcel, type OpexUploadResult } from "./actions";

export default function OpexUpload({ year }: { year: string }) {
  const [state, action, pending] = useActionState<OpexUploadResult | null, FormData>(uploadOpexExcel, null);

  // Gate the import behind a year-confirmation — the #1 upload mistake is tagging
  // a file with the wrong year, which silently creates a duplicate under FY-XXXX.
  function confirmYear(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const y = (form.elements.namedItem("year") as HTMLSelectElement)?.value ?? "";
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const fname = fileInput?.files?.[0]?.name ?? "this file";
    if (!confirm(`Import "${fname}" into FISCAL YEAR ${y}?\n\nMake sure ${y} is the correct year — importing under the wrong year creates a duplicate.`)) {
      e.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={confirmYear} className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 shadow-sm">
      <Upload className="h-5 w-5 shrink-0 text-sky-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700">Upload OPEX report</p>
        <p className="text-[11px] text-slate-400">Swan &quot;OPEX Reporting&quot; (one vessel) or &quot;Summary of Operating Expenses&quot; (one sheet per vessel). Re-uploading overwrites.</p>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-slate-500">
        Year
        <select
          name="year"
          defaultValue={year}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
        >
          {Array.from({ length: 11 }, (_, i) => String(2020 + i)).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>
      <input
        type="file"
        name="file"
        accept=".xls,.xlsx"
        required
        className="max-w-[200px] text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {pending ? "Importing…" : "Import"}
      </button>
      {state && (
        <p className={`flex w-full items-center gap-1.5 text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>
          {state.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {state.message}
        </p>
      )}
    </form>
  );
}
