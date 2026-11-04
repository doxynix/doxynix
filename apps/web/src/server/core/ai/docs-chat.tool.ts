import "server-only";

import { tool } from "ai";
import * as z from "zod";

import { docsSearch } from "@/shared/lib/docs-search";

const MAX_RESULTS = 5;
const MAX_SNIPPET_LENGTH = 800;

export const docsChatTools = {
  search: tool({
    description:
      "Search the Doxynix documentation. Use this before answering any question about Doxynix features, commands, plans or behaviour.",
    execute: async ({ query }) => {
      const results = await docsSearch.search(query);
      const seen = new Set<string>();

      return results
        .filter((result) => {
          const pageUrl = result.url.split("#")[0] ?? result.url;

          if (seen.has(pageUrl)) {
            return false;
          }

          seen.add(pageUrl);

          return true;
        })
        .slice(0, MAX_RESULTS)
        .map((result) => ({
          doc: {
            title: result.breadcrumbs?.at(-1) ?? "Doxynix documentation",
            url: result.url,
          },
          snippet: result.content.slice(0, MAX_SNIPPET_LENGTH),
        }));
    },
    inputSchema: z.object({
      query: z.string().trim().min(2).max(200),
    }),
  }),
};
