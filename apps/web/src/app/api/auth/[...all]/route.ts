import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/server/core/auth";

export const { GET, POST } = toNextJsHandler(auth);
