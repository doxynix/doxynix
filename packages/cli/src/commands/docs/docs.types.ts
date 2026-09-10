import type { RouterInput, RouterOutput } from "@/core/client";

export type DocType = RouterInput["analysis"]["getDocumentContent"]["type"];
export type DocListItem = RouterOutput["analysis"]["getAvailableDocs"][number];
