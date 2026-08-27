import "server-only";

/**
 * The client address for a request, for the audit trail and for per-address
 * throttling.
 *
 * ── How far to trust the answer ──
 * Node gets no address of its own here; both headers below are written by
 * whatever sits in front of the app. Behind a proxy that *overwrites*
 * `x-forwarded-for` (nginx `proxy_set_header`, a cloud load balancer), the
 * first entry is the real client and this is trustworthy. With no proxy, or a
 * proxy that appends instead of overwrites, the header is whatever the client
 * sent — so an attacker can put anything here, including someone else's
 * address.
 *
 * That is why per-address throttling is the *secondary* control in
 * `lib/login-throttle.ts` and the per-account one is load-bearing: an address
 * can be rotated, an account name cannot. And it is why an address in an audit
 * row is evidence of where a request *claimed* to come from.
 *
 * Deployment note for whoever fronts this app: set `x-forwarded-for` at the
 * proxy rather than passing the client's through, or neither control nor the
 * audit trail means what it looks like it means.
 */
export function clientIpFrom(headers: Headers): string | null {
  // Left-most entry is the originating client; everything after it is the
  // chain of proxies that handled the request.
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    // Cap the length: this string is a Map key and lands in a database column,
    // and nothing legitimate is anywhere near this long.
    if (first) return first.slice(0, 64);
  }

  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);

  // Null rather than a placeholder like "unknown": a placeholder would key
  // every proxy-less request into a single shared throttle bucket, so one
  // attacker could lock out everyone by exhausting it.
  return null;
}
