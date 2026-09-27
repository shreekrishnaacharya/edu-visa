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
  /** null = not sourced from the institution; the matching gate is skipped. */
  min_gpa: number | null;
  min_english_band: number | null;
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
  /**
   * Cities where THIS course is actually taught. A provider operating in a city
   * does not mean every one of its courses runs there — CQU teaches in 11 cities
   * but only 47 of its 79 courses in Melbourne — so this is what location
   * matching should use, falling back to the provider's campuses when the
   * register lists none for the course.
   */
  campus_cities?: string[];
}

export interface EngineUniversity {
  id: string;
  name: string;
  country: Country;
  /**
   * The primary campus's city — the fallback for a course whose teaching
   * locations the register does not list. Per-course availability lives on
   * `EngineCourse.campus_cities`, which is what location matching actually uses.
   */
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
