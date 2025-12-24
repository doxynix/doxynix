import NextAuth, { NextAuthOptions } from "next-auth";

import { authOptions } from "@/shared/api/auth/authOptions";

const handler = NextAuth(authOptions satisfies NextAuthOptions);

export { handler as GET, handler as POST };
