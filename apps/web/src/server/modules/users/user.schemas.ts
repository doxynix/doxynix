import { CursorMetaSchema } from "@doxynix/shared";
import * as z from "zod";

import { cursorPageSchema } from "@/server/utils/pagination";

export const ActiveSessionsInputSchema = cursorPageSchema(50);

export const UserSessionSchema = z.object({
  createdAt: z.date(),
  id: z.uuid(),
  ipAddress: z.string().nullable(),
  userAgent: z.string(),
});

export const ActiveSessionsOutputSchema = z.object({
  items: z.array(UserSessionSchema),
  meta: CursorMetaSchema,
});
