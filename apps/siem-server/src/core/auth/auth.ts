import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";

import { env } from "@/core/env";

import { db } from "../db/db";
import * as schema from "../db/schema";

export const auth = betterAuth({
  advanced: {
    cookiePrefix: "doxynix-siem",
    database: {
      generateId: false,
    },
  },
  baseUrl: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  emailAndPassword: { enabled: true },
  plugins: [
    twoFactor({
      issuer: "Doxynix SIEM",
    }),
  ],
  trustedOrigins: [
    ...env.CLIENT_URL,
    "http://localhost:3001",
    "https://localhost:3001",
    "http://127.0.0.1:3001",
    "https://127.0.0.1:3001",
  ],
  user: {
    additionalFields: {
      role: {
        defaultValue: "analyst",
        input: true,
        required: true,
        type: schema.rolesEnum.enumValues,
      },
    },
  },
});
