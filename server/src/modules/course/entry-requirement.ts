import { EnglishTest } from '../../common/enums';

/**
 * Value object embedded on `course` as a jsonb column.  It is always loaded with
 * the course and never queried on its own, so it is not a separate table
 * (the one modelling deviation from PRODUCT_PLAN §3 — noted in the plan file).
 */
export interface EntryRequirement {
  min_gpa: number; // canonical 0-100
  min_english_band: number; // canonical IELTS-equivalent, e.g. 6.5
  accepted_tests: EnglishTest[];
  prerequisites: string[];
  work_experience_months: number;
}

export const EMPTY_ENTRY_REQUIREMENT: EntryRequirement = {
  min_gpa: 0,
  min_english_band: 0,
  accepted_tests: ['IELTS', 'PTE', 'TOEFL'],
  prerequisites: [],
  work_experience_months: 0,
};
