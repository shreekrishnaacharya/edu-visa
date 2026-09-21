/**
 * Real, institution-specific admission-eligibility criteria — distinct from
 * (and prior to) visa eligibility. This is the "biggest remaining data gap"
 * flagged after the CRICOS import (see server/data/cricos/README.md): CRICOS
 * publishes course/fee facts, never entry criteria, and this backend had
 * been using a single flat GPA/English estimate tiered only by world_rank
 * (`src/seed/cricos-import.ts` `entryDefaults()`).
 *
 * The 9 documents this module is built from are real agent-facing briefings
 * (institution partner-portal letters, GS/financial checklists) covering
 * institutions NOT in the current 8-university CRICOS catalogue — deliberately
 * kept as their own domain rather than forced into the `course.entry_requirement`
 * jsonb shape, because most of what they specify (sponsor composition caps,
 * bank exclusion lists, marriage-duration rules, excluded source regions) has
 * no equivalent field there and isn't really a "course" fact.
 *
 * Every numeric academic threshold below is normalised to the SAME canonical
 * 0-100 GPA scale the rest of this backend already computes on
 * `student_profile.canonical_gpa` (`match/engine/reference.ts toCanonicalGpa`),
 * so the eligibility service can compare directly against a real student's
 * derived profile: CGPA/4.0 * 100 (Nepal +2/bachelor CGPA convention — the
 * source docs say "2.80 CGPA" etc. without naming the scale; /4.0 is the
 * standard Nepal convention and is called out per-institution below where it
 * matters). A plain "%" figure needs no conversion.
 */

export type ProgramLevel = 'UG' | 'PG' | 'PG_RESEARCH' | 'PATHWAY';

/** Minimum-score gate for one program/level. `label` names the actual course(s) when the source gave per-course figures. */
export interface AcademicBand {
  level: ProgramLevel;
  label: string;
  /** Canonical 0-100 (see file header). Null when the source gave no academic figure for this band. */
  min_canonical_score: number | null;
  /** How the source actually expressed it, kept for the AI/UI to quote verbatim rather than only showing the converted number. */
  source_expression: string;
  min_ielts_overall: number | null;
  /** "no band less than X" — IELTS. */
  min_ielts_band: number | null;
  min_pte_overall: number | null;
  min_pte_band: number | null;
  notes?: string[];
}

export interface SponsorRule {
  relation: string;
  /** A CEILING — this relation type may contribute at most this % (secondary/limited sponsors: uncle/aunt, in-laws, siblings-as-secondary). */
  max_percent: number | null;
  /** A FLOOR — at least this % must come from this relation type (primary sponsors: parents/grandparents). Distinct from `max_percent` — several source docs state both a "minimum X% from parents" AND, implicitly, a cap on everyone else; conflating the two treats a 100%-from-parents student as a violation of a "minimum 70%" rule, which is backwards. */
  min_percent: number | null;
  status: 'accepted' | 'recommended' | 'conditional' | 'not_accepted';
  note?: string;
}

/** Deliberately NOT collapsed to one number — "single", "married applying single", "with dependant" etc. genuinely differ per institution. */
export interface IncomeThreshold {
  scenario: string;
  min_annual_npr_lakh: number | null;
  min_annual_aud: number | null;
}

export interface AdmissionPolicy {
  key: string;
  institution: string;
  also_covers?: string[];
  scope: string;
  source: string;
  effective_date?: string;
  academics: AcademicBand[];
  age_limit?: { ug_max?: number; pg_max?: number; research_max_low?: number; research_max_high?: number; note?: string };
  backlog_limit?: string[];
  study_gap_rules?: string[];
  /**
   * A hard, checkable gap ceiling — only populated where the source document
   * gave an actual number ("more than a 5-year gap... not acceptable"), never
   * inferred from the narrative `study_gap_rules` text. Most institutions
   * don't give one; leave unset rather than guess.
   */
  max_study_gap_months?: { level: ProgramLevel; months: number; note?: string }[];
  marriage_rules?: string[];
  /** Only set where a source gave an actual number ("minimum 12 months") — a blanket UG-reject-if-married rule stays in `marriage_rules`/is handled separately, this is purely the duration floor for levels where marriage IS accepted. */
  min_marriage_months?: number;
  /**
   * "Equal qualification" (a floor RELATIVE to the applicant's own level) vs
   * a flat minimum level (e.g. CQU's "+2 acceptable") are different claims —
   * kept as separate optional fields rather than one overloaded number, and
   * `required_equal: false` is itself meaningful (Torrens explicitly does
   * NOT require this) so it's surfaced too, not just omitted.
   */
  spouse_qualification_rule?: { required_equal: boolean; min_level?: 'High School' | 'Bachelor' | 'PG Diploma' | 'Master' | 'PhD'; note?: string };
  /**
   * A hard, checkable backlog ceiling for the PRIOR qualification that gates
   * entry to `level` (Year-12/High-School record for a UG application,
   * Bachelor record for a PG one) — only populated where the source gave an
   * actual number.
   */
  max_backlogs?: { level: ProgramLevel; count: number; note?: string }[];
  double_masters_policy?: string;
  visa_refusal_policy?: string;
  sponsors: SponsorRule[];
  max_sponsors?: number;
  income_thresholds: IncomeThreshold[];
  fund_seasoning_months?: number;
  excluded_banks?: string[];
  income_source_notes?: string[];
  scholarships?: string[];
  excluded_regions?: string[];
  gs_notes?: string[];
  document_checklist?: string[];
  other_notes: string[];
}
