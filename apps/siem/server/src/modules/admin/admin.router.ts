import { zValidator } from "@hono/zod-validator";
import { auth } from "@server/core/auth/auth";
import { type AuthEnv, requireAuth, requireRole } from "@server/core/middleware/auth.middleware";
import { AdminAddUsersSchema } from "@server/modules/admin/admin.schema";
import { Hono } from "hono";

export const adminRouter = new Hono<AuthEnv>()
  .use("*", requireAuth, requireRole("admin"))
  .post("/users", zValidator("json", AdminAddUsersSchema), async (c) => {
    const { email, password, role, name } = c.req.valid("json");

    const newUser = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: name ?? email.split("@")[0],
        role,
      },
    });

    return c.json({ success: true, user: newUser.user }, 201);
  });
