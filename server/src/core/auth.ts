import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { env } from "@server/core/env";
import { betterAuth } from "better-auth";
import { db } from "./db/db";
import * as schema from "./db/schema";

export const auth = betterAuth({
  baseUrl: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
    },
  }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "analyst",
        input: false,
      },
    },
  },
});
