"use client";

import { useState } from "react";
import { X, Pencil } from "lucide-react";
import { SchedSelect, SchedDate, SchedText } from "./SchedControls";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_OPTS = [{ value: "", label: "—" }, ...MONTHS.map((m) => ({ value: m, label: m }))];
export type SchedEdit = {
  id: string; vesselName: string;
  submitToMgt: string; submitToOwners: string;
  contractFrom: string; contractTo: string; nextContractFrom: string; nextContractTo: string;
  bfa: string; remarks: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export default function ScheduleEditButton({ sched }: { sched: SchedEdit }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-sky-600 hover:underline">
        <Pencil className="h-3.5 w-3.5" /> Edit
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="mt-8 mb-8 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Edit schedule · {sched.vesselName}</h3>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Submit to Mgt"><SchedSelect id={sched.id} field="submitToMgt" value={sched.submitToMgt} options={MONTH_OPTS} /></Field>
              <Field label="Submit to Owners"><SchedSelect id={sched.id} field="submitToOwners" value={sched.submitToOwners} options={MONTH_OPTS} /></Field>
              <Field label="Contract From"><SchedDate id={sched.id} field="contractFrom" value={sched.contractFrom} /></Field>
              <Field label="Contract To"><SchedDate id={sched.id} field="contractTo" value={sched.contractTo} /></Field>
              <Field label="Next Contract From"><SchedDate id={sched.id} field="nextContractFrom" value={sched.nextContractFrom} /></Field>
              <Field label="Next Contract To"><SchedDate id={sched.id} field="nextContractTo" value={sched.nextContractTo} /></Field>
              <Field label="BFA"><SchedText id={sched.id} field="bfa" value={sched.bfa} placeholder="—" /></Field>
              <Field label="Remarks"><SchedText id={sched.id} field="remarks" value={sched.remarks} placeholder="—" /></Field>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[11px] text-slate-400">Changes save automatically.</p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
