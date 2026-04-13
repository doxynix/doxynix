import Cookies from "js-cookie";

/**
 * Устанавливает куку на стороне клиента.
 * @param name - Название куки
 * @param value - Значение (строка или булево)
 * @param maxAge - Время жизни в СЕКУНДАХ
 */
export function setClientCookie(name: string, value: boolean | string, maxAge: number) {
  if (typeof window === "undefined") return;

  Cookies.set(name, String(value), {
    // Конвертируем секунды (max-age) в дни (expires), так как js-cookie работает с днями
    expires: maxAge / 86_400,
    path: "/",
    sameSite: "Lax",
    // Автоматически ставим Secure, если протокол https
    secure: window.location.protocol === "https:",
  });
}
