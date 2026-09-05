import { AcademicLevel, MatchDimension, PrIntent } from '../../common/enums';

/**
 * THE shared contract.  Byte-identical to `MatchResult` in the frontend's
 * src/mocks/types.ts — the boundary the API, the UI and (later) the AI layer
 * all depend on.  PRODUCT_PLAN.md §4.4.
 */
export interface MatchResult {
  course_id: string;
  university_id: string;
  overall: number; // 0-100
  subscores: Record<MatchDimension, number>;
  scholarship_potential: 'none' | 'low' | 'medium' | 'high';
  why: string[];
  concerns: string[];
  missing_info: string[];
  documents_required: string[];
  scholarship_opportunities: string[];
  alternatives: string[];
  knockout: boolean;
  knockout_reasons: string[];
}

/** Derived profile as embedded in a MatchRun (mirrors StudentProfile entity). */
export interface StudentProfileSnapshot {
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
