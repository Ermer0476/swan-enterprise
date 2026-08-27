// ─── Reference-list registry ───────────────────────────────────────────────
//  The single source of fallback values for every office-editable reference
//  list. Each entry maps a stable `listKey` to its display metadata plus the
//  built-in `fallback` options, flattened from the feature constant they used
//  to be hard-coded as. When a company has ZERO ReferenceListItem rows for a
//  key, lib/reference-list.ts serves this fallback verbatim — so a picker
//  renders the exact same options it did before this feature existed. The
//  seed and backfill also write these same rows (isSystem: true), which is
//  what guarantees the seeded default equals the old hard-coded value.
//
//  To add a list later: import its existing constant, add one entry here, and
//  (for a UI-managed list) it appears automatically on /settings/reference-lists.
import { VESSEL_DOCUMENT_TYPES } from "@/features/vessel-documents/schema";
import {
  INCIDENT_TYPES,
  INCIDENT_TYPE_LABELS,
  INCIDENT_SUBCATEGORIES,
  INCIDENT_SUBCATEGORY_LABELS,
  type IncidentTypeValue,
} from "@/features/incidents/schema";
import {
  CIRCULAR_SOURCES,
  CIRCULAR_SOURCE_LABELS,
  ISSUING_BODY_SUGGESTIONS,
  type CircularSourceValue,
} from "@/features/circulars/schema";
import { SHIP_POSITIONS, OFFICE_POSITIONS } from "@/lib/crew-ranks";
import {
  RA_LEVELS,
  LIKELIHOOD_SCALE_LABELS,
  SEVERITY_SCALE_LABELS,
} from "@/features/risk/schema";
import {
  ROOT_CAUSE_CATEGORIES,
  ROOT_CAUSE_LABELS,
  ROOT_CAUSE_SUBCATEGORIES,
  ROOT_CAUSE_SUBCATEGORY_LABELS,
  type RootCauseCategoryValue,
} from "@/lib/root-cause";

export type ReferenceOption = {
  value: string;
  label: string;
  sortOrder: number;
};

/** Root-cause sub-category options per category — the shape threaded to every
 * root-cause sub-category picker (Incident, Near Miss, NCR, PSC, audits, SIRE,
 * CDI). One list per category, so a client can index by the selected one. */
export type RootCauseSubcategoryOptions = Record<RootCauseCategoryValue, ReferenceOption[]>;

export type ReferenceListDefinition = {
  /** Human label for the list section on the settings page. */
  label: string;
  /** Grouping heading — lists sharing a group render together. */
  group: string;
  /** Built-in options, used verbatim when a company has no rows for the key. */
  fallback: ReferenceOption[];
};

/** Build a flat fallback list from a `value == label` string tuple, assigning
 * sortOrder from declaration order (10, 20, 30 … leaving gaps for later
 * office-inserted rows). */
function flatList(values: readonly string[]): ReferenceOption[] {
  return values.map((value, i) => ({ value, label: value, sortOrder: (i + 1) * 10 }));
}

/** Like flatList but with a separate display label per value (value stays the
 * stored code); falls back to the value when a label is missing. */
function labeledList(values: readonly string[], labels: Record<string, string>): ReferenceOption[] {
  return values.map((value, i) => ({ value, label: labels[value] ?? value, sortOrder: (i + 1) * 10 }));
}

/** Build the per-value sub-lists for a keyed constant — one registry entry per
 * bucket (incident type, circular source, root-cause category …). Keeps the
 * template-literal key types (`"<prefix>:<VALUE>"`) so the resulting object's
 * keys stay in the ReferenceListKey union. */
function perValueLists<Prefix extends string, V extends string>(
  prefix: Prefix,
  values: readonly V[],
  build: (v: V) => ReferenceListDefinition,
): { [K in V as `${Prefix}:${K}`]: ReferenceListDefinition } {
  const out = {} as Record<string, ReferenceListDefinition>;
  for (const v of values) out[`${prefix}:${v}`] = build(v);
  return out as { [K in V as `${Prefix}:${K}`]: ReferenceListDefinition };
}

