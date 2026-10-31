export function formatCurrency(amountCents: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      currency: currency.toUpperCase(),
      style: "currency",
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
