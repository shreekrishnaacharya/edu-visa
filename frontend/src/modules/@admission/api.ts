import { axiosInstance } from "../../_service/axious";
import { BASE_URL } from "@common/options";

/**
 * Admission-policy reads. These are the real per-institution rules the
 * deterministic eligibility checker runs against — sponsor composition caps,
 * income floors, bank exclusions, backlog and marriage rules — none of which
 * had any readable UI before: they were only viewable as raw JSON inside a
 * super-admin edit dialog.
 */

export type ProgramLevel = "UG" | "PG" | "PG_RESEARCH" | "PATHWAY";

export interface AcademicBand {
  level: ProgramLevel;
  label: string;
  min_canonical_score: number | null;
  source_expression?: string;
  min_ielts_overall: number | null;
  min_ielts_band: number | null;
  min_pte_overall: number | null;
  min_pte_band: number | null;
  notes?: string[];
}

export interface SponsorRule {
  relation: string;
  max_percent: number | null;
  min_percent: number | null;
  status: "accepted" | "recommended" | "conditional" | "not_accepted";
  note?: string;
}

export interface IncomeThreshold {
  scenario: string;
  min_annual_npr_lakh: number | null;
  min_annual_aud: number | null;
}

export interface ScholarshipTier {
  level: ProgramLevel;
  label: string;
  min_canonical_score: number;
  pct: number;
  note?: string;
}

/** Mirrors server `AdmissionPolicy`; every field optional since policies differ. */
export interface AdmissionPolicy {
  key: string;
  institution: string;
  also_covers?: string[];
  scope?: string;
  source?: string;
  effective_date?: string;
  academics?: AcademicBand[];
  age_limit?: { ug_max?: number; pg_max?: number; research_max_low?: number; research_max_high?: number; note?: string };
  backlog_limit?: string[];
  max_backlogs?: { level: ProgramLevel; count: number; note?: string }[];
  study_gap_rules?: string[];
  max_study_gap_months?: { level: ProgramLevel; months: number; note?: string }[];
  marriage_rules?: string[];
  min_marriage_months?: number;
  spouse_qualification_rule?: { required_equal: boolean; min_level?: string; note?: string };
  double_masters_policy?: string;
  visa_refusal_policy?: string;
  sponsors?: SponsorRule[];
  max_sponsors?: number;
  income_thresholds?: IncomeThreshold[];
  fund_seasoning_months?: number;
  excluded_banks?: string[];
  income_source_notes?: string[];
  scholarships?: string[];
  scholarship_tiers?: ScholarshipTier[];
  excluded_regions?: string[];
  gs_notes?: string[];
  document_checklist?: string[];
  campus_programs?: { campus: string; programs: string[] }[];
  processing_turnaround?: { offer?: string; gs?: string; coe?: string; note?: string };
  contact_emails?: { label: string; email: string }[];
  country_tier_notes?: string[];
  other_notes?: string[];
}

export interface PolicySummary {
  key: string;
  institution: string;
  also_covers?: string[];
  scope?: string;
  source?: string;
  review_status: "ai_drafted" | "reviewed";
}

export async function listPolicies(): Promise<PolicySummary[]> {
  const { data } = await axiosInstance.get<PolicySummary[]>(`${BASE_URL}/admission/institutions`);
  return data;
}

/** The detail endpoint returns the policy object itself, plus review metadata. */
export async function getPolicy(
  key: string,
): Promise<AdmissionPolicy & { review_status?: PolicySummary["review_status"] }> {
  const { data } = await axiosInstance.get(`${BASE_URL}/admission/institutions/${key}`);
  return data?.data ? { ...data.data, review_status: data.review_status } : data;
}

export async function savePolicy(key: string, body: unknown): Promise<void> {
  await axiosInstance.patch(`${BASE_URL}/admission/institutions/${key}`, body);
}

/** How much of a policy is actually filled in — drives the coverage column. */
export function policyFilledSections(p: AdmissionPolicy): string[] {
  const filled: string[] = [];
  const has = (v: unknown) =>
    Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "";
  if (has(p.academics)) filled.push("academic bands");
  if (has(p.scholarships) || has(p.scholarship_tiers)) filled.push("scholarships");
  if (has(p.sponsors)) filled.push("sponsors");
  if (has(p.income_thresholds)) filled.push("income");
  if (has(p.excluded_banks) || has(p.fund_seasoning_months)) filled.push("funds");
  if (has(p.gs_notes)) filled.push("GS notes");
  if (has(p.document_checklist)) filled.push("checklist");
  if (has(p.marriage_rules) || has(p.backlog_limit) || has(p.study_gap_rules)) filled.push("applicant rules");
  return filled;
}

export const SPONSOR_STATUS_COLOR: Record<
  SponsorRule["status"],
  "success" | "info" | "warning" | "error"
> = {
  accepted: "success",
  recommended: "info",
  conditional: "warning",
  not_accepted: "error",
};

export const LEVEL_LABELS: Record<ProgramLevel, string> = {
  UG: "Undergraduate",
  PG: "Postgraduate (coursework)",
  PG_RESEARCH: "Postgraduate (research)",
  PATHWAY: "Pathway / foundation",
};
