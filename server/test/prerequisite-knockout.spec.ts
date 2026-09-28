// ---------------------------------------------------------------------------
// A prerequisite that names no subject must not knock the applicant out.
//
// Found by the happy-path fixture (src/seed/happy-path-fixture.ts): its
// Graduate Diploma asks for "Undergraduate degree in any discipline" — the most
// permissive entry rule it is possible to write — and the engine dropped the
// course from the results for a student holding a Bachelor of Computer
// Engineering. The other four fixture courses, which ask for the NARROWER
// "computing, engineering or a quantitative discipline", all passed.
//
// The rule compared every word over three characters against the student's
// course titles and treated zero overlap as "not evidenced". Since "undergraduate",
// "degree" and "discipline" appear in no course title, the broader the
// requirement the more certain the rejection — exactly backwards. Those words
// name no subject, so the comparison cannot confirm or refute anything and the
// check is `unknown`, following the same "unknown, never assumed" rule the
// unsourced entry bands already use.
//
// No live course carries prerequisites (0 of 12,758), so this changes nothing
// in the current catalogue — it stops the rule misfiring once real prerequisite
// data is sourced.
// ---------------------------------------------------------------------------

import { deriveProfile } from '../src/modules/match/engine/derive';
import { knockout, score } from '../src/modules/match/engine/score';
import { DEFAULT_WEIGHTS } from '../src/modules/match/engine/weights';
import { EngineCourse, EngineStudent, EngineUniversity } from '../src/modules/match/engine/types';

const NOW = new Date('2026-09-28T00:00:00Z');
const future = (months: number) => {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

const student: EngineStudent = {
  id: 's-prereq',
  passport_status: 'held',
  academic: [
    { level: 'Bachelor', course: 'Bachelor of Computer Engineering', gpa_value: 3.6, gpa_scale: '4.0', end_year: 2021 },
  ],
  language_tests: [{ test: 'IELTS', overall: 7.5 }],
  work: [],
  career_goal: {
    target_occupation: 'Data Engineer',
    intended_field: 'Applied Data Engineering',
    long_term: 'employment',
  },
  finance: {
    income_sources: [{ amount: 20_000, currency: 'AUD' }],
    assets: [{ amount: 180_000, currency: 'AUD', liquid: true }],
    liabilities: [],
  },
  dependants: [],
  visa_history: [],
  preferences: {
    preferred_countries: ['AU'],
    preferred_cities: ['Melbourne'],
    degree_level: 'Master',
    field: 'Applied Data Engineering',
    max_tuition_per_year: 40_000,
    tuition_currency: 'AUD',
    scholarship_required: false,
    ranking_matters: false,
    city_size: 'either',
  },
};

const uni: EngineUniversity = { id: 'u-1', name: 'Fixture Institute', country: 'AU', city: 'Melbourne', world_rank: 45 };

function course(prerequisites: string[]): EngineCourse {
  return {
    id: 'c-1',
    university_id: 'u-1',
    title: 'Master of Applied Data Engineering',
    degree_level: 'Master',
    field: 'Applied Data Engineering',
    duration_months: 24,
    tuition_fee: 32_000,
    application_deadline: future(3),
    next_intake_date: future(5),
    intakes: ['Feb', 'Jul'],
    entry: { min_gpa: 70, min_english_band: 6.5, prerequisites, work_experience_months: 0 },
    scholarships: [],
    career_outcomes: ['Data Engineer'],
  };
}

const profile = deriveProfile(student, 1);
const ko = (prereqs: string[]) => knockout(profile, student, course(prereqs), NOW);
const prereqCheck = (prereqs: string[]) =>
  ko(prereqs).checks.find((c) => c.rule === 'prerequisites');

describe('prerequisite knockout', () => {
  it('does not knock out a generic prerequisite the student plainly satisfies', () => {
    const res = ko(['Undergraduate degree in any discipline']);
    expect(res.passed).toBe(true);
    expect(res.reasons).toEqual([]);
    expect(prereqCheck(['Undergraduate degree in any discipline'])?.status).toBe('unknown');
  });

  it('passes a specific prerequisite the student evidences', () => {
    const p = ['Undergraduate degree in computing, engineering or a quantitative discipline'];
    expect(ko(p).passed).toBe(true);
    expect(prereqCheck(p)?.status).toBe('pass');
  });

  it('still knocks out a specific prerequisite with no overlap at all', () => {
    const p = ['Registered nursing qualification and current clinical practice'];
    const res = ko(p);
    expect(res.passed).toBe(false);
    expect(res.reasons[0]).toContain('Prerequisite not evidenced');
    expect(prereqCheck(p)?.status).toBe('fail');
  });

  it('judges on the specific prerequisites only, ignoring generic ones alongside', () => {
    // A course listing both must be decided by the one that names a subject.
    const p = ['Undergraduate degree in any discipline', 'Prior study in engineering'];
    expect(ko(p).passed).toBe(true);
    expect(prereqCheck(p)?.status).toBe('pass');

    const q = ['Undergraduate degree in any discipline', 'Prior study in veterinary medicine'];
    expect(ko(q).passed).toBe(false);
    expect(prereqCheck(q)?.status).toBe('fail');
  });

  it('treats a requirement made only of scaffolding words as unknown', () => {
    // "Relevant prior work experience" names no subject; matching on "relevant"
    // or "experience" would be matching on the sentence, not the requirement.
    const p = ['Relevant prior work experience required'];
    expect(ko(p).passed).toBe(true);
    expect(prereqCheck(p)?.status).toBe('unknown');
  });

  it('keeps the course rankable — an unknown prerequisite is not a zero score', () => {
    const res = score(profile, student, course(['Undergraduate degree in any discipline']), uni, DEFAULT_WEIGHTS, NOW);
    expect(res.knockout).toBe(false);
    expect(res.overall).toBeGreaterThan(0);
    // It is still surfaced for a human rather than silently passed.
    expect(res.missing_info.some((m) => /Confirm prerequisites/.test(m))).toBe(true);
  });
});
