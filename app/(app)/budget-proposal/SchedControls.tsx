"use client";

import { useTransition } from "react";
import { updateScheduleField } from "./actions";

const base =
  "rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none disabled:opacity-50";

type Opt = { value: string; label: string };

export function SchedSelect({ id, field, value, options, className }: {
  id: string; field: string; value: string; options: Opt[]; className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={value}
      disabled={pending}
      onChange={(e) => start(() => updateScheduleField(id, field, e.target.value))}
      className={`${base} cursor-pointer ${className ?? ""}`}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function SchedDate({ id, field, value }: { id: string; field: string; value: string }) {
  const [pending, start] = useTransition();
  return (
    <input
      type="date"
      defaultValue={value}
      disabled={pending}
      onChange={(e) => start(() => updateScheduleField(id, field, e.target.value))}
      className={`${base} w-[8.5rem]`}
    />
  );
}

export function SchedText({ id, field, value, placeholder }: {
  id: string; field: string; value: string; placeholder?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <input
      type="text"
      defaultValue={value}
      disabled={pending}
      placeholder={placeholder}
      onBlur={(e) => { if (e.target.value !== value) start(() => updateScheduleField(id, field, e.target.value)); }}
      className={`${base} w-32`}
    />
  );
}
