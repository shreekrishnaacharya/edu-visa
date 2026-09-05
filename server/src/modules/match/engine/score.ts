// ---------------------------------------------------------------------------
// knockout(profile, student, course) → hard filters (course leaves the pool)
// score(profile, student, course, uni, w) → per-dimension 0-100 + weighted
//   overall + templated reasons.  MatchResult is the shared contract
//   (PRODUCT_PLAN §4.4).
//
// Ported from the prototype's src/mocks/engine/score.ts.  The dimension
// scorers, the `alignment` gate and the `overall` formula are VERBATIM and
// pinned by the golden test.  Two knockout rules the prototype was missing are
// added here (PRODUCT_PLAN §4.1) and are clearly marked; the golden test
// tolerates stricter knockout reasons.
// ---------------------------------------------------------------------------

import { MatchWeights } from '../../../common/enums';
import { MatchResult } from '../match.types';
import {
  DerivedProfile,
  EngineCourse,
  EngineStudent,
  EngineUniversity,
  MatchDimension,
} from './types';
import { Currency } from '../../../common/enums';
import { FX_TO_AUD, toAud as toAudDefault } from './reference';
import { normalizeWeights } from './weights';

function makeToAud(fxRates: Record<Currency, number>) {
  return (amount: number, currency: Currency) =>
    fxRates === FX_TO_AUD ? toAudDefault(amount, currency) : Math.round(amount * fxRates[currency]);
}

const clamp = (n: number, lo = 0, hi = 100) =>
  Math.max(lo, Math.min(hi, Math.round(n)));

const PLANNING_WINDOW_MONTHS = 18;

export interface KnockoutResult {
  passed: boolean;
  reasons: string[];
}

export function knockout(
  profile: DerivedProfile,
  student: EngineStudent,
  course: EngineCourse,
  now: Date = new Date(),
  fxRates: Record<Currency, number> = FX_TO_AUD,
): KnockoutResult {
  const toAud = makeToAud(fxRates);
  const reasons: string[] = [];
  const budgetAud = toAud(
    student.preferences.max_tuition_per_year,
    student.preferences.tuition_currency,
  );

  if (course.tuition_fee > budgetAud * 1.05) {
    reasons.push(
      `Tuition AUD ${course.tuition_fee.toLocaleString()}/yr exceeds the stated budget of AUD ${budgetAud.toLocaleString()}/yr.`,
    );
  }
  if (profile.canonical_gpa + 3 < course.entry.min_gpa) {
    reasons.push(
      `Canonical GPA ${profile.canonical_gpa} is below the entry minimum of ${course.entry.min_gpa}.`,
    );
  }
  if (
    profile.english_band != null &&
    profile.english_band + 0.5 < course.entry.min_english_band
  ) {
    reasons.push(
      `English band ${profile.english_band} is below the required ${course.entry.min_english_band}.`,
    );
  }

  const deadlinePassed =
    new Date(course.application_deadline).getTime() < now.getTime();
  if (deadlinePassed) {
    reasons.push(
      `The application deadline (${course.application_deadline}) has passed.`,
    );
  }

  // --- ADDED (PRODUCT_PLAN §4.1): no open intake in the planning window -----
  if (!deadlinePassed) {
    const nextIntake = new Date(course.next_intake_date).getTime();
    const windowEnd =
      now.getTime() + PLANNING_WINDOW_MONTHS * 30.44 * 24 * 3600 * 1000;
    if (Number.isNaN(nextIntake) || nextIntake < now.getTime() || nextIntake > windowEnd) {
      reasons.push(
        `No open intake within the next ${PLANNING_WINDOW_MONTHS} months (next: ${course.next_intake_date || 'unknown'}).`,
      );
    }
  }

  // --- ADDED (PRODUCT_PLAN §4.1): unmet prerequisite ----------------------
  // Conservative: only knock out when the course lists prerequisites AND there
  // is zero lexical overlap with the student's academic background / goal.
  if (course.entry.prerequisites.length) {
    const haystack = [
      ...student.academic.map((a) => a.course),
      student.career_goal.intended_field,
      student.preferences.field,
    ]
      .join(' ')
      .toLowerCase();
    const anyOverlap = course.entry.prerequisites.some((p) =>
      p
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3)
        .some((w) => haystack.includes(w)),
    );
    if (!anyOverlap) {
      reasons.push(
        `Prerequisite not evidenced: ${course.entry.prerequisites.join(', ')}.`,
      );
    }
  }

  return { passed: reasons.length === 0, reasons };
}

