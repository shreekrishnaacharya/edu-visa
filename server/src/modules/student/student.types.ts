// ---------------------------------------------------------------------------
// The nested JSON shape the frontend reads/writes for a student — identical to
// `Student` in src/mocks/types.ts.  StudentMapper converts between this and the
// normalised entities.
// ---------------------------------------------------------------------------

import {
  Country,
  Currency,
  DegreeLevel,
  EnglishTest,
  GpaScale,
  LongTermGoal,
  PassportStatus,
  StudentState,
} from '../../common/enums';

export interface StudentAggregate {
  id?: string;
  full_name: string;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other';
  nationality: string;
  current_city: string;
  passport_status: PassportStatus;
  marital_status: 'single' | 'married';
  dependants: {
    id?: string;
    relationship: 'spouse' | 'child' | 'parent' | 'other';
    full_name: string;
    date_of_birth: string | null;
    accompanying: boolean;
    passport_status: PassportStatus;
  }[];
  state: StudentState;
  counsellor: string;
  branch: string;
  consent_given_at: string | null;

  academic: {
    id?: string;
    level: DegreeLevel | 'High School';
    course: string;
    institution: string;
    country: string;
    start_year: number;
    end_year: number;
    gpa_value: number;
    gpa_scale: GpaScale;
    gap_months: number;
  }[];
  language_tests: {
    id?: string;
    test: EnglishTest;
    overall: number;
    listening?: number | null;
    reading?: number | null;
    writing?: number | null;
    speaking?: number | null;
    test_date: string | null;
  }[];
  work: {
    id?: string;
    title: string;
    employer: string;
    industry: string;
    country: string;
    start_date: string;
    end_date: string | null;
    full_time: boolean;
    relevant: boolean;
  }[];
  career_goal: {
    target_occupation: string;
    target_industry: string;
    intended_field: string;
    reason: string;
    change_field: boolean;
    long_term: LongTermGoal;
  };
  finance: {
    income_sources: { id?: string; kind: string; amount: number; currency: Currency; evidence: boolean }[];
    assets: { id?: string; kind: string; amount: number; currency: Currency; liquid: boolean }[];
    liabilities: { id?: string; kind: string; amount: number; currency: Currency; monthly_repayment: number | null }[];
  };
  sponsors: {
    id?: string;
    relationship: string;
    occupation: string;
    annual_income: number;
    currency: Currency;
    evidence: boolean;
  }[];
  visa_history: {
    id?: string;
    country: string;
    visa_type: string;
    outcome: 'granted' | 'refused' | 'withdrawn';
    decision_date: string | null;
    refusal_reason?: string | null;
  }[];
  preferences: {
    preferred_countries: Country[];
    preferred_cities: string[];
    degree_level: DegreeLevel;
    field: string;
    max_tuition_per_year: number;
    tuition_currency: Currency;
    intake: string;
    scholarship_required: boolean;
    min_scholarship_pct: number;
    ranking_matters: boolean;
    city_size: 'big' | 'small' | 'either';
    cost_sensitivity: 'low' | 'high';
    part_time_work_important: boolean;
  };
}
