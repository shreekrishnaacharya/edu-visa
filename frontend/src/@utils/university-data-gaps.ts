import type { Course, University } from "@mocks/types";

export interface DataGap {
  label: string;
  severity: "warning" | "info";
}

interface AdmissionPolicySummary {
  review_status: "ai_drafted" | "reviewed";
}

/**
 * Computes the "what's missing" list for a university, shown as the
 * data-completeness indicator (PRODUCT_PLAN phase 9). Pure — reads only
 * what's already fetched by the caller, no extra requests. `policy` is
 * optional since only the show page fetches it today; the list view's chip
 * covers the CRICOS + course-level gaps only.
 */
export function computeUniversityGaps(university: University, policy?: AdmissionPolicySummary | null): DataGap[] {
  const gaps: DataGap[] = [];
  const stats = university.course_stats;

  if (!university.cricos_provider_code) {
    gaps.push({ label: "No CRICOS registration on file", severity: "info" });
  }
  if (!university.policy_key) {
    gaps.push({ label: "No admission policy on file", severity: "warning" });
  } else if (policy && policy.review_status === "ai_drafted") {
    gaps.push({ label: "Admission policy is AI-drafted, not yet reviewed", severity: "warning" });
  }
  if (stats && stats.total > 0) {
    if (stats.with_scholarships === 0) {
      gaps.push({ label: "No courses have scholarship data", severity: "warning" });
    } else if (stats.with_scholarships < stats.total) {
      gaps.push({ label: `${stats.total - stats.with_scholarships} of ${stats.total} courses have no scholarship data`, severity: "info" });
    }
    if (stats.unverified_fee > 0) {
      gaps.push({ label: `${stats.unverified_fee} of ${stats.total} courses have unverified fee data`, severity: "warning" });
    }
    if (stats.with_cricos < stats.total) {
      gaps.push({ label: `${stats.total - stats.with_cricos} of ${stats.total} courses have no CRICOS code`, severity: "info" });
    }
  }
  return gaps;
}

/** Same idea, per catalogue course row — no extra fetch, uses fields already on the row. */
export function computeCourseGaps(course: Course): DataGap[] {
  const gaps: DataGap[] = [];
  if (course.data_confidence === "unverified_aggregator") {
    gaps.push({ label: "Fee data is unverified (third-party aggregator)", severity: "warning" });
  }
  if (!course.scholarships?.length) {
    gaps.push({ label: "No scholarship data", severity: "info" });
  }
  if (!course.cricos) {
    gaps.push({ label: "No CRICOS code", severity: "info" });
  }
  return gaps;
}
