// Parse the free-text TMSA "Target" field into a real due date, and derive
// overdue status. Handles: "Jun 2026", "June 2026", "Q3 2026", "28 Feb 2026",
// "2026", and non-dates ("COMPLETED", "Ongoing", "N/A", "TBD", ""). Ported
// verbatim from the Swan-GCC TMSA module (lib/target.ts) — pure logic, no
// changes needed for this app.

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Last day of a given month (month is 0-based).
const endOfMonth = (year: number, month: number) => new Date(year, month + 1, 0);

export function parseTargetDate(target: string | null | undefined): Date | null {
  if (!target) return null;
  const t = target.trim().toLowerCase();
  if (!t) return null;

  // Explicit non-dates → no deadline.
  if (/(completed|ongoing|n\/a|tbd|continuous|closed)/.test(t)) return null;

  // ISO date, e.g. "2026-06-30" (what the date-box editor stores).
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  // Quarter, e.g. "Q3 2026" → end of that quarter.
  let m = t.match(/q([1-4])\s*'?(\d{4})/);
  if (m) {
    const q = parseInt(m[1]!, 10);
    return endOfMonth(parseInt(m[2]!, 10), q * 3 - 1); // Q1→Mar, Q2→Jun, Q3→Sep, Q4→Dec
  }

  // Day Month Year, e.g. "28 Feb 2026" / "28th February 2026".
  m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,})\s+(\d{4})/);
  if (m && MONTHS[m[2]!.slice(0, 3)] !== undefined) {
    return new Date(parseInt(m[3]!, 10), MONTHS[m[2]!.slice(0, 3)]!, parseInt(m[1]!, 10));
  }

  // Month Year, e.g. "Jun 2026" / "June 2026" → end of month.
  m = t.match(/([a-z]{3,})\s+'?(\d{4})/);
  if (m && MONTHS[m[1]!.slice(0, 3)] !== undefined) {
    return endOfMonth(parseInt(m[2]!, 10), MONTHS[m[1]!.slice(0, 3)]!);
  }

  // Year only → end of year.
  m = t.match(/^'?(\d{4})$/);
  if (m) return endOfMonth(parseInt(m[1]!, 10), 11);

  return null;
}

// Overdue = has a parseable deadline in the past AND not yet closed.
export function isOverdue(target: string | null | undefined, status: string, now: Date = new Date()): boolean {
  if (status === "CLOSED") return false;
  const due = parseTargetDate(target);
  return due !== null && due.getTime() < now.getTime();
}

// Whole days overdue (positive) or remaining (negative); null if no deadline.
export function daysUntil(target: string | null | undefined, now: Date = new Date()): number | null {
  const due = parseTargetDate(target);
  if (!due) return null;
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

// Normalize any target value to an ISO date (YYYY-MM-DD) for the date box,
// or "" when it isn't a real date (COMPLETED, Ongoing, N/A, TBD, blank).
export function formatTargetDate(target: string | null | undefined): string {
  const d = parseTargetDate(target);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
