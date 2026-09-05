// ---------------------------------------------------------------------------
// Edu-Visa domain types — shared by the dummy data, the client-side matching
// engine, and every screen. In production these mirror the NestJS entities and
// the `MatchResult` contract documented in docs/PRODUCT_PLAN.md §4.
// ---------------------------------------------------------------------------

export type Country = "AU" | "NZ" | "UK" | "CA" | "US";
export type DegreeLevel = "Bachelor" | "PG Diploma" | "Master" | "PhD";
export type EnglishTest = "IELTS" | "PTE" | "TOEFL" | "Duolingo";
export type GpaScale = "4.0" | "10.0" | "percentage" | "division";
export type Currency = "NPR" | "AUD" | "GBP" | "CAD" | "USD";
export type PrIntent = "low" | "medium" | "high";
export type StudentState = "Enquiry" | "Profiling" | "Shortlisted" | "Applied";

// ---- Side A : the student file --------------------------------------------

export interface AcademicRecord {
  id: string;
  level: DegreeLevel | "High School";
  course: string;
  institution: string;
  country: string;
  start_year: number;
  end_year: number;
  gpa_value: number;
  gpa_scale: GpaScale;
  gap_months: number;
}

export interface LanguageTest {
  id: string;
  test: EnglishTest;
  overall: number;
  listening?: number;
  reading?: number;
  writing?: number;
  speaking?: number;
  test_date: string; // ISO
}

export interface WorkExperience {
  id: string;
  title: string;
  employer: string;
  industry: string;
  country: string;
  start_date: string;
  end_date: string | null;
  full_time: boolean;
  relevant: boolean;
}

export interface CareerGoal {
  target_occupation: string;
  target_industry: string;
  intended_field: string;
  reason: string;
  change_field: boolean;
  long_term: "employment" | "PR" | "return home" | "business" | "further study";
}

export interface IncomeSource {
  id: string;
  kind: "father" | "mother" | "spouse" | "self" | "business" | "rental" | "other";
  amount: number;
  currency: Currency;
  evidence: boolean;
}
export interface Asset {
  id: string;
  kind: "bank savings" | "fixed deposit" | "education loan" | "property" | "sponsor" | "other";
  amount: number;
  currency: Currency;
  liquid: boolean;
}
export interface Liability {
  id: string;
  kind: string;
  amount: number;
  currency: Currency;
  monthly_repayment: number;
}
export interface FinancialProfile {
  income_sources: IncomeSource[];
  assets: Asset[];
  liabilities: Liability[];
}

export interface Sponsor {
  id: string;
  relationship: string;
  occupation: string;
  annual_income: number;
  currency: Currency;
  evidence: boolean;
}

export interface VisaHistory {
  id: string;
  country: string;
  visa_type: string;
  outcome: "granted" | "refused" | "withdrawn";
  decision_date: string;
  refusal_reason?: string;
}

export interface Dependant {
  id: string;
  relationship: "spouse" | "child" | "parent" | "other";
  full_name: string;
  date_of_birth: string;
  /** travelling with the student — adds to the visa financial-capacity requirement */
  accompanying: boolean;
  passport_status: "none" | "applied" | "held";
}

export type FollowUpKind = "note" | "call" | "email" | "meeting" | "document";

export interface Attachment {
  id: string;
  name: string;
  type: string; // MIME
  size: number; // bytes
  /** prototype: the file is inlined as a data: URL. Real build stores a file ref. */
  data_url: string;
}

/** A counsellor's follow-up / activity entry against a student. */
export interface FollowUp {
  id: string;
  student_id: string;
  kind: FollowUpKind;
  body: string;
  author: string;
  created_at: string;
  attachments: Attachment[];
}

/** An uploaded document filed against a student. */
export interface StudentDocument {
  id: string;
  student_id: string;
  /** e.g. "Bank statement", "Financial document" — free text with presets */
  doc_type: string;
  remark: string;
  file: Attachment;
  uploaded_by: string;
  created_at: string;
}

export interface Preferences {
  preferred_countries: Country[];
  preferred_cities: string[];
  degree_level: DegreeLevel;
  field: string;
  max_tuition_per_year: number;
  tuition_currency: Currency;
  intake: string; // e.g. "Feb 2026"
  scholarship_required: boolean;
  min_scholarship_pct: number;
  ranking_matters: boolean;
  city_size: "big" | "small" | "either";
  cost_sensitivity: "low" | "high";
  part_time_work_important: boolean;
}

export interface Student {
  id: string;
  full_name: string;
  date_of_birth: string;
  gender: "male" | "female" | "other";
  nationality: string;
  current_city: string;
  passport_status: "none" | "applied" | "held";
  marital_status: "single" | "married";
  dependants: Dependant[];
  state: StudentState;
  counsellor: string;
  branch: string;
  created_at: string;
  consent_given_at: string | null;

  academic: AcademicRecord[];
  language_tests: LanguageTest[];
  work: WorkExperience[];
  career_goal: CareerGoal;
  finance: FinancialProfile;
  sponsors: Sponsor[];
  visa_history: VisaHistory[];
  preferences: Preferences;
}

// ---- Side B : the course catalogue --------------------------------------

export interface Scholarship {
  id: string;
  name: string;
  pct: number; // % of tuition
  criteria: string;
  min_gpa: number; // on canonical 0-100
}

export interface EntryRequirement {
  min_gpa: number; // canonical 0-100
  min_english_band: number; // canonical IELTS-equivalent band, e.g. 6.5
  accepted_tests: EnglishTest[];
  prerequisites: string[];
  work_experience_months: number;
}

export interface Course {
  id: string;
  university_id: string;
  /** denormalised from the university, for the catalogue grid + filtering */
  university_name: string;
  country: Country;
  city: string;
  world_rank: number;
  title: string;
  degree_level: DegreeLevel;
  field: string;
  duration_months: number;
  tuition_fee: number; // per year
  currency: Currency;
  intakes: string[]; // ["Feb", "Jul"]
  next_intake_date: string; // ISO
  application_deadline: string; // ISO
  entry: EntryRequirement;
  scholarships: Scholarship[];
  career_outcomes: string[];
  cricos: string;
}

export interface University {
  id: string;
  name: string;
  country: Country;
  city: string;
  world_rank: number;
  logo_hue: number; // 0-360, for a generated monogram
}

// ---- Derived + match --------------------------------------------------------

export interface StudentProfile {
  student_id: string;
  version: number;
  canonical_gpa: number; // 0-100
  english_band: number | null; // canonical IELTS-equivalent
  english_source: string;
  relevant_experience_months: number;
  annual_household_income_aud: number;
  available_funds_aud: number;
  affordability_score: number; // 0-100
  pr_intent: PrIntent;
  highest_level: AcademicRecord["level"] | null;
  field_of_study: string;
}

export type MatchDimension =
  | "academic"
  | "english"
  | "financial"
  | "career"
  | "location"
  | "scholarship";

export type MatchWeights = Record<MatchDimension, number>;

export interface MatchResult {
  course_id: string;
  university_id: string;
  overall: number; // 0-100
  subscores: Record<MatchDimension, number>;
  scholarship_potential: "none" | "low" | "medium" | "high";
  why: string[];
  concerns: string[];
  missing_info: string[];
  documents_required: string[];
  scholarship_opportunities: string[];
  alternatives: string[];
  knockout: boolean;
  knockout_reasons: string[];
}

export interface MatchRun {
  id: string;
  student_id: string;
  profile_version: number;
  engine_version: string;
  weights: MatchWeights;
  created_at: string;
  created_by: string;
  results: MatchResult[];
  profile: StudentProfile;
}
