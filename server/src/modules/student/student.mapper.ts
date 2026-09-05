import { Student } from './entities/student.entity';
import { CareerGoal } from './entities/career-goal.entity';
import { Preferences } from './entities/preferences.entity';
import { StudentAggregate } from './student.types';
import { EngineStudent } from '../match/engine/types';

/** Entity graph → the nested JSON shape the frontend reads/writes. */
export function toAggregate(s: Student): StudentAggregate {
  return {
    id: s.id,
    full_name: s.full_name,
    date_of_birth: s.date_of_birth,
    gender: s.gender,
    nationality: s.nationality,
    current_city: s.current_city,
    passport_status: s.passport_status,
    marital_status: s.marital_status,
    dependants: (s.dependants ?? []).map((d) => ({
      id: d.id,
      relationship: d.relationship,
      full_name: d.full_name,
      date_of_birth: d.date_of_birth,
      accompanying: d.accompanying,
      passport_status: d.passport_status,
    })),
    state: s.state,
    counsellor: s.counsellor,
    branch: s.branch,
    consent_given_at: s.consent_given_at ? s.consent_given_at.toISOString() : null,
    academic: (s.academic ?? []).map((a) => ({
      id: a.id,
      level: a.level,
      course: a.course,
      institution: a.institution,
      country: a.country,
      start_year: a.start_year,
      end_year: a.end_year,
      gpa_value: a.gpa_value,
      gpa_scale: a.gpa_scale,
      gap_months: a.gap_months,
    })),
    language_tests: (s.language_tests ?? []).map((t) => ({
      id: t.id,
      test: t.test,
      overall: t.overall,
      listening: t.listening,
      reading: t.reading,
      writing: t.writing,
      speaking: t.speaking,
      test_date: t.test_date,
    })),
    work: (s.work ?? []).map((w) => ({
      id: w.id,
      title: w.title,
      employer: w.employer,
      industry: w.industry,
      country: w.country,
      start_date: w.start_date,
      end_date: w.end_date,
      full_time: w.full_time,
      relevant: w.relevant,
    })),
    career_goal: s.career_goal
      ? {
          target_occupation: s.career_goal.target_occupation,
          target_industry: s.career_goal.target_industry,
          intended_field: s.career_goal.intended_field,
          reason: s.career_goal.reason,
          change_field: s.career_goal.change_field,
          long_term: s.career_goal.long_term,
        }
      : {
          target_occupation: '',
          target_industry: '',
          intended_field: '',
          reason: '',
          change_field: false,
          long_term: 'employment',
        },
    finance: {
      income_sources: (s.income_sources ?? []).map((i) => ({
        id: i.id,
        kind: i.kind,
        amount: i.amount,
        currency: i.currency,
        evidence: i.evidence,
      })),
      assets: (s.assets ?? []).map((a) => ({
        id: a.id,
        kind: a.kind,
        amount: a.amount,
        currency: a.currency,
        liquid: a.liquid,
      })),
      liabilities: (s.liabilities ?? []).map((l) => ({
        id: l.id,
        kind: l.kind,
        amount: l.amount,
        currency: l.currency,
        monthly_repayment: l.monthly_repayment,
      })),
    },
    sponsors: (s.sponsors ?? []).map((sp) => ({
      id: sp.id,
      relationship: sp.relationship,
      occupation: sp.occupation,
      annual_income: sp.annual_income,
      currency: sp.currency,
      evidence: sp.evidence,
    })),
    visa_history: (s.visa_history ?? []).map((v) => ({
      id: v.id,
      country: v.country,
      visa_type: v.visa_type,
      outcome: v.outcome,
      decision_date: v.decision_date,
      refusal_reason: v.refusal_reason,
    })),
    preferences: s.preferences
      ? {
          preferred_countries: s.preferences.preferred_countries,
          preferred_cities: s.preferences.preferred_cities,
          degree_level: s.preferences.degree_level,
          field: s.preferences.field,
          max_tuition_per_year: s.preferences.max_tuition_per_year,
          tuition_currency: s.preferences.tuition_currency,
          intake: s.preferences.intake,
          scholarship_required: s.preferences.scholarship_required,
          min_scholarship_pct: s.preferences.min_scholarship_pct,
          ranking_matters: s.preferences.ranking_matters,
          city_size: s.preferences.city_size,
          cost_sensitivity: s.preferences.cost_sensitivity,
          part_time_work_important: s.preferences.part_time_work_important,
        }
      : {
          preferred_countries: [],
          preferred_cities: [],
          degree_level: 'Master',
          field: '',
          max_tuition_per_year: 0,
          tuition_currency: 'AUD',
          intake: '',
          scholarship_required: false,
          min_scholarship_pct: 0,
          ranking_matters: false,
          city_size: 'either',
          cost_sensitivity: 'high',
          part_time_work_important: false,
        },
  };
}

/**
 * Applies an incoming (possibly partial) aggregate onto an entity graph, in
 * place, ready for `studentRepo.save()`.  Arrays are REPLACED wholesale
 * (matches the prototype's `useFieldArray` intake form, and pairs with
 * `orphanedRowAction: 'delete'` on the Student relations).
 */
