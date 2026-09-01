// GL / account codes shown beside each particular in the owner Budget Proposal,
// derived from Swan's real proposal (e.g. Francois 2026-2027). Keyed by category
// then canonical particular name (see canonicalSubItems.ts). Not exhaustive — a
// particular with no mapping simply shows no code.
export const GL_CODES: Record<string, Record<string, string>> = {
  Crewing: {
    "Crew Wages": "60008",
    "Crew Travel incl. Handling": "60010",
    "Crew Pre-Emp Costs": "60004",
    "Social Charges": "60015",
    "Union Dues": "60017",
    "Crew Provisions": "63001",
    "Miscellaneous": "60018",
  },
  "Lubricating Oil": {
    "M/E System Oils": "63015",
    "M/E Cylinder Oils": "63016",
    "A/E Oils": "63017",
    "Misc. Oils": "63018",
    "Delivery Cost": "63020",
    "Bunker Analysis Fee & Lube Test Kit": "63021",
  },
  "Repairs & Maintenance": {
    "Engine Spares": "62009",
    "Deck Spares": "62010",
    "Comm/Navigation Spares": "62004",
    "Handling/Delivery": "62011",
    "Survey Fees": "62017",
    "Servicing, Inspections & Calibrations": "62019",
  },
  "Stores & Supplies": {
    "Deck Stores": "63002",
    "Steward": "63003",
    "Engine Stores, Electrical and Batteries": "63004",
    "Paint": "63005",
    "Freshwater": "63006",
    "Chemicals/Gases": "63008",
    "AVCS, paper charts; Digital & Paper Publications": "63009",
    "Signals & Safety": "63011",
    "Medicine": "63012",
    "Ropes & Wires": "63013",
    "Handling Costs": "63014",
  },
  Operations: {
    "Communication": "64001",
    "Oil Majors Inspection / Vetting": "64008",
    "Super. Travel, Company Inspection/Pre-vetting": "64010",
    "ISM Audits": "64006",
    "ISPS Audits": "64009",
    "MLC Audits": "64018",
    "Master's Representation (Owners cost)": "63010",
    "Port Expenses": "64012",
    "Flag/Statutory Costs": "64005",
    "Other Requirements": "60016",
    "Miscellaneous / Admin. Cost": "64003",
  },
};

export const glCode = (category: string, particular: string): string => GL_CODES[category]?.[particular] ?? "";

// Section letters in the owner proposal (A. Crew Costs, B. Lubricating Oils, …).
export const SECTION_LETTER: Record<string, string> = {
  Crewing: "A",
  "Lubricating Oil": "B",
  "Repairs & Maintenance": "C",
  "Stores & Supplies": "D",
  Operations: "E",
};

// Heading as printed in the proposal (differs slightly from our internal names).
export const SECTION_TITLE: Record<string, string> = {
  Crewing: "Crew Costs",
  "Lubricating Oil": "Lubricating Oils",
  "Repairs & Maintenance": "Repair & Maintenance",
  "Stores & Supplies": "Stores & Supplies",
  Operations: "Operations",
  "Management Fee": "Management Fee",
};
