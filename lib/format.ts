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

// Distance for a task row: "400 m", "1.2 km", "14 km". Task positions are approximate, so
// anything under 100 m is shown as "Nearby" rather than as a precise-looking figure.
export function formatDistance(meters: number): string {
  if (meters < 100) return "Nearby";
  if (meters < 1000) return `${Math.round(meters / 100) * 100} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

// "12 Sep 2026", for receipts and review dates. Month names come from the device locale.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}
