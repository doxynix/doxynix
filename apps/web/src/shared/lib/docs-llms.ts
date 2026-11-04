import { llms } from "fumadocs-core/source";

import { docsSource } from "./docs-source";

export const LLMS_CONTENT_TYPE = "text/plain; charset=utf-8";

export const docsLlms = llms(docsSource, {
  renderPage: async (page) => {
    const markdown = await page.data.getText("processed");

    return `# ${page.data.title} (${page.url})\n\n${markdown}`;
  },
});
