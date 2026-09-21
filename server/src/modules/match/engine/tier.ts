import { MatchResult } from '../match.types';

/**
 * Presentation-only REACH/TARGET/SAFETY bucket derived purely from `overall`
 * — deliberately simpler than the EduConnect India reference reviewed for
 * backlog ideas, whose own inline comment admits its tier logic is confused
 * (REACH decided by `world_rank` alone, ignoring the score just computed).
 * This never feeds back into ranking or scoring, only display.
 */
export function deriveTier(overall: number, knockout: boolean): MatchResult['tier'] {
  if (knockout) return null;
  if (overall >= 80) return 'safety';
  if (overall >= 55) return 'target';
  return 'reach';
}
