// Builds the "Raise NCR" link used by PSC / Internal Audit / External Audit /
// Flag Inspection finding rows to auto-open the NCR create form pre-filled
// (one finding = one NCR). Contextual details that have no dedicated NCR
// field (report ref, port) are folded into the description as a prefix line
// rather than expanding the NCR schema for them.
export function ncrPrefillHref(params: {
  vesselId?: string | null;
  source: "PSC" | "INTERNAL_AUDIT" | "EXTERNAL_AUDIT" | "FLAG_STATE";
  sourceEntityId: string;
  requirement?: string | null;
  description: string;
  raisedAt?: string | null; // yyyy-mm-dd
  reportRefNo: string;
  port?: string | null;
  // Earliest target date already on the finding's own corrective action(s),
  // if any — shown up front so the raise form doesn't look like the date
  // never carries over (it's also re-derived server-side on submit as a
  // fallback, see createNcrAction, but showing it here avoids the confusing
  // "target date field is blank" first impression).
  targetDate?: string | null; // yyyy-mm-dd
}): string {
  const context = `Raised from ${params.reportRefNo}${params.port ? ` (Port: ${params.port})` : ""}.`;
  // Title has no source-side equivalent, but it's a required field on the
  // create form — leaving it blank meant the browser silently blocked
  // submission with no visible error. Derive a reasonable default from the
  // finding's own description so the auto-populated flow never dead-ends.
  const title =
    params.description.length > 80
      ? `${params.description.slice(0, 77).trimEnd()}…`
      : params.description;
  const sp = new URLSearchParams();
  if (params.vesselId) sp.set("vesselId", params.vesselId);
  sp.set("source", params.source);
  sp.set("sourceEntityId", params.sourceEntityId);
  if (params.requirement) sp.set("requirement", params.requirement);
  sp.set("title", title);
  sp.set("description", `${context}\n\n${params.description}`);
  if (params.raisedAt) sp.set("raisedAt", params.raisedAt);
  if (params.targetDate) sp.set("targetDate", params.targetDate);
  return `/non-conformities/new?${sp.toString()}`;
}
