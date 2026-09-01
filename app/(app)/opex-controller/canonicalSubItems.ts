// Canonical OPEX sub-item (particular) names per category, taken from Swan's
// budget-proposal Excel template. OPEX reports spell these many different ways
// (plurals, spacing, punctuation, typos, extra descriptions), so on import we
// map each raw line item to its canonical name — that way the actuals line up
// with the budget particulars instead of fragmenting into near-duplicates
// (e.g. "Miscellaneous Lubes" / "Miscellanoeus Oil" → "Misc. Oils").

export const CANONICAL_SUBITEMS: Record<string, string[]> = {
  Crewing: [
    "Crew Wages", "Crew Travel incl. Handling", "Crew Pre-Emp Costs",
    "Social Charges", "Union Dues", "Crew Provisions", "Miscellaneous",
  ],
  "Lubricating Oil": [
    "M/E System Oils", "M/E Cylinder Oils", "A/E Oils", "Misc. Oils",
    "Delivery Cost", "Bunker Analysis Fee & Lube Test Kit",
  ],
  "Repairs & Maintenance": [
    "Engine Spares", "Deck Spares", "Comm/Navigation Spares", "Handling/Delivery",
    "Survey Fees", "Servicing, Inspections & Calibrations",
  ],
  "Stores & Supplies": [
    "Deck Stores", "Steward", "Engine Stores, Electrical and Batteries", "Paint",
    "Freshwater", "Chemicals/Gases", "AVCS, paper charts; Digital & Paper Publications",
    "Signals & Safety", "Medicine", "Ropes & Wires", "Handling Costs",
  ],
  Operations: [
    "Communication", "Oil Majors Inspection / Vetting", "Super. Travel, Company Inspection/Pre-vetting",
    "ISM Audits", "ISPS Audits", "MLC Audits", "Master's Representation (Owners cost)",
    "Port Expenses", "Flag/Statutory Costs", "Other Requirements", "Miscellaneous / Admin. Cost",
  ],
};

// Explicit aliases (regex tested against the raw name, first match wins). These
// catch synonyms and category-specific meanings that fuzzy matching alone can't
// (e.g. "D/G Oil" = "A/E Oils"; "Handling Costs" means Handling/Delivery under
// R&M but stays Handling Costs under Stores). Ordered most-specific first.
const ALIASES: Record<string, [RegExp, string][]> = {
  Crewing: [
    [/wage/i, "Crew Wages"],
    [/travel/i, "Crew Travel incl. Handling"],
    [/pre.?emp/i, "Crew Pre-Emp Costs"],
    [/social/i, "Social Charges"],
    [/union/i, "Union Dues"],
    [/provision/i, "Crew Provisions"],
  ],
  "Lubricating Oil": [
    [/(d\/?g|a\/?e)\s*oil/i, "A/E Oils"],
    [/m\/?e\s*sys/i, "M/E System Oils"],
    [/m\/?e\s*cyl/i, "M/E Cylinder Oils"],
    [/misc.*(oil|lube)/i, "Misc. Oils"],
    [/bunker\s*anal/i, "Bunker Analysis Fee & Lube Test Kit"],
    [/deliver/i, "Delivery Cost"],
  ],
  "Repairs & Maintenance": [
    [/engine\s*spare/i, "Engine Spares"],
    [/deck\s*spare/i, "Deck Spares"],
    [/comm|navig/i, "Comm/Navigation Spares"],
    [/handling|deliver/i, "Handling/Delivery"],
    [/survey/i, "Survey Fees"],
    [/servic|inspection|calibrat/i, "Servicing, Inspections & Calibrations"],
  ],
  "Stores & Supplies": [
    [/steward|cabin/i, "Steward"],
    [/deck\s*store/i, "Deck Stores"],
    [/engine\s*store|electrical|batter/i, "Engine Stores, Electrical and Batteries"],
    [/paint/i, "Paint"],
    [/fresh\s*water|drink/i, "Freshwater"],
    [/chemical|gas/i, "Chemicals/Gases"],
    [/chart|publication|avcs/i, "AVCS, paper charts; Digital & Paper Publications"],
    [/signal|safety/i, "Signals & Safety"],
    [/medicine|medical/i, "Medicine"],
    [/rope|wire/i, "Ropes & Wires"],
    [/handling/i, "Handling Costs"],
  ],
  Operations: [
    [/communicat/i, "Communication"],
    [/vetting|oil\s*major/i, "Oil Majors Inspection / Vetting"],
    [/super.*travel|superintendent/i, "Super. Travel, Company Inspection/Pre-vetting"],
    [/\bism\b/i, "ISM Audits"],
    [/\bisps\b/i, "ISPS Audits"],
    [/\bmlc\b/i, "MLC Audits"],
    [/master.?s?\s*rep|representation/i, "Master's Representation (Owners cost)"],
    [/port\s*expense/i, "Port Expenses"],
    [/flag|statutory/i, "Flag/Statutory Costs"],
    [/other\s*require/i, "Other Requirements"],
    [/admin|miscellaneous|misc\b/i, "Miscellaneous / Admin. Cost"],
  ],
};

const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

function bigrams(s: string): Set<string> {
  const g = new Set<string>();
  const t = s.replace(/ /g, "");
  for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2));
  return g;
}

// Dice coefficient on character bigrams — robust to typos and plurals.
function dice(a: string, b: string): number {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((x) => { if (B.has(x)) inter++; });
  return (2 * inter) / (A.size + B.size);
}

// Fraction of the canonical name's tokens that appear in the raw name — lets a
// long raw ("Port Expenses / Launch hire / Crew Rec …") match a short canonical.
function tokenCover(rawN: string, canonN: string): number {
  const ra = rawN.split(" "), cb = canonN.split(" ").filter((t) => t.length > 2);
  if (!cb.length) return 0;
  let hit = 0;
  for (const t of cb) if (ra.includes(t)) hit++;
  return hit / cb.length;
}

// Order a list of sub-item names by the Excel/canonical sequence for a category.
// Names in the canonical list keep that order; anything else (e.g. "Bank Charges",
// not in the budget template) is appended at the bottom, alphabetically.
export function orderByCanonical(category: string, names: string[]): string[] {
  const order = CANONICAL_SUBITEMS[category] ?? [];
  const idx = (n: string) => { const i = order.indexOf(n); return i === -1 ? Infinity : i; };
  return [...names].sort((a, b) => idx(a) - idx(b) || a.localeCompare(b));
}

// Map a raw OPEX line item to its canonical particular for the given category.
// Returns the raw (trimmed) unchanged if nothing matches well enough.
export function canonicalizeSubItem(category: string, raw: string): string {
  const r = (raw ?? "").trim();
  if (!r) return r;
  const list = CANONICAL_SUBITEMS[category];
  if (!list) return r;
  const nr = norm(r);

  for (const [re, canon] of ALIASES[category] ?? []) if (re.test(r)) return canon;
  for (const c of list) if (norm(c) === nr) return c;

  let best: string | null = null, score = 0;
  for (const c of list) {
    const s = Math.max(dice(nr, norm(c)), tokenCover(nr, norm(c)));
    if (s > score) { score = s; best = c; }
  }
  return score >= 0.5 && best ? best : r;
}
