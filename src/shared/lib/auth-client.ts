import { passkeyClient } from "@better-auth/passkey/client";
import {
  adminClient,
  inferAdditionalFields,
  lastLoginMethodClient,
  magicLinkClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@/server/core/auth";

export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    inferAdditionalFields<typeof auth>(),
    lastLoginMethodClient(),
    passkeyClient(),
    adminClient(),
    twoFactorClient(),
    // oneTapClient({
    //   autoSelect: false,
    //   cancelOnTapOutside: true,
    //   clientId: NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    //   context: "signin",
    // }),
  ],
});

export type SessionAndUser = NonNullable<typeof authClient.$Infer.Session>;
export type User = SessionAndUser["user"];
export type Session = SessionAndUser["session"];
