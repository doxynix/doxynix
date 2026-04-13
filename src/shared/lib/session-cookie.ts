import { IS_PROD } from "../constants/env.flags";

export function getCookieName() {
  return IS_PROD ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}
