import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { env } from "@server/core/env";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { db } from "../db/db";
import * as schema from "../db/schema";

export const auth = betterAuth({
  baseUrl: env.BETTER_AUTH_URL,
  trustedOrigins: [
    ...env.CLIENT_URL,
    "http://localhost:3001",
    "https://localhost:3001",
    "http://127.0.0.1:3001",
    "https://127.0.0.1:3001",
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  advanced: {
    cookiePrefix: "doxynix-siem",
    database: {
      generateId: false,
    },
  },
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: {
        type: schema.rolesEnum.enumValues,
        required: true,
        defaultValue: "analyst",
        input: true,
      },
    },
  },
  plugins: [
    twoFactor({
      issuer: "Doxynix SIEM",
    }),
  ],
});
