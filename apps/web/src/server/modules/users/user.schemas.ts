import { CursorMetaSchema } from "@doxynix/shared";
import * as z from "zod";

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
