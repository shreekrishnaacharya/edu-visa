// ---------------------------------------------------------------------------
// Golden test: the ported backend engine must produce the SAME numbers as the
// prototype's engine (src/mocks/engine/*) for the named student fixtures.
// This is what lets us call the port "verbatim" (plan §F / verification #3).
//
// Tolerated differences: knockout / knockout_reasons (the backend adds two
// knockout rules the prototype was missing — plan §4.1), and `overall` when
// exactly one side knocks a course out.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-var-requires */
import { deriveProfile as protoDerive } from '../../frontend/src/mocks/engine/derive';
import { score as protoScore } from '../../frontend/src/mocks/engine/score';
import { DEFAULT_WEIGHTS as PROTO_WEIGHTS } from '../../frontend/src/mocks/engine/weights';
import { students as protoStudents } from '../../frontend/src/mocks/db/students';
import { courses as protoCourses } from '../../frontend/src/mocks/db/courses';
import { universities as protoUnis } from '../../frontend/src/mocks/db/universities';

import { deriveProfile as beDerive } from '../src/modules/match/engine/derive';
import { score as beScore } from '../src/modules/match/engine/score';
import { DEFAULT_WEIGHTS as BE_WEIGHTS } from '../src/modules/match/engine/weights';
import {
  EngineCourse,
  EngineStudent,
  EngineUniversity,
} from '../src/modules/match/engine/types';

function toEngineStudent(s: any): EngineStudent {
  return {
    id: s.id,
    passport_status: s.passport_status,
    academic: s.academic.map((a: any) => ({
      level: a.level,
      course: a.course,
      gpa_value: a.gpa_value,
      gpa_scale: a.gpa_scale,
      end_year: a.end_year,
    })),
    language_tests: s.language_tests.map((t: any) => ({ test: t.test, overall: t.overall })),
    work: s.work.map((w: any) => ({
      start_date: w.start_date,
      end_date: w.end_date,
      relevant: w.relevant,
    })),
    career_goal: {
      target_occupation: s.career_goal.target_occupation,
      intended_field: s.career_goal.intended_field,
      long_term: s.career_goal.long_term,
    },
    finance: {
      income_sources: s.finance.income_sources.map((i: any) => ({ amount: i.amount, currency: i.currency })),
      assets: s.finance.assets.map((a: any) => ({ amount: a.amount, currency: a.currency, liquid: a.liquid })),
      liabilities: s.finance.liabilities.map((l: any) => ({ amount: l.amount, currency: l.currency })),
    },
    dependants: s.dependants.map((d: any) => ({ accompanying: d.accompanying })),
    visa_history: s.visa_history.map((v: any) => ({ outcome: v.outcome })),
    preferences: {
      preferred_countries: s.preferences.preferred_countries,
      preferred_cities: s.preferences.preferred_cities,
      degree_level: s.preferences.degree_level,
      field: s.preferences.field,
      max_tuition_per_year: s.preferences.max_tuition_per_year,
      tuition_currency: s.preferences.tuition_currency,
      scholarship_required: s.preferences.scholarship_required,
      ranking_matters: s.preferences.ranking_matters,
      city_size: s.preferences.city_size,
    },
  };
}

const toEngineCourse = (c: any): EngineCourse => ({
  id: c.id,
  university_id: c.university_id,
  title: c.title,
  degree_level: c.degree_level,
  field: c.field,
  duration_months: c.duration_months,
  tuition_fee: c.tuition_fee,
  application_deadline: c.application_deadline,
  next_intake_date: c.next_intake_date,
  intakes: c.intakes,
  entry: {
    min_gpa: c.entry.min_gpa,
    min_english_band: c.entry.min_english_band,
    prerequisites: c.entry.prerequisites,
    work_experience_months: c.entry.work_experience_months,
  },
  scholarships: c.scholarships.map((s: any) => ({ name: s.name, pct: s.pct, min_gpa: s.min_gpa })),
  career_outcomes: c.career_outcomes,
});

const toEngineUni = (u: any): EngineUniversity => ({
  id: u.id,
  name: u.name,
  country: u.country,
  city: u.city,
  world_rank: u.world_rank,
});

const NAMED = protoStudents.filter((s: any) => /^s-00[1-6]$/.test(s.id));
const uniById = new Map(protoUnis.map((u: any) => [u.id, u]));
const NOW = new Date();

describe('ported engine matches the prototype engine', () => {
  test.each(NAMED.map((s: any) => [s.full_name, s] as const))(
    'deriveProfile — %s',
    (_name, student) => {
      const proto = protoDerive(student as any, 1);
      const be = beDerive(toEngineStudent(student), 1);
      expect(be).toEqual(proto);
    },
  );

  test('DEFAULT_WEIGHTS unchanged', () => {
    expect(BE_WEIGHTS).toEqual(PROTO_WEIGHTS);
  });

  test.each(NAMED.map((s: any) => [s.full_name, s] as const))(
    'score subscores + overall — %s',
    (_name, student) => {
      const protoProfile = protoDerive(student as any, 1);
      const beProfile = beDerive(toEngineStudent(student), 1);
      const beStudent = toEngineStudent(student);

      for (const c of protoCourses) {
        const uni = uniById.get(c.university_id);
        const p = protoScore(protoProfile, student as any, c as any, uni as any, PROTO_WEIGHTS);
        const b = beScore(
          beProfile,
          beStudent,
          toEngineCourse(c),
          toEngineUni(uni),
          BE_WEIGHTS,
          NOW,
        );

        expect(b.subscores).toEqual(p.subscores);
        expect(b.scholarship_potential).toEqual(p.scholarship_potential);
        expect(b.scholarship_opportunities).toEqual(p.scholarship_opportunities);

        // overall only has to agree when the two engines agree on knockout
        if (b.knockout === p.knockout) {
          expect(b.overall).toEqual(p.overall);
          expect(b.why).toEqual(p.why);
          expect(b.concerns).toEqual(p.concerns);
        } else {
          // the backend is stricter — it must be the one knocking out
          expect(b.knockout).toBe(true);
        }
      }
    },
  );
});
