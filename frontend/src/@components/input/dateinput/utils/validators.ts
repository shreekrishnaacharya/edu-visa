/**
 * Returns true if the string is a complete, plausibly valid BS date "YYYY-MM-DD".
 */
export function isValidBSDate(
  str: string,
  minDate?: string,
  maxDate?: string,
): boolean {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [, m, d] = str.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 32) return false;
  if (minDate && str < minDate) return false;
  if (maxDate && str > maxDate) return false;
  return true;
}

/**
 * Returns true if the string is a complete, plausibly valid AD date "YYYY-MM-DD".
 */
export function isValidADDate(
  str: string,
  minDate?: string,
  maxDate?: string,
): boolean {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [, m, d] = str.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  if (minDate && str < minDate) return false;
  if (maxDate && str > maxDate) return false;
  return true;
}

/**
 * Returns true if time string is a valid "HH:mm" or "HH:mm:ss".
 */
export function isValidTime(str: string, withSeconds = false): boolean {
  const pattern = withSeconds ? /^\d{2}:\d{2}:\d{2}$/ : /^\d{2}:\d{2}$/;
  if (!str || !pattern.test(str)) return false;
  const parts = str.split(":").map(Number);
  if (parts[0] > 23 || parts[1] > 59) return false;
  if (withSeconds && parts[2] > 59) return false;
  return true;
}
