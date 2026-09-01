"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Users } from "lucide-react";
import { saveCrewingParticulars } from "../../actions";

type ManningRow = { count: string; position: string };
type CrewData = { nationality: string; itf: string; manning: { count: number; position: string }[]; notes: string };
type Props = { vesselId: string; year: number; initial: CrewData; backHref: string };

// Notes textarea that grows with its content.
function AutoTextarea({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }, [value]);
  return <textarea ref={ref} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={className} style={{ resize: "none", overflow: "hidden" }} />;
}

export default function CrewingParticularsEditor({ vesselId, year, initial, backHref }: Props) {
  const router = useRouter();
  const [nationality, setNationality] = useState(initial.nationality ?? "");
  const [itf, setItf] = useState(initial.itf ?? "");
  const [manning, setManning] = useState<ManningRow[]>((initial.manning ?? []).map((m) => ({ count: String(m.count), position: m.position })));
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [pending, start] = useTransition();

  const totalCrew = useMemo(() => manning.reduce((s, m) => s + (parseInt(m.count, 10) || 0), 0), [manning]);

  const setRow = (i: number, k: keyof ManningRow, v: string) => setManning((prev) => prev.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addRow = () => setManning((prev) => [...prev, { count: "1", position: "" }]);
  const removeRow = (i: number) => {
    if (!confirm(`Remove "${manning[i]?.position || "this rank"}"?`)) return;
    setManning((prev) => prev.filter((_, idx) => idx !== i));
  };

  const save = () => start(async () => {
    await saveCrewingParticulars(vesselId, year, {
      nationality, itf,
      manning: manning.map((m) => ({ count: parseInt(m.count, 10) || 0, position: m.position })),
      notes,
    });
    router.push(backHref);
  });

  return (
    <div className="mt-4 space-y-5">
      {/* Header line: nationality + total crew + ITF */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Crew nationality</span>
            <input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. ALL FILIPINOS"
              className="w-52 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ITF / Union</span>
            <input value={itf} onChange={(e) => setItf(e.target.value)} placeholder="e.g. ITF"
              className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
          </label>
          <div className="ml-auto inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
            <Users className="h-4 w-4" /> Total crew: {totalCrew}
          </div>
        </div>
      </div>

      {/* Manning list */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-2.5 font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">Manning list</div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 p-3 sm:grid-cols-2">
          {manning.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <input inputMode="numeric" value={m.count} onChange={(e) => setRow(i, "count", e.target.value)}
                className="w-12 rounded-md border border-slate-300 px-2 py-1 text-center text-sm tabular-nums text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
              <input value={m.position} onChange={(e) => setRow(i, "position", e.target.value)} placeholder="rank / position"
                className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-sm text-slate-700 hover:border-slate-200 focus:border-sky-500 focus:outline-none dark:text-slate-200 dark:hover:border-slate-700" />
              <button onClick={() => removeRow(i)} title="Remove" className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="px-4 py-2">
          <button onClick={addRow} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-sky-600"><Plus className="h-3 w-3" /> Add rank</button>
        </div>
      </div>

      {/* Notes (default-filled, editable) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-1 font-semibold text-slate-800 dark:text-slate-100">Notes</div>
        <p className="mb-2 text-[11px] text-slate-400">Pre-filled with the standard crewing notes — edit freely (e.g. provisions rate, contract months, tariff year). Shown on the report&apos;s Particulars page.</p>
        <AutoTextarea value={notes} onChange={setNotes}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50">
          <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save & back to Crewing"}
        </button>
        <button onClick={() => router.push(backHref)} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
      </div>
    </div>
  );
}
