// ---------------------------------------------------------------------------
// A course whose entry bar was never sourced from the institution must be
// reported as UNKNOWN, not as a pass.
//
// The catalogue is built from the CRICOS register, which publishes no entry
// requirement at all, so `min_gpa` / `min_english_band` are null for most of
// it. They used to be `0`, and because the gates are `gpa + 3 < min_gpa` and
// `band + 0.5 < min_english_band`, a 0 *passed* every applicant — an unsourced
// course looked like it had no entry bar rather than an unknown one. These
// tests pin the corrected behaviour.
// ---------------------------------------------------------------------------

import { deriveProfile } from '../src/modules/match/engine/derive';
import { score } from '../src/modules/match/engine/score';
import { DEFAULT_WEIGHTS } from '../src/modules/match/engine/weights';
import {
  EngineCourse,
  EngineStudent,
  EngineUniversity,
} from '../src/modules/match/engine/types';

const NOW = new Date('2026-09-26T00:00:00Z');
const future = (months: number) => {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

const student: EngineStudent = {
  id: 's-test',
  passport_status: 'held',
  academic: [
    { level: 'Bachelor', course: 'BSc IT', gpa_value: 3.2, gpa_scale: '4.0', end_year: 2024 },
  ],
  language_tests: [{ test: 'IELTS', overall: 6.5 }],
  work: [],
  career_goal: {
    target_occupation: 'Software Engineer',
    intended_field: 'Information Technology',
    long_term: 'PR',
  },
  finance: {
    income_sources: [{ amount: 1_200_000, currency: 'NPR' }],
    assets: [{ amount: 6_000_000, currency: 'NPR', liquid: true }],
    liabilities: [],
  },
  dependants: [],
  visa_history: [],
  preferences: {
    preferred_countries: ['AU'],
    preferred_cities: ['Melbourne'],
    degree_level: 'Master',
    field: 'Information Technology',
    max_tuition_per_year: 60_000,
    tuition_currency: 'AUD',
    scholarship_required: false,
    ranking_matters: false,
    city_size: 'either',
  },
};

const uni: EngineUniversity = {
  id: 'u-1',
  name: 'Test University',
  country: 'AU',
  city: 'Melbourne',
  world_rank: 999,
};

function course(entry: Partial<EngineCourse['entry']>): EngineCourse {
  return {
    id: 'c-1',
    university_id: 'u-1',
    title: 'Master of Information Technology',
    degree_level: 'Master',
    field: 'Information Technology',
    duration_months: 24,
    tuition_fee: 40_000,
    application_deadline: future(2),
    next_intake_date: future(4),
    intakes: ['Feb', 'Jul'],
    entry: {
      min_gpa: null,
      min_english_band: null,
      prerequisites: [],
      work_experience_months: 0,
      ...entry,
    },
    scholarships: [],
    career_outcomes: [],
  };
}

const run = (c: EngineCourse) =>
  score(deriveProfile(student, 1), student, c, uni, DEFAULT_WEIGHTS, NOW);

const check = (res: ReturnType<typeof score>, rule: string) =>
  res.admission_eligibility.checks.find((c) => c.rule === rule);

describe('unsourced entry requirements are reported as unknown', () => {
  it('reports an unsourced English band as unknown, not pass', () => {
    const res = run(course({ min_english_band: null }));
    expect(check(res, 'English score')?.status).toBe('unknown');
  });

  it('reports an unsourced academic bar as unknown, not pass', () => {
    const res = run(course({ min_gpa: null }));
    expect(check(res, 'academic score')?.status).toBe('unknown');
  });

  it('does not claim the student failed a bar that was never sourced', () => {
    const res = run(course({}));
    expect(res.knockout_reasons.join(' ')).not.toMatch(/below the (required|entry minimum)/i);
  });

  it('returns insufficient_data rather than eligible', () => {
    // academic score and English score are the two *mandatory* checks, so
    // `deriveOverallVerdict` downgrades an unknown one all the way to
    // insufficient_data rather than conditionally_eligible. That is the honest
    // verdict for a bar nobody has sourced: not "probably fine with
    // conditions", but "we do not know what the bar is".
    expect(run(course({})).admission_eligibility.overall).toBe('insufficient_data');
  });

  it('recovers a real verdict once the bands are sourced', () => {
    expect(run(course({ min_gpa: 50, min_english_band: 6.0 })).admission_eligibility.overall).toBe(
      'eligible',
    );
  });

  it('still fails a student who genuinely misses a sourced band', () => {
    const res = run(course({ min_english_band: 8.0, min_gpa: 50 }));
    expect(check(res, 'English score')?.status).toBe('fail');
  });

  it('still passes a student who clears a sourced band', () => {
    const res = run(course({ min_english_band: 6.0, min_gpa: 50 }));
    expect(check(res, 'English score')?.status).toBe('pass');
    expect(check(res, 'academic score')?.status).toBe('pass');
  });

  it('does not score an unsourced bar higher than a sourced one the student clears', () => {
    // The regression this guards: null coerced to 0 made the margin look huge,
    // so an unsourced course outranked a real one on academic fit.
    const unsourced = run(course({}));
    const sourced = run(course({ min_gpa: 50, min_english_band: 6.0 }));
    expect(unsourced.subscores.academic).toBeLessThanOrEqual(sourced.subscores.academic);
    expect(unsourced.subscores.english).toBeLessThanOrEqual(sourced.subscores.english);
  });
});
