import "server-only";

import { createFromSource } from "fumadocs-core/search/server";

import { docsSource } from "./docs-source";

export const docsSearch = createFromSource(docsSource, { language: "english" });
