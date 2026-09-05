import { MatchWeights } from '../../../common/enums';
import { env } from '../../../config/env';

/** Bumped from the prototype's "proto-1.0.0" now that the engine is server-side. */
export const ENGINE_VERSION = env.engineVersion; // "v1.0.0"

/** Default dimension weights — surfaced as sliders on the match results screen. */
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
