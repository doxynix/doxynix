import { IS_PROD } from "../constants/env.flags";

export function getClientCookie(name: string): null | string {
  if (typeof window === "undefined") {
    return null;
  }

  const matches = RegExp(
    new RegExp(`(?:^|; )${name.replaceAll(/([$()*+./?[\\\]^{|}])/g, "\\$1")}=([^;]*)`),
  ).exec(document.cookie);
  return matches ? decodeURIComponent(matches[1] ?? "") : null;
}

/**
 * Устанавливает куку на стороне клиента
 * @param name - Название куки
 * @param value - Значение
 * @param maxAge - Время жизни в СЕКУНДАХ
 */
export function setClientCookie(name: string, value: boolean | string, maxAge: number) {
  if (typeof window === "undefined") {
    return;
  }

  const secure = window.location.protocol === "https:" ? "Secure;" : "";

  // eslint-disable-next-line unicorn/no-document-cookie
  document.cookie = `${name}=${encodeURIComponent(String(value))}; max-age=${maxAge}; path=/; SameSite=Lax; ${secure}`;
}

export function getCookieName() {
  return IS_PROD ? "__Secure-doxynix.session_token" : "doxynix.session_token";
}
