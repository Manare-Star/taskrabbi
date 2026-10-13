// All money in the app is South African Rand. Formatted by hand (rather than Intl) so the
// output is identical on every device regardless of its locale data: "R 1 250", "R 99.50".
export const CURRENCY_CODE = "ZAR";
export const CURRENCY_SYMBOL = "R";

export function formatMoney(amount: number, { cents = false }: { cents?: boolean } = {}): string {
  const fixed = Math.abs(amount).toFixed(cents ? 2 : 0);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const sign = amount < 0 ? "-" : "";
  return `${sign}${CURRENCY_SYMBOL} ${grouped}${fraction ? `.${fraction}` : ""}`;
}
