import { IS_PROD } from "../constants/env.flags";

export function getCookieName() {
  return IS_PROD ? "__Secure-doxynix.session_token" : "doxynix.session_token";
}
