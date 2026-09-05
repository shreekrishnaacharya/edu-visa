// ---------------------------------------------------------------------------
// The plain shapes the engine operates on — reassembled from the normalised
// entities by MatchService.  These mirror the frontend's src/mocks/types.ts so
// the ported derive/score logic stays literal.
// ---------------------------------------------------------------------------

import {
  AcademicLevel,
  Country,
  Currency,
  DegreeLevel,
  EnglishTest,
  GpaScale,
  LongTermGoal,
  MatchDimension,
  PrIntent,
} from '../../../common/enums';

export interface EAcademicRecord {
  level: AcademicLevel;
  course: string;
  gpa_value: number;
  gpa_scale: GpaScale;
  end_year: number;
}

export interface ELanguageTest {
  test: EnglishTest;
  overall: number;
}

export interface EWorkExperience {
  start_date: string;
  end_date: string | null;
  relevant: boolean;
}

export interface ECareerGoal {
  target_occupation: string;
  intended_field: string;
  long_term: LongTermGoal;
}

export interface EMoney {
  amount: number;
  currency: Currency;
}

export interface EFinance {
  income_sources: EMoney[];
  assets: (EMoney & { liquid: boolean })[];
  liabilities: EMoney[];
}

export interface EDependant {
  accompanying: boolean;
}

export interface EVisaHistory {
  outcome: 'granted' | 'refused' | 'withdrawn';
}

export interface EPreferences {
  preferred_countries: Country[];
  preferred_cities: string[];
  degree_level: DegreeLevel;
  field: string;
  max_tuition_per_year: number;
  tuition_currency: Currency;
  scholarship_required: boolean;
  ranking_matters: boolean;
  city_size: 'big' | 'small' | 'either';
}

export interface EngineStudent {
  id: string;
  passport_status: 'none' | 'applied' | 'held';
  academic: EAcademicRecord[];
  language_tests: ELanguageTest[];
  work: EWorkExperience[];
  career_goal: ECareerGoal;
  finance: EFinance;
  dependants: EDependant[];
  visa_history: EVisaHistory[];
  preferences: EPreferences;
}

export interface EScholarship {
  name: string;
  pct: number;
  min_gpa: number;
}

export interface EEntryRequirement {
  min_gpa: number;
  min_english_band: number;
  prerequisites: string[];
  work_experience_months: number;
}

export interface EngineCourse {
  id: string;
  university_id: string;
  title: string;
  degree_level: DegreeLevel;
  field: string;
  duration_months: number;
  tuition_fee: number;
  application_deadline: string;
  next_intake_date: string;
  intakes: string[];
  entry: EEntryRequirement;
  scholarships: EScholarship[];
  career_outcomes: string[];
}

export interface EngineUniversity {
  id: string;
  name: string;
  country: Country;
  city: string;
  world_rank: number;
}

export interface DerivedProfile {
  student_id: string;
  version: number;
  canonical_gpa: number;
  english_band: number | null;
  english_source: string;
  relevant_experience_months: number;
  annual_household_income_aud: number;
  available_funds_aud: number;
  affordability_score: number;
  pr_intent: PrIntent;
  highest_level: AcademicLevel | null;
  field_of_study: string;
}

export type { MatchDimension };
