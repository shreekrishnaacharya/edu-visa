import { EnglishTest } from '../../common/enums';

/**
 * Value object embedded on `course` as a jsonb column.  It is always loaded with
 * the course and never queried on its own, so it is not a separate table
 * (the one modelling deviation from PRODUCT_PLAN §3 — noted in the plan file).
 */
export interface EntryRequirement {
  /**
   * `null` = never sourced from the institution, NOT "no requirement". CRICOS
   * publishes neither bar, so anything not scraped from the provider's own
   * admissions page stays null and the engine skips that gate rather than
   * inventing a number (a `0` sentinel silently *passed* the gate, which let an
   * unsourced course look like it had no English bar at all).
   */
  min_gpa: number | null; // canonical 0-100
  min_english_band: number | null; // canonical IELTS-equivalent, e.g. 6.5
  accepted_tests: EnglishTest[];
  prerequisites: string[];
  work_experience_months: number;
  /**
   * Where the bands came from: the provider admissions page they were read
   * off, or `unverified_aggregator` when only a third party published them.
   * null while unsourced, which is the CRICOS-import default.
   */
  requirement_source: string | null;
}

export const EMPTY_ENTRY_REQUIREMENT: EntryRequirement = {
  min_gpa: null,
  min_english_band: null,
  accepted_tests: ['IELTS', 'PTE', 'TOEFL'],
  prerequisites: [],
  work_experience_months: 0,
  requirement_source: null,
};
