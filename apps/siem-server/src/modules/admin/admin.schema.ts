import { authSchema } from "@doxynix/shared";
import { insertUserSchema } from "@server/core/db/schema";

export const AdminAddUsersSchema = authSchema.extend({
  name: insertUserSchema.shape.name,
  role: insertUserSchema.shape.role,
});
