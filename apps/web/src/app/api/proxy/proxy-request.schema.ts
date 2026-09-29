import * as z from "zod/mini";

/**
 * Request body for the authenticated proxy route.
 *
 * Validated rather than asserted because the route forwards an attacker-supplied
 * URL to the server, which makes this the untrusted boundary. `body` stays
 * `unknown` because it is forwarded verbatim; `headers` is constrained to string
 * values because undici rejects a non-string header at runtime with an
 * unhelpful error, and a nested object there is a caller bug worth rejecting at
 * the door.
 */
export const ProxyRequestBody = z.object({
  // `zod/mini` treats a bare `z.unknown()` as a required key, so an absent body
  // has to be declared optional explicitly.
  body: z.optional(z.unknown()),
  headers: z.optional(z.record(z.string(), z.string())),
  method: z.optional(z.string()),
  url: z.optional(z.string()),
});

/** The shape the route narrows to after a successful parse. */
export type ProxyRequest = z.output<typeof ProxyRequestBody>;