export function applyAggregate(s: Student, agg: Partial<StudentAggregate>): void {
  if (agg.full_name !== undefined) s.full_name = agg.full_name;
  if (agg.date_of_birth !== undefined) s.date_of_birth = agg.date_of_birth;
  if (agg.gender !== undefined) s.gender = agg.gender;
  if (agg.nationality !== undefined) s.nationality = agg.nationality;
  if (agg.current_city !== undefined) s.current_city = agg.current_city;
  if (agg.passport_status !== undefined) s.passport_status = agg.passport_status;
  if (agg.marital_status !== undefined) s.marital_status = agg.marital_status;
  if (agg.state !== undefined) s.state = agg.state;
  if (agg.counsellor !== undefined) s.counsellor = agg.counsellor;
  if (agg.branch !== undefined) s.branch = agg.branch;
  if (agg.consent_given_at !== undefined) {
    s.consent_given_at = agg.consent_given_at ? new Date(agg.consent_given_at) : null;
  }

  if (agg.dependants) s.dependants = agg.dependants.map((d) => sanitizeRow(d)) as any;
  if (agg.academic) s.academic = agg.academic.map((a) => sanitizeRow(a)) as any;
  if (agg.language_tests) s.language_tests = agg.language_tests.map((t) => sanitizeRow(t)) as any;
  if (agg.work) s.work = agg.work.map((w) => sanitizeRow(w)) as any;
  if (agg.sponsors) s.sponsors = agg.sponsors.map((sp) => sanitizeRow(sp)) as any;
  if (agg.visa_history) s.visa_history = agg.visa_history.map((v) => sanitizeRow(v)) as any;

  if (agg.career_goal) {
    s.career_goal = Object.assign(s.career_goal ?? new CareerGoal(), agg.career_goal);
  }
  if (agg.preferences) {
    s.preferences = Object.assign(s.preferences ?? new Preferences(), agg.preferences);
  }
  if (agg.finance) {
    if (agg.finance.income_sources) s.income_sources = agg.finance.income_sources.map((i) => sanitizeRow(i)) as any;
    if (agg.finance.assets) s.assets = agg.finance.assets.map((a) => sanitizeRow(a)) as any;
    if (agg.finance.liabilities) s.liabilities = agg.finance.liabilities.map((l) => sanitizeRow(l)) as any;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Nested rows come from the client as either an existing DB row (a real uuid
 * `id`, to update) or a brand-new row from the intake form's field-array
 * (`id` absent, or a client-side temp id like the prototype fixtures' "ac-1").
 * Only a real uuid is kept — anything else is dropped so TypeORM inserts a new
 * row instead of failing a uuid cast against the DB.
 */
function sanitizeRow<T extends { id?: string }>(row: T): T {
  const { id, ...rest } = row;
  return (id && UUID_RE.test(id) ? { id, ...rest } : rest) as T;
}

/** Entity graph → the flat shape the matching engine consumes. */
export function toEngineStudent(s: Student): EngineStudent {
  return {
    id: s.id,
    passport_status: s.passport_status,
    academic: (s.academic ?? []).map((a) => ({
      level: a.level,
      course: a.course,
      gpa_value: a.gpa_value,
      gpa_scale: a.gpa_scale,
      end_year: a.end_year,
    })),
    language_tests: (s.language_tests ?? []).map((t) => ({
      test: t.test,
      overall: t.overall,
    })),
    work: (s.work ?? []).map((w) => ({
      start_date: w.start_date,
      end_date: w.end_date,
      relevant: w.relevant,
    })),
    career_goal: {
      target_occupation: s.career_goal?.target_occupation ?? '',
      intended_field: s.career_goal?.intended_field ?? '',
      long_term: s.career_goal?.long_term ?? 'employment',
    },
    finance: {
      income_sources: (s.income_sources ?? []).map((i) => ({ amount: i.amount, currency: i.currency })),
      assets: (s.assets ?? []).map((a) => ({ amount: a.amount, currency: a.currency, liquid: a.liquid })),
      liabilities: (s.liabilities ?? []).map((l) => ({ amount: l.amount, currency: l.currency })),
    },
    dependants: (s.dependants ?? []).map((d) => ({ accompanying: d.accompanying })),
    visa_history: (s.visa_history ?? []).map((v) => ({ outcome: v.outcome })),
    preferences: {
      preferred_countries: s.preferences?.preferred_countries ?? [],
      preferred_cities: s.preferences?.preferred_cities ?? [],
      degree_level: s.preferences?.degree_level ?? 'Master',
      field: s.preferences?.field ?? '',
      max_tuition_per_year: s.preferences?.max_tuition_per_year ?? 0,
      tuition_currency: s.preferences?.tuition_currency ?? 'AUD',
      scholarship_required: s.preferences?.scholarship_required ?? false,
      ranking_matters: s.preferences?.ranking_matters ?? false,
      city_size: s.preferences?.city_size ?? 'either',
    },
  };
}
