// All money in the app is South African Rand. Formatted by hand (rather than Intl) so the
// output is identical on every device regardless of its locale data: "R 1 250", "R 99.50".
export const CURRENCY_CODE = "ZAR";
export const CURRENCY_SYMBOL = "R";

// Compact relative time for feeds: "now", "5m", "2h", "3d", then "12 Sep".
export function timeAgo(iso: string, now = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d`;
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
}

export function formatMoney(amount: number, { cents = false }: { cents?: boolean } = {}): string {
  const fixed = Math.abs(amount).toFixed(cents ? 2 : 0);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const sign = amount < 0 ? "-" : "";
  return `${sign}${CURRENCY_SYMBOL} ${grouped}${fraction ? `.${fraction}` : ""}`;
}
