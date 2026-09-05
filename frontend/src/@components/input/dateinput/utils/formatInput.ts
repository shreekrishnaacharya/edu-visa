/**
 * Auto-inserts dashes as the user types a date so they don't have to.
 * Strips all non-digits first, then rebuilds "YYYY-MM-DD".
 *   "20810415"  → "2081-04-15"
 *   "208104"    → "2081-04"
 *   "2081"      → "2081"
 */
export function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/**
 * Auto-inserts colons as the user types a time "HH:mm" or "HH:mm:ss".
 *   "1430"   → "14:30"
 *   "143045" → "14:30:45"
 */
export function formatTimeInput(raw: string, withSeconds = false): string {
  const digits = raw.replace(/\D/g, "").slice(0, withSeconds ? 6 : 4);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}`;
}

/**
 * Clamp a two-digit field (hours, minutes, seconds) as the user types.
 * Used to prevent values like "99" from being entered.
 */
export function clampTimeSegment(value: string, max: number): string {
  const n = parseInt(value, 10);
  if (isNaN(n)) return value;
  return String(Math.min(n, max)).padStart(2, "0");
}
