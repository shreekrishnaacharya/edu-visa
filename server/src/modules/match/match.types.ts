import { AcademicLevel, MatchDimension, PrIntent } from '../../common/enums';

export type AdmissionCheckStatus = 'pass' | 'fail' | 'unknown' | 'info';

export interface AdmissionCheck {
  rule: string;
  status: AdmissionCheckStatus;
  detail: string;
  /**
   * On an `unknown` check: the requirement's main threshold is already met and
   * only this named evidence is outstanding. Distinguishes "pending one
   * document" from "cannot be assessed", which is what decides whether the
   * verdict reads `conditionally_eligible` or `insufficient_data`.
   */
  missing_evidence?: string;
}

/**
 * Always present on every MatchResult (PRODUCT_PLAN phase 4) — the PRIMARY
 * gate a course must clear before its dimension subscores are worth reading.
 * `source: 'real_policy'` = a genuine institution admission-eligibility check
 * (the 9 PDF-sourced institutions, admission-policy.data.ts); `'catalogue_entry_requirement'`
 * = synthesized from the same generic budget/GPA/English/deadline/prerequisite
 * checks `knockout()` already computes for every other catalogue course —
 * nothing invented, just restructured into the same per-rule shape.
 */
export interface AdmissionEligibility {
  policy_key: string | null;
  institution: string;
  source: 'real_policy' | 'catalogue_entry_requirement';
  overall: 'eligible' | 'not_eligible' | 'conditionally_eligible' | 'insufficient_data';
  checks: AdmissionCheck[];
  /**
   * Which academic band of the policy governed this course, and how the source
   * worded it. `evaluate()` always works this out; it used to be discarded when
   * the verdict was cached, so the report could only hint at the band inside a
   * detail string and never name it as data.
   */
  matched_band?: {
    level: string;
    label: string;
    min_canonical_score: number | null;
    source_expression?: string;
    min_ielts_overall: number | null;
    min_ielts_band: number | null;
  } | null;
  /**
   * Policy guidance a counsellor must read but that is not checkable — GS notes,
   * region/board restrictions (no student field exists for them), country-tier
   * rules. Never affects `overall`: modelling them as `info` checks would have
   * downgraded every verdict at those institutions to conditionally_eligible.
   */
  /**
   * What the institution's briefing states it covers — e.g. "Nepalese applicants
   * with a provisional offer". Applicability a counsellor needs to weigh the
   * document; only present for a real_policy verdict.
   */
  policy_scope?: string | null;
  advisory_notes?: {
    label: string;
    text: string;
    /** The country the note scopes itself to, when it names one. */
    scope_country: string | null;
    /** False when the note is scoped to a country other than this applicant's. */
    applies_to_applicant: boolean;
  }[];
  /**
   * Scholarship terms the institution's briefing states. Carried because the
   * scored `scholarship_potential` can only read `course.scholarships`, of which
   * the register supplies none — so a provider with real published scholarships
   * was reported as having none at all.
   */
  scholarship_notes?: string[];
}

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
  /** Presentation-only bucket derived from `overall` — see engine/run.ts. Null for closest-miss/knockout rows. */
  tier: 'reach' | 'target' | 'safety' | null;
  admission_eligibility: AdmissionEligibility;
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