export const REFERENCE_REGISTRY = {
  "vessel-document-type": {
    label: "Vessel Document Type",
    group: "Vessel Documentation",
    fallback: flatList(VESSEL_DOCUMENT_TYPES),
  },

  // Reporter positions / crew ranks (Incident, Near Miss). Split by department.
  "ship-position": {
    label: "Ship Position / Rank",
    group: "Reporter Positions",
    fallback: flatList(SHIP_POSITIONS),
  },
  "office-position": {
    label: "Office Position",
    group: "Reporter Positions",
    fallback: flatList(OFFICE_POSITIONS),
  },

  // Risk matrix scale labels — value is the numeric level ("1".."5"), label is
  // the company's history-based description. Numeric bound (1–5) is unchanged.
  "risk-likelihood-label": {
    label: "Risk Likelihood Scale",
    group: "Risk Matrix Scales",
    fallback: RA_LEVELS.map((n, i) => ({
      value: String(n),
      label: LIKELIHOOD_SCALE_LABELS[n],
      sortOrder: (i + 1) * 10,
    })),
  },
  "risk-severity-label": {
    label: "Risk Severity Scale",
    group: "Risk Matrix Scales",
    fallback: RA_LEVELS.map((n, i) => ({
      value: String(n),
      label: SEVERITY_SCALE_LABELS[n],
      sortOrder: (i + 1) * 10,
    })),
  },

  // Incident sub-categories — one list per incident type.
  ...perValueLists("incident-subcategory", INCIDENT_TYPES, (type: IncidentTypeValue) => ({
    label: `Incident Sub-category — ${INCIDENT_TYPE_LABELS[type]}`,
    group: "Incident Sub-categories",
    fallback: labeledList(INCIDENT_SUBCATEGORIES[type], INCIDENT_SUBCATEGORY_LABELS[type]),
  })),

  // Circular issuing-body suggestions — one list per source (free-text; the
  // COMPANY source ships no suggestions, matching the old empty constant).
  ...perValueLists("circular-issuing-body", CIRCULAR_SOURCES, (source: CircularSourceValue) => ({
    label: `Issuing Body — ${CIRCULAR_SOURCE_LABELS[source]}`,
    group: "Circular Issuing Bodies",
    fallback: flatList(ISSUING_BODY_SUGGESTIONS[source]),
  })),

  // Root-cause sub-categories — one list per root-cause category.
  ...perValueLists("root-cause-subcategory", ROOT_CAUSE_CATEGORIES, (category: RootCauseCategoryValue) => ({
    label: `Root Cause Sub-category — ${ROOT_CAUSE_LABELS[category]}`,
    group: "Root Cause Sub-categories",
    fallback: labeledList(ROOT_CAUSE_SUBCATEGORIES[category], ROOT_CAUSE_SUBCATEGORY_LABELS[category]),
  })),
} satisfies Record<string, ReferenceListDefinition>;

export type ReferenceListKey = keyof typeof REFERENCE_REGISTRY;

/** All registered keys — used by the settings page and the seed/backfill. */
export const REFERENCE_LIST_KEYS = Object.keys(REFERENCE_REGISTRY) as ReferenceListKey[];

export function isReferenceListKey(key: string): key is ReferenceListKey {
  return key in REFERENCE_REGISTRY;
}

// ─── Typed key builders ─────────────────────────────────────────────────────
//  The per-value lists are addressed with a composite key. These helpers keep
//  the call sites type-safe (the returned literal is a member of the union)
//  instead of hand-concatenating a widened string.

export function incidentSubcategoryKey(type: IncidentTypeValue): ReferenceListKey {
  return `incident-subcategory:${type}`;
}

export function circularIssuingBodyKey(source: CircularSourceValue): ReferenceListKey {
  return `circular-issuing-body:${source}`;
}

export function rootCauseSubcategoryKey(category: RootCauseCategoryValue): ReferenceListKey {
  return `root-cause-subcategory:${category}`;
}
