import { cursorPageSchema } from "@/server/utils/pagination";

export const ListApiKeysInputSchema = cursorPageSchema(50);
