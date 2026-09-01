// OPEX categories as they appear in Swan's "Opex Analysis" reporting sheet.
export const OPEX_CATEGORIES = [
  "Crewing",
  "Management Fee",
  "Lubricating Oil",
  "Repairs & Maintenance",
  "Stores & Supplies",
  "Operations",
  "Drydocking",
] as const;

// Map an uppercase category-header row from the OPEX Analysis sheet to a
// canonical category. Returns null for non-category rows (totals, sub-items,
// non-budgeted, charterer, etc.) so only the six/seven main lines are imported.
export function mapOpexCategory(rawDesc: string): string | null {
  const orig = rawDesc.trim();
  // Category headers are ALL-CAPS in the sheet; mixed-case rows (e.g. "Deck
  // Stores") are line items, not categories.
  if (!orig || !/[A-Z]/.test(orig) || orig !== orig.toUpperCase()) return null;
  const d = orig.toUpperCase();
  if (d.includes("TOTAL")) return null; // skip subtotal/total rows
  if (/CREWING/.test(d)) return "Crewing";
  if (/MANAGEMENT FEE/.test(d)) return "Management Fee";
  if (/LUBRICATING OIL/.test(d)) return "Lubricating Oil";
  if (/REPAIRS.*MAINTENANCE|MAINTENANCE.*REPAIRS/.test(d)) return "Repairs & Maintenance";
  if (/STORES/.test(d)) return "Stores & Supplies";
  if (/^OPERATIONS$/.test(d)) return "Operations";
  if (/DRYDOCK/.test(d)) return "Drydocking";
  return null;
}

// Utilization-based RAG (warning band): ≤90% Green, 90–100% Amber, >100% Red.
export function opexBand(budget: number, actual: number): { label: string; cls: string } {
  if (budget <= 0 && actual <= 0) return { label: "No Data", cls: "bg-slate-100 text-slate-500" };
  const util = budget > 0 ? actual / budget : Infinity;
  if (util > 1) return { label: "Over budget", cls: "bg-red-100 text-red-700" };
  if (util >= 0.9) return { label: "Near budget", cls: "bg-amber-100 text-amber-700" };
  return { label: "Within budget", cls: "bg-emerald-100 text-emerald-700" };
}

// Variance % relative to budget (positive = under budget / saving).
export function variancePct(budget: number, actual: number): number | null {
  if (budget <= 0) return null;
  return ((budget - actual) / budget) * 100;
}
