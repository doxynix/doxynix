import NextAuth, { type NextAuthOptions } from "next-auth";

import { authOptions } from "@/server/core/auth";

const handler = NextAuth(authOptions satisfies NextAuthOptions) as (
  request: Request
) => Promise<Response> | Response;

export { handler as GET, handler as POST };
