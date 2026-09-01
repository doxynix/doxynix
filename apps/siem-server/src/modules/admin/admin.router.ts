import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { auth } from "@/core/auth/auth";
import { requireAuth, requireRole } from "@/core/middleware/auth.middleware";

import { AdminAddUsersSchema } from "@/modules/admin/admin.schema";

export const adminRouter = new Hono()
  .use("*", requireAuth, requireRole("admin"))
  .post("/users", zValidator("json", AdminAddUsersSchema), async (c) => {
    const { email, password, role, name } = c.req.valid("json");

    const newUser = await auth.api.signUpEmail({
      body: {
        email,
        name: name ?? email.split("@")[0] ?? email,
        password,
        role,
      },
    });

    return c.json({ success: true, user: newUser.user }, 201);
  });
