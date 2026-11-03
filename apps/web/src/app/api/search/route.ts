import { createFromSource } from "fumadocs-core/search/server";

import { docsSource } from "@/shared/lib/docs-source";

export const { GET } = createFromSource(docsSource, { language: "english" });