// --- individual dimension scorers (VERBATIM from the prototype) -------------

function academicScore(
  p: DerivedProfile,
  c: EngineCourse,
  student: EngineStudent,
) {
  const margin = p.canonical_gpa - c.entry.min_gpa;
  let s = 62 + Math.max(-30, Math.min(margin, 22)) * 1.7;
  const order = ['Bachelor', 'PG Diploma', 'Master', 'PhD'];
  const want = order.indexOf(student.preferences.degree_level);
  const got = order.indexOf(c.degree_level);
  if (got < want) s -= 14 * (want - got);
  return clamp(s);
}

function englishScore(p: DerivedProfile, c: EngineCourse, missing: string[]) {
  if (p.english_band == null) {
    missing.push(
      'No English test on file — score assumes a test at the entry minimum.',
    );
    return 55;
  }
  const margin = p.english_band - c.entry.min_english_band;
  return clamp(70 + margin * 26);
}

function financialScore(
  p: DerivedProfile,
  student: EngineStudent,
  c: EngineCourse,
) {
  const years = c.duration_months / 12;
  const livingPerYear =
    29000 + student.dependants.filter((d) => d.accompanying).length * 8000;
  const total = c.tuition_fee * years + livingPerYear * years;
  const ratio = p.available_funds_aud / Math.max(1, total);
  return clamp(ratio * 78);
}

function careerScore(
  p: DerivedProfile,
  student: EngineStudent,
  c: EngineCourse,
) {
  let s = 34;
  const goalField = (
    student.career_goal.intended_field || student.preferences.field
  ).toLowerCase();
  const courseField = c.field.toLowerCase();
  const occHead = student.career_goal.target_occupation
    .split(' ')[0]
    .toLowerCase();

  if (
    goalField &&
    (courseField.includes(goalField) || goalField.includes(courseField))
  )
    s += 34;
  else if (c.career_outcomes.some((o) => o.toLowerCase().includes(occHead)))
    s += 20;
  else s -= 6;

  if (c.degree_level === student.preferences.degree_level) s += 14;
  else s -= 16;

  if (p.relevant_experience_months >= c.entry.work_experience_months) s += 10;
  else if (c.entry.work_experience_months > 0) s -= 15;

  if (
    student.career_goal.long_term === 'PR' &&
    [
      'Nursing',
      'Construction Management',
      'Information Technology',
      'Data Science',
      'Cybersecurity',
    ].includes(c.field)
  )
    s += 8;
  return clamp(s);
}

function locationScore(student: EngineStudent, uni: EngineUniversity) {
  let s = 50;
  if (student.preferences.preferred_countries.includes(uni.country)) s += 30;
  if (student.preferences.preferred_cities.includes(uni.city)) s += 15;
  if (student.preferences.ranking_matters && uni.world_rank <= 60) s += 10;
  if (
    student.preferences.city_size === 'big' &&
    ['Sydney', 'Melbourne', 'Toronto', 'Manchester', 'Auckland'].includes(
      uni.city,
    )
  )
    s += 5;
  return clamp(s);
}

function scholarshipScore(
  p: DerivedProfile,
  student: EngineStudent,
  c: EngineCourse,
  opps: string[],
) {
  if (c.scholarships.length === 0) {
    return student.preferences.scholarship_required ? 25 : 50;
  }
  let best = 0;
  for (const sch of c.scholarships) {
    const eligible = p.canonical_gpa >= sch.min_gpa;
    if (eligible) {
      opps.push(
        `${sch.name}: ${sch.pct}% of tuition — GPA ${p.canonical_gpa} meets the ${sch.min_gpa} threshold.`,
      );
      best = Math.max(best, 60 + sch.pct);
    } else {
      opps.push(
        `${sch.name}: ${sch.pct}% — needs GPA ${sch.min_gpa} (currently ${p.canonical_gpa}).`,
      );
      best = Math.max(best, 35);
    }
  }
  return clamp(best);
}

// --- main ------------------------------------------------------------------

