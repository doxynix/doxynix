import NextAuth, { type NextAuthOptions } from "next-auth";

import { authOptions } from "@/server/auth/options";

const handler = NextAuth(authOptions satisfies NextAuthOptions);

export { handler as GET, handler as POST };
