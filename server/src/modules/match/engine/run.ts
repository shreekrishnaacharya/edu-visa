// ---------------------------------------------------------------------------
// Pure ranking step — ported from src/mocks/engine/run.ts.  Persistence and
// data loading live in MatchService; this just scores, filters knockouts,
// ranks, slices, and attaches "alternatives".
// ---------------------------------------------------------------------------

import { Currency, MatchWeights } from '../../../common/enums';
import { MatchResult } from '../match.types';
import { DerivedProfile, EngineCourse, EngineStudent, EngineUniversity } from './types';
import { FX_TO_AUD } from './reference';
import { score } from './score';

export interface RankInput {
  profile: DerivedProfile;
  student: EngineStudent;
  courses: EngineCourse[];
  universitiesById: Map<string, EngineUniversity>;
  weights: MatchWeights;
  limit?: number;
  now?: Date;
  fxRates?: Record<Currency, number>;
  /** Default true — see the "closest miss" fallback below. */
  fallbackWhenEmpty?: boolean;
}

const avgSubscore = (r: MatchResult) => {
  const dims = Object.values(r.subscores) as number[];
  return dims.reduce((a, b) => a + b, 0) / dims.length;
};

export function rankCourses({
  profile,
  student,
  courses,
  universitiesById,
  weights,
  limit = 8,
  now = new Date(),
  fxRates = FX_TO_AUD,
  fallbackWhenEmpty = true,
}: RankInput): MatchResult[] {
  const scored = courses.map((course) => {
    const uni = universitiesById.get(course.university_id)!;
    return score(profile, student, course, uni, weights, now, fxRates);
  });

  let top = scored.filter((r) => !r.knockout).sort((a, b) => b.overall - a.overall).slice(0, limit);

  // A real senior consultant never just says "no options for you" — if every
  // course fails a hard filter (almost always budget), surface the closest
  // misses instead of an empty result: still ranked, still knockout:true with
  // their real reasons, so the caller can present them as "doesn't quite fit,
  // here's the gap" rather than a dead end. Ranked by average subscore (their
  // `overall` is forced to 0 by the knockout, so it can't be used to rank).
  if (top.length === 0 && scored.length > 0 && fallbackWhenEmpty) {
    top = [...scored].sort((a, b) => avgSubscore(b) - avgSubscore(a)).slice(0, Math.min(3, limit));
    // `score()` forces `overall` to 0 for anything knocked out — correct for
    // the real contract, but a flat "0%" badge reads as "this is terrible"
    // rather than "here's how close it is". Fallback-only: show the average
    // subscore as an indicative figure; `knockout`/`knockout_reasons` still
    // make it unambiguous this isn't a real pass.
    for (const r of top) r.overall = Math.round(avgSubscore(r));
  }

  const courseById = new Map(courses.map((c) => [c.id, c]));

  // "alternatives": next-best course in the same field for each recommendation
  const passers = scored.filter((r) => !r.knockout);
  for (const r of top) {
    const mineField = courseById.get(r.course_id)?.field;
    const pool = r.knockout ? scored : passers; // fallback rows may need to look past other knockouts too
    const alt = pool.find(
      (o) =>
        o.course_id !== r.course_id &&
        courseById.get(o.course_id)?.field === mineField,
    );
    if (alt) {
      const altCourse = courseById.get(alt.course_id)!;
      const altUni = universitiesById.get(altCourse.university_id)!;
      r.alternatives = [
        `${altCourse.title} at ${altUni.name} (${alt.overall}% match)`,
      ];
    }
  }

  return top;
}
