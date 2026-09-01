import { authSchema } from "@doxynix/shared";

import { insertUserSchema } from "@/core/db/schema";

export const AdminAddUsersSchema = authSchema.extend({
  name: insertUserSchema.shape.name.optional(),
  role: insertUserSchema.shape.role,
});
