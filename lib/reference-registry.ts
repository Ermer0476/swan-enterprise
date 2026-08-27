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

export type ReferenceOption = {
  value: string;
  label: string;
  sortOrder: number;
};

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

export const REFERENCE_REGISTRY = {
  "vessel-document-type": {
    label: "Vessel Document Type",
    group: "Vessel Documentation",
    fallback: flatList(VESSEL_DOCUMENT_TYPES),
  },
} as const satisfies Record<string, ReferenceListDefinition>;

export type ReferenceListKey = keyof typeof REFERENCE_REGISTRY;

/** All registered keys — used by the settings page and the seed/backfill. */
export const REFERENCE_LIST_KEYS = Object.keys(REFERENCE_REGISTRY) as ReferenceListKey[];

export function isReferenceListKey(key: string): key is ReferenceListKey {
  return key in REFERENCE_REGISTRY;
}
