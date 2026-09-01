"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { createEvent, updateEvent, deleteEvent, type EventForm } from "./actions";

export type CalEvent = {
  id?: string;
  title: string;
  sub?: string;
  type: "action" | "smc" | "smc-done" | "drydock" | "review" | "custom";
  color?: string;
  href?: string;
  startAt: string; // ISO
  endAt: string; // ISO
  allDay: boolean;
};

const TYPE_COLOR: Record<string, string> = { action: "amber", smc: "red", "smc-done": "emerald", drydock: "indigo", review: "sky" };
const COLOR: Record<string, { dot: string; bar: string }> = {
  sky: { dot: "bg-sky-500", bar: "bg-sky-500 text-white hover:bg-sky-600" },
  amber: { dot: "bg-amber-500", bar: "bg-amber-500 text-white hover:bg-amber-600" },
  red: { dot: "bg-red-500", bar: "bg-red-500 text-white hover:bg-red-600" },
  emerald: { dot: "bg-emerald-500", bar: "bg-emerald-500 text-white hover:bg-emerald-600" },
  indigo: { dot: "bg-indigo-500", bar: "bg-indigo-500 text-white hover:bg-indigo-600" },
  purple: { dot: "bg-purple-500", bar: "bg-purple-500 text-white hover:bg-purple-600" },
};
const FALLBACK_COLOR = { dot: "bg-sky-500", bar: "bg-sky-500 text-white hover:bg-sky-600" };
const colorKey = (e: CalEvent) => (e.type === "custom" ? e.color : TYPE_COLOR[e.type]) ?? "sky";
const colorOf = (e: CalEvent) => COLOR[colorKey(e)] ?? FALLBACK_COLOR;

