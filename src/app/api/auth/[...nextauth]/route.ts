import NextAuth, { type NextAuthOptions } from "next-auth";

import { authOptions } from "@/server/shared/infrastructure/auth";

const handler = NextAuth(authOptions satisfies NextAuthOptions);

export { handler as GET, handler as POST };
