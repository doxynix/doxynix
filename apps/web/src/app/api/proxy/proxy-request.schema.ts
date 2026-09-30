import * as z from "zod/mini";

export const ProxyRequestBody = z.object({
  body: z.optional(z.unknown()),
  headers: z.optional(z.record(z.string(), z.string())),
  method: z.optional(z.string()),
  url: z.optional(z.string()),
});

export type ProxyRequest = z.output<typeof ProxyRequestBody>;
