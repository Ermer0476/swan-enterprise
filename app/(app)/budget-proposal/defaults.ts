// Standard particular lines per category, taken from Swan's budget-proposal
// Excel template (the "Main" summary sheet). Used when a category has no
// historical sub-items in the OPEX data yet — e.g. Crewing, whose breakdown is
// computed on a separate manning-scale sheet — so its particulars still appear
// in the summary and are editable.
// Repairs & Maintenance is a 3-level worksheet: fixed groups, each broken into
// sub-items (from the Excel "Particulars" sheet). `flat` groups have no
// sub-items — just a single amount. Group names match the canonical R&M
// particulars so the group totals line up with the actuals.
// `expiry: true` shows a per-item expiry field — only the Comm/Navigation Spares
// equipment has multi-year survey/certificate expiries; spares don't.
export type RmGroup = { group: string; items: string[]; flat?: boolean; expiry?: boolean };
export const REPAIRS_TEMPLATE: RmGroup[] = [
  { group: "Engine Spares", items: ["Main Engine (incl. overhauling spares)", "Generator (No.1 & No.2)", "Boiler", "Other Machinery"] },
  { group: "Deck Spares", items: ["Cargo Gear", "Deck Machinery", "Air Conditioning"] },
  { group: "Comm/Navigation Spares", expiry: true, items: ["GMDSS Annual Survey", "LRIT Conformance Test", "Gyrocompass Annual Service", "VDR Annual Performance Test", "Magnetic Compass Compensation", "Radar Magnetrons", "EPIRB Battery / HRU", "SART Batteries", "Float Free Capsule", "Radar & ECDIS Annual Survey", "Others (Provisions)"] },
  { group: "Handling/Delivery", items: [], flat: true },
  { group: "Survey Fees", items: ["Annual Survey (excl. ISM/ISPS/MLC)", "ERS for GRT ≥ 5K", "EU MRV", "Annual CII & Rating Verification"] },
  { group: "Servicing, Inspections & Calibrations", items: ["Liferaft / Firefighting Equipment", "Lifeboat Annual Service"] },
];

// Crewing is computed from a manning scale + monthly cost items, ×12, allocated
// to the 7 Crew Cost lines (from the Excel "Crewing" sheet). Each monthly item
// maps to the line it rolls up into.
export type ManningRow = { rank: string; count: number; wage: number };
export type CrewItem = { name: string; line: string; amount: number };

// Budget review workflow states (who has reviewed the proposal).
export const REVIEW_STATES = ["Drafting", "For Review", "For owners approval"] as const;

export const CREW_LINES = [
  "Crew Wages", "Crew Travel incl. Handling", "Crew Pre-Emp Costs",
  "Social Charges", "Union Dues", "Crew Provisions", "Miscellaneous",
] as const;

export const DEFAULT_MANNING: ManningRow[] = [
  { rank: "Master", count: 1, wage: 10650 },
  { rank: "Ch Mate", count: 1, wage: 8300 },
  { rank: "2nd Mate", count: 1, wage: 4200 },
  { rank: "3rd Mate (JR)", count: 1, wage: 2700 },
  { rank: "Ch Engr", count: 1, wage: 10500 },
  { rank: "2nd Engr", count: 1, wage: 8300 },
  { rank: "3rd Engr", count: 1, wage: 4200 },
  { rank: "4th Engr (JR)", count: 1, wage: 2700 },
  { rank: "A/B", count: 3, wage: 1464 },
  { rank: "Oiler", count: 3, wage: 1464 },
  { rank: "OS", count: 2, wage: 1129 },
  { rank: "C/Cook", count: 1, wage: 1599 },
  { rank: "Messman", count: 1, wage: 1129 },
  { rank: "Cadet", count: 1, wage: 350 },
];

// Monthly cost items and which of the 7 lines each rolls into. "Overlap Wages"
// rolls into Crew Wages alongside the manning total.
export const DEFAULT_CREW_ITEMS: CrewItem[] = [
  { name: "Overlap Wages", line: "Crew Wages", amount: 1985 },
  { name: "Travel", line: "Crew Travel incl. Handling", amount: 6250 },
  { name: "Crew Training", line: "Crew Pre-Emp Costs", amount: 300 },
  { name: "PEME (Pre-Employment Medical)", line: "Crew Pre-Emp Costs", amount: 475 },
  { name: "Crew Documents", line: "Crew Pre-Emp Costs", amount: 300 },
  { name: "Working Gear", line: "Crew Pre-Emp Costs", amount: 475 },
  { name: "Health Insurance", line: "Crew Pre-Emp Costs", amount: 570 },
  { name: "Social Charges", line: "Social Charges", amount: 1938 },
  { name: "Union Dues", line: "Union Dues", amount: 0 },
  { name: "Provisions ($8.50/man/day)", line: "Crew Provisions", amount: 5137 },
  { name: "Agency Fee", line: "Miscellaneous", amount: 2500 },
  { name: "Bank Charges & Comm.", line: "Miscellaneous", amount: 250 },
  { name: "Slop Chest", line: "Miscellaneous", amount: 100 },
];

// Crewing "Particulars" for the owner report: manning list + editable notes.
// (Separate from the crew-cost budget lines; these describe the crew.)
export type CrewManningRow = { count: number; position: string };
export const DEFAULT_CREW_MANNING: CrewManningRow[] = [
  // Deck department (renders in the left column)
  { count: 1, position: "Master" },
  { count: 1, position: "Chief Officer" },
  { count: 1, position: "Second Officer" },
  { count: 1, position: "Third Officer" },
  { count: 1, position: "Chief Cook" },
  { count: 3, position: "AB" },
  { count: 1, position: "OS" },
  // Engine department (renders in the right column)
  { count: 1, position: "Chief Engineer" },
  { count: 1, position: "Second Engineer" },
  { count: 1, position: "Third Engineer" },
  { count: 1, position: "Fourth Engineer" },
  { count: 3, position: "Oilers" },
  { count: 1, position: "Cadet" },
  { count: 1, position: "Messman" },
];

export const DEFAULT_CREW_NATIONALITY = "ALL FILIPINOS";
export const DEFAULT_CREW_ITF = "ITF";
export const DEFAULT_CREW_NOTES = `Crew contract set as follows:
    Senior Officers - Six (6) Months plus/minus 1 month
    Other Officers & Ratings - Eight (8) Months plus/minus 1 month
Crew Training covers minimum required as per Company SMS.
Pre-employment Cost are POEA processing, medical checks, D&A and working gear.
Crew documents include Flag Licenses.
Crew Medical Insurance covers crew and immediate family.
Social Charges are Govt. & Welfare contributions (SSS, Pag-Ibig).
Crew provisions is set at $8.50 per man per day incl. handling.
Miscellaneous covers manning agents fee, communication and crew slopchest/laundry allowances.
Union dues was computed based on the 2026-2027 tariff.`;

export const DEFAULT_PARTICULARS: Record<string, string[]> = {
  Crewing: [
    "Crew Wages",
    "Crew Travel incl. Handling",
    "Crew Pre-Emp Costs",
    "Social Charges",
    "Union Dues",
    "Crew Provisions",
    "Miscellaneous",
  ],
};
