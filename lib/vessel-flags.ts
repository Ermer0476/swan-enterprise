// Fixed flag-state list for Vessel Master's Flag field — locked to a select
// (was free text) so the Flag Drill Schedule module can reliably match a
// vessel to its flag's required drill/familiarization set by exact string
// equality. Covers every flag currently on file plus the other major
// open-registry flags likely to show up as the fleet grows.
export const VESSEL_FLAGS = [
  "Panama",
  "Marshall Islands",
  "Liberia",
  "Malta",
  "Singapore",
  "Hong Kong",
  "Cyprus",
  "Bahamas",
  "Isle of Man",
  "Cook Islands",
  "Vanuatu",
  "Philippines",
  "Malaysia",
] as const;
