/**
 * Crewing presentation helpers. Pure, no imports from Prisma or the session —
 * safe in a client component.
 */

/** The four name columns, which is all any of these need. */
export type CrewName = {
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
};

/**
 * A seafarer's name — ONE function with two modes, not two functions.
 *
 * "list" is surname-first: `Dela Cruz, Juan M. Jr.` It is what every official
 * document uses (POEA/DMW contract, SIRB, flag-state crew list), and it is
 * what sorts correctly beside the query's `orderBy: lastName`.
 *
 * "prose" is given-name-first: `Juan M. Dela Cruz Jr.` — for a sentence, an
 * audit summary, or a page title, where the surname-first form reads as a
 * form field rather than as a person.
 *
 * The middle name renders as an INITIAL. It is the mother's maiden surname and
 * is load-bearing for identification, so it must appear; spelled out in full it
 * doubles the width of every crew-list row for a letter's worth of information.
 * The full value is on the man's own record.
 */
export function formatCrewName(name: CrewName, mode: "list" | "prose" = "list"): string {
  const middle = name.middleName?.trim();
  const initial = middle ? `${middle.charAt(0).toUpperCase()}.` : "";
  const suffix = name.suffix?.trim() ?? "";

  if (mode === "prose") {
    return [name.firstName, initial, name.lastName, suffix].filter(Boolean).join(" ");
  }
  const given = [name.firstName, initial, suffix].filter(Boolean).join(" ");
  return `${name.lastName}, ${given}`;
}

/**
 * A ship, named the way the client asked for it: `Swan Aquarius (SWA)`.
 *
 * Both parts, everywhere, and defined ONCE — the picker, the register's Vessel
 * column, the seafarer's record and the audit summary all render a vessel
 * through here, so "name and code together" cannot be true on three surfaces
 * and forgotten on the fourth. The code is what appears in every reference
 * number the office already reads (SWA-NCR-2026-0001), which is why it belongs
 * beside the name rather than behind a hover.
 *
 * `code` is nullable on Vessel — a ship entered before its fleet code was
 * settled renders as its name alone rather than as "Swan Aquarius ()".
 */
export function vesselLabel(vessel: { name: string; code: string | null }): string {
  return vessel.code ? `${vessel.name} (${vessel.code})` : vessel.name;
}

/**
 * How this module names a seafarer in an AUDIT SUMMARY: name and crew code,
 * and nothing else, ever. Never a date of birth, never a passport number,
 * never a phone number (docs/plans/crewing.md §3.7). `AuditLog` is read by
 * every `admin:view-audit` holder and is not covered by any redaction path, so
 * a summary is a permanent publication.
 */
export function crewAuditLabel(seafarer: CrewName & { crewCode: string | null }): string {
  const name = formatCrewName(seafarer, "prose");
  return seafarer.crewCode ? `${name} (${seafarer.crewCode})` : name;
}