const LEGEND: [string, string][] = [
  ["amber", "Corrective action due"], ["red", "SMC review due"], ["emerald", "SMC review held"], ["indigo", "Drydock due"], ["sky", "Custom event"],
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayDiff = (a: Date, b: Date) => Math.round((dateOnly(b).getTime() - dateOnly(a).getTime()) / 86400000);

const HEADER = 30; // px reserved for the day number
const LANE = 22; // px per event lane
const MAX_LANES = 3; // visible event rows per day before collapsing to "+N more"

type Seg = { e: CalEvent; startCol: number; endCol: number; startsHere: boolean; lane: number };

export default function CalendarView({ events, initialYear, initialMonth }: { events: CalEvent[]; initialYear: number; initialMonth: number }) {
  const [cur, setCur] = useState({ y: initialYear, m: initialMonth });
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [color, setColor] = useState("sky");
  const [note, setNote] = useState("");

  const openAdd = (dateStr: string) => {
    setEditId(null); setTitle(""); setAllDay(true); setStartDate(dateStr); setEndDate(dateStr);
    setStartTime("09:00"); setEndTime("10:00"); setColor("sky"); setNote(""); setOpen(true);
  };
  const openEdit = (e: CalEvent) => {
    const s = new Date(e.startAt), en = new Date(e.endAt);
    setEditId(e.id ?? null); setTitle(e.title); setAllDay(e.allDay);
    setStartDate(toDateStr(s)); setEndDate(toDateStr(en)); setStartTime(toTimeStr(s)); setEndTime(toTimeStr(en));
    setColor(e.color ?? "sky"); setNote(e.sub ?? ""); setOpen(true);
  };
  const save = () => {
    const form: EventForm = { title, allDay, startDate, startTime, endDate, endTime, color, note };
    start(async () => { if (editId) await updateEvent(editId, form); else await createEvent(form); setOpen(false); });
  };
  const del = () => {
    if (!editId || !confirm("Delete this event?")) return;
    start(async () => { await deleteEvent(editId); setOpen(false); });
  };

  // 6 weeks of 7 days.
  const weeks = useMemo(() => {
    const first = new Date(cur.y, cur.m, 1);
    const startCell = new Date(cur.y, cur.m, 1 - first.getDay());
    const all = Array.from({ length: 42 }, (_, i) => { const d = new Date(startCell); d.setDate(startCell.getDate() + i); return d; });
    return [0, 1, 2, 3, 4, 5].map((w) => all.slice(w * 7, w * 7 + 7));
  }, [cur]);

  // Per-week event segments with lane packing (spanning bars).
  const weekSegs = useMemo(() => {
    return weeks.map((week) => {
      const wStart = dateOnly(week[0]!);
      const wEnd = dateOnly(week[6]!);
      const segs: Seg[] = [];
      for (const e of events) {
        const eStart = dateOnly(new Date(e.startAt));
        const eEnd = dateOnly(new Date(e.endAt));
        if (eEnd < wStart || eStart > wEnd) continue;
        const startCol = eStart <= wStart ? 0 : dayDiff(wStart, eStart);
        const endCol = eEnd >= wEnd ? 6 : dayDiff(wStart, eEnd);
        segs.push({ e, startCol, endCol, startsHere: eStart >= wStart, lane: 0 });
      }
      // Longer/earlier first, then greedy lane assignment.
      segs.sort((a, b) => a.startCol - b.startCol || b.endCol - b.startCol - (a.endCol - a.startCol));
      const laneEnd: number[] = [];
      for (const s of segs) {
        let lane = 0;
        while (lane < laneEnd.length && laneEnd[lane]! >= s.startCol) lane++;
        s.lane = lane;
        laneEnd[lane] = s.endCol;
      }
      const lanes = laneEnd.length;
      const shown = Math.min(lanes, MAX_LANES);
      const overflow = lanes > MAX_LANES;
      return { segs, lanes, shown, height: Math.max(96, HEADER + shown * LANE + (overflow ? LANE : 0) + 8) };
    });
  }, [weeks, events]);

  const today = new Date();
  const todayKey = dayKey(today);
  const step = (delta: number) => { const d = new Date(cur.y, cur.m + delta, 1); setCur({ y: d.getFullYear(), m: d.getMonth() }); setSelected(null); };
  const goToday = () => { setCur({ y: today.getFullYear(), m: today.getMonth() }); setSelected(null); };

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      let d = dateOnly(new Date(e.startAt));
      const last = dateOnly(new Date(e.endAt));
      let g = 0;
      while (d <= last && g < 366) { const k = dayKey(d); (map.get(k) ?? map.set(k, []).get(k)!).push(e); d = new Date(d); d.setDate(d.getDate() + 1); g++; }
    }
    return map;
  }, [events]);

  const chipLabel = (e: CalEvent) => (e.allDay ? e.title : `${toTimeStr(new Date(e.startAt))} ${e.title}`);
  const spanDays = (e: CalEvent) => dayDiff(new Date(e.startAt), new Date(e.endAt)) + 1;
  const selectedEvents = selected ? byDay.get(selected) ?? [] : [];
  const timeRange = (e: CalEvent) => {
    const s = new Date(e.startAt), en = new Date(e.endAt);
    const d = spanDays(e);
    if (e.allDay) return d > 1 ? `All day · ${d} days` : "All day";
    return d > 1 ? `${toTimeStr(s)} → ${toDateStr(en)} ${toTimeStr(en)}` : `${toTimeStr(s)}–${toTimeStr(en)}`;
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-800">{MONTHS[cur.m]} {cur.y}</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => step(1)} aria-label="Next month" className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <button type="button" onClick={goToday} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Today</button>
        <button type="button" onClick={() => openAdd(toDateStr(new Date(cur.y, cur.m, Math.min(15, new Date().getDate()))))} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"><Plus className="h-4 w-4" /> Add event</button>
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
          {WEEKDAYS.map((w) => <div key={w} className="px-2 py-2 text-center">{w}</div>)}
        </div>
        {weeks.map((week, wi) => {
          const { segs, shown, height } = weekSegs[wi]!;
          return (
            <div key={wi} className="relative">
              {/* Day cells */}
              <div className="grid grid-cols-7">
                {week.map((d, ci) => {
                  const k = dayKey(d);
                  const inMonth = d.getMonth() === cur.m;
                  const isToday = k === todayKey;
                  return (
                    <div key={ci} onClick={() => openAdd(toDateStr(d))} style={{ minHeight: height }} className={`group relative cursor-pointer border-b border-r border-slate-100 p-1.5 ${inMonth ? "bg-white hover:bg-slate-50/60" : "bg-slate-50/40"} ${selected === k ? "ring-2 ring-inset ring-sky-400" : ""}`}>
                      <div className="flex items-center justify-between">
                        <button type="button" onClick={(ev) => { ev.stopPropagation(); setSelected(byDay.get(k)?.length ? k : null); }} className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${isToday ? "bg-sky-600 text-white" : inMonth ? "text-slate-700 hover:bg-slate-100" : "text-slate-300"}`}>{d.getDate()}</button>
                        <span className="hidden rounded p-0.5 text-slate-400 group-hover:block"><Plus className="h-3.5 w-3.5" /></span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Spanning event bars */}
              <div className="pointer-events-none absolute inset-x-0 grid grid-cols-7 gap-x-1 gap-y-1 px-1" style={{ top: HEADER, gridAutoRows: `${LANE - 4}px` }}>
                {segs.filter((s) => s.lane < MAX_LANES).map((s, si) => {
                  const e = s.e;
                  const c = colorOf(e);
                  const multi = spanDays(e) > 1;
                  return (
                    <button
                      key={si}
                      type="button"
                      style={{ gridColumn: `${s.startCol + 1} / ${s.endCol + 2}`, gridRow: s.lane + 1 }}
                      onClick={() => (e.type === "custom" ? openEdit(e) : setSelected(dayKey(dateOnly(new Date(e.startAt)))))}
                      title={`${chipLabel(e)}${multi ? ` (${spanDays(e)} days)` : ""}${e.sub ? " — " + e.sub : ""}`}
                      className={`pointer-events-auto flex items-center justify-between gap-1 overflow-hidden rounded px-1.5 text-left text-[11px] font-medium ${c.bar}`}
                    >
                      <span className="truncate">{s.startsHere ? chipLabel(e) : `↔ ${e.title}`}</span>
                      {multi && <span className="shrink-0 text-[10px] opacity-90">{spanDays(e)}d</span>}
                    </button>
                  );
                })}
                {/* "+N more" per day when events overflow the visible lanes */}
                {week.map((d, ci) => {
                  const hidden = segs.filter((s) => s.lane >= MAX_LANES && s.startCol <= ci && s.endCol >= ci).length;
                  if (!hidden) return null;
                  const k = dayKey(d);
                  return (
                    <button
                      key={`more-${ci}`}
                      type="button"
                      style={{ gridColumn: `${ci + 1} / ${ci + 2}`, gridRow: shown + 1 }}
                      onClick={(ev) => { ev.stopPropagation(); setSelected(k); }}
                      className="pointer-events-auto flex items-center overflow-hidden rounded px-1.5 text-left text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-sky-600"
                    >
                      +{hidden} more
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {LEGEND.map(([c, label]) => (
          <span key={c} className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className={`h-2.5 w-2.5 rounded-full ${COLOR[c]?.dot}`} />{label}</span>
        ))}
      </div>

      {/* Selected-day detail */}
      {selected && selectedEvents.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">{new Date(Number(selected.split("-")[0]), Number(selected.split("-")[1]), 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })} — {selected.split("-")[2]}</p>
            <button type="button" onClick={() => openAdd(`${selected.split("-")[0]}-${pad(Number(selected.split("-")[1]) + 1)}-${pad(Number(selected.split("-")[2]))}`)} className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:underline"><Plus className="h-3.5 w-3.5" /> Add</button>
          </div>
          <ul className="space-y-2">
            {selectedEvents.map((e, j) => (
              <li key={j} className="flex items-start justify-between gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${colorOf(e).dot}`} />
                  <div>
                    {e.type === "custom" ? (
                      <button type="button" onClick={() => openEdit(e)} className="text-left text-sm font-medium text-slate-700 hover:text-sky-700">{e.title}</button>
                    ) : e.href ? (
                      <Link href={e.href} className="text-sm font-medium text-sky-700 hover:underline">{e.title}</Link>
                    ) : (<p className="text-sm font-medium text-slate-700">{e.title}</p>)}
                    <p className="text-xs text-slate-500">{timeRange(e)}{e.sub ? ` · ${e.sub}` : ""}</p>
                  </div>
                </div>
                {e.type === "custom" && e.id && (
                  <button type="button" disabled={pending} onClick={() => confirm("Delete this event?") && start(() => deleteEvent(e.id!))} aria-label="Delete event" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add / Edit modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">{editId ? "Edit event" : "Add event"}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. TMSA audit — Gas Elegance" className="mb-3 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none" />
            <label className="mb-2 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day</label>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
                <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value); }} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none" />
                {!allDay && <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none" />}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none" />
                {!allDay && <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none" />}
              </div>
            </div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Color</label>
            <div className="mb-3 flex gap-1.5">
              {Object.keys(COLOR).map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} className={`h-6 w-6 rounded-full ${COLOR[c]?.dot} ${color === c ? "ring-2 ring-offset-1 ring-slate-400" : ""}`} />
              ))}
            </div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ fieldSizing: "content" } as React.CSSProperties} className="mb-4 max-h-64 min-h-[3.5rem] w-full resize-none overflow-y-auto rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none" />
            <div className="flex items-center justify-between">
              {editId ? (
                <button type="button" disabled={pending} onClick={del} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Delete</button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-800">Cancel</button>
                <button type="button" disabled={pending || !title.trim() || !startDate} onClick={save} className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
