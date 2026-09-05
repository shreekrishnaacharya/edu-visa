// ---------------------------------------------------------------------------
// Normalization / reference tables. In production these are DB-backed and
// versioned (docs/PRODUCT_PLAN.md §2 "normalization tables").
// ---------------------------------------------------------------------------

import type { Currency, EnglishTest, GpaScale } from "../types";

/** Convert any supported GPA representation to a canonical 0–100 scale. */
export function toCanonicalGpa(value: number, scale: GpaScale): number {
  switch (scale) {
    case "4.0":
      return clamp((value / 4) * 100);
    case "10.0":
      return clamp((value / 10) * 100);
    case "percentage":
      return clamp(value);
    case "division":
      // 1st division ≈ 65, 2nd ≈ 52, 3rd ≈ 40 (Nepal/India board convention)
      return value <= 1 ? 68 : value === 2 ? 52 : 40;
    default:
      return clamp(value);
  }
}

/**
 * English-test concordance → a canonical IELTS-equivalent overall band.
 * Approximate public concordance figures; production stores the official tables.
 */
export function toIeltsEquivalent(test: EnglishTest, overall: number): number {
  if (test === "IELTS") return overall;
  if (test === "PTE") {
    if (overall >= 79) return 8;
    if (overall >= 73) return 7.5;
    if (overall >= 65) return 7;
    if (overall >= 58) return 6.5;
    if (overall >= 50) return 6;
    if (overall >= 43) return 5.5;
    return 5;
  }
  if (test === "TOEFL") {
    if (overall >= 110) return 8;
    if (overall >= 102) return 7.5;
    if (overall >= 94) return 7;
    if (overall >= 79) return 6.5;
    if (overall >= 60) return 6;
    if (overall >= 46) return 5.5;
    return 5;
  }
  // Duolingo
  if (overall >= 140) return 8;
  if (overall >= 130) return 7.5;
  if (overall >= 120) return 7;
  if (overall >= 110) return 6.5;
  if (overall >= 95) return 6;
  if (overall >= 85) return 5.5;
  return 5;
}

/** Static demo FX rates → AUD (the comparison currency). */
export const FX_TO_AUD: Record<Currency, number> = {
  AUD: 1,
  NPR: 0.0114,
  GBP: 1.92,
  CAD: 1.11,
  USD: 1.5,
};

export function toAud(amount: number, currency: Currency): number {
  return Math.round(amount * FX_TO_AUD[currency]);
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}
