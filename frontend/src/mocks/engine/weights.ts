import type { MatchWeights } from "../types";

export const ENGINE_VERSION = "proto-1.0.0";

/** Default dimension weights. Surfaced as sliders on the match results screen. */
export const DEFAULT_WEIGHTS: MatchWeights = {
  academic: 0.24,
  english: 0.16,
  financial: 0.16,
  career: 0.26,
  location: 0.08,
  scholarship: 0.1,
};

export function normalizeWeights(w: MatchWeights): MatchWeights {
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(
    Object.entries(w).map(([k, v]) => [k, v / total]),
  ) as MatchWeights;
}