export function score(
  profile: DerivedProfile,
  student: EngineStudent,
  course: EngineCourse,
  uni: EngineUniversity,
  weightsIn: MatchWeights,
  now: Date = new Date(),
  fxRates: Record<Currency, number> = FX_TO_AUD,
): MatchResult {
  const weights = normalizeWeights(weightsIn);
  const missing_info: string[] = [];
  const scholarship_opportunities: string[] = [];

  const subscores: Record<MatchDimension, number> = {
    academic: academicScore(profile, course, student),
    english: englishScore(profile, course, missing_info),
    financial: financialScore(profile, student, course),
    career: careerScore(profile, student, course),
    location: locationScore(student, uni),
    scholarship: scholarshipScore(
      profile,
      student,
      course,
      scholarship_opportunities,
    ),
  };

  const ko = knockout(profile, student, course, now, fxRates);

  const goalField = (
    student.career_goal.intended_field || student.preferences.field
  ).toLowerCase();
  const courseField = course.field.toLowerCase();
  const fieldRelated =
    (goalField &&
      (courseField.includes(goalField) || goalField.includes(courseField))) ||
    course.career_outcomes.some((o) =>
      o
        .toLowerCase()
        .includes(
          student.career_goal.target_occupation.split(' ')[0].toLowerCase(),
        ),
    );
  const levelMatch = course.degree_level === student.preferences.degree_level;
  const alignment = (levelMatch ? 1 : 0.9) * (fieldRelated ? 1 : 0.85);

  const weighted = (Object.keys(subscores) as MatchDimension[]).reduce(
    (sum, d) => sum + subscores[d] * weights[d],
    0,
  );
  const overall = ko.passed ? clamp(weighted * alignment) : 0;

  // ---- narrative (templated stand-in for the RAG + LLM report) ------------
  const why: string[] = [];
  const concerns: string[] = [];
  const documents_required = [
    'Academic transcripts and degree certificate',
    'English test score report',
    'Passport bio page',
    'Financial evidence (bank statements, loan sanction, sponsor documents)',
    'Statement of Purpose',
  ];

  if (subscores.academic >= 80)
    why.push(
      `Strong academic fit — GPA ${profile.canonical_gpa} is comfortably above the ${course.entry.min_gpa} entry bar.`,
    );
  else if (subscores.academic >= 65)
    why.push(`Academic profile meets entry requirements with modest headroom.`);
  else
    concerns.push(
      `Academic margin is thin against the ${course.entry.min_gpa} entry minimum — a strong SOP will matter.`,
    );

  if (subscores.english >= 85)
    why.push(`English is a clear strength (${profile.english_source}).`);
  else if (profile.english_band == null)
    concerns.push(`No English test on record — book IELTS/PTE before applying.`);
  else if (subscores.english < 60)
    concerns.push(
      `English band ${profile.english_band} leaves little room above the ${course.entry.min_english_band} requirement.`,
    );

  if (subscores.financial >= 80)
    why.push(
      `Financials are solid — available funds cover tuition and living costs for the course length.`,
    );
  else if (subscores.financial < 55)
    concerns.push(
      `Funds look tight for a ${course.duration_months}-month course; strengthen liquid savings or sponsor evidence.`,
    );

  if (subscores.career >= 78)
    why.push(
      `Course aligns with the goal of "${student.career_goal.target_occupation}" in ${student.career_goal.intended_field}.`,
    );
  else if (subscores.career < 55)
    concerns.push(
      `Weak link between "${course.title}" and the stated career goal — be ready to justify the switch.`,
    );

  if (course.entry.prerequisites.length) {
    missing_info.push(
      `Confirm prerequisites are met: ${course.entry.prerequisites.join(', ')}.`,
    );
  }
  if (student.passport_status !== 'held') {
    missing_info.push(
      `Passport is "${student.passport_status}" — required before lodging an application.`,
    );
  }
  if (student.visa_history.some((v) => v.outcome === 'refused')) {
    concerns.push(
      `Prior visa refusal on file — address it directly in the application (kept separate from the academic match score).`,
    );
  }

  const scholarship_potential: MatchResult['scholarship_potential'] =
    subscores.scholarship >= 80
      ? 'high'
      : subscores.scholarship >= 60
        ? 'medium'
        : subscores.scholarship >= 40
          ? 'low'
          : 'none';

  return {
    course_id: course.id,
    university_id: uni.id,
    overall,
    subscores,
    scholarship_potential,
    why,
    concerns,
    missing_info,
    documents_required,
    scholarship_opportunities,
    alternatives: [],
    knockout: !ko.passed,
    knockout_reasons: ko.reasons,
  };
}
