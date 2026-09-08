import { AuthSchema } from "@doxynix/shared";
import * as z from "zod/mini";

import { insertUserSchema } from "@/core/db/schema";

export const AdminAddUsersSchema = z.extend(AuthSchema, {
  name: z.optional(insertUserSchema.shape.name),
  role: insertUserSchema.shape.role,
});
