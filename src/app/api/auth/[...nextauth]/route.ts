import NextAuth from "next-auth";

import { authOptions } from "@/shared/api/auth/authOptions";

const handler = (NextAuth as any)(authOptions);

export { handler as GET, handler as POST };
