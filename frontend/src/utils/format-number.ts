/**
 * Format number with thousands separator
 */
export function fNumber(num: number, precision: number = 0): string {
  if (precision > 0) {
    return num.toFixed(precision).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format percentage
 */
export function fPercent(num: number): string {
  return `${num.toFixed(1)}%`;
}

/**
 * Format currency
 */
export function fCurrency(num: number): string {
  return `₹${fNumber(num)}`;
}

/**
 * Shorten number with suffixes
 */
export function fShortenNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return fNumber(num);
}