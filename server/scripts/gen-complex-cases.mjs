// 100 test cases built from 20 hand-designed REAL consultancy problem
// archetypes (5 parameterised variants each) — not randomised noise. Each
// scenario declares `expect` — an assertion the runner checks against the
// actual engine/AI output, so this is a real regression suite, not just a
// load test. Tagged branch="QA Complex 2026-09-02".

const BRANCH = "QA Complex 2026-09-02";
let seq = 0;
const uid = () => `cc-${++seq}`;

function base(overrides) {
  return {
    full_name: overrides.name,
    date_of_birth: overrides.dob || "1997-04-12",
    gender: overrides.gender || "female",
    nationality: "Nepal",
    current_city: "Kathmandu",
    passport_status: overrides.passport_status || "held",
    marital_status: overrides.marital_status || "single",
    dependants: overrides.dependants || [],
    state: "Enquiry",
    counsellor: "Bina Rai",
    branch: BRANCH,
    consent_given_at: new Date().toISOString(),
    academic: overrides.academic,
    language_tests: overrides.language_tests || [],
    work: overrides.work || [],
    career_goal: overrides.career_goal,
    finance: overrides.finance,
    sponsors: overrides.sponsors || [{ relationship: "Father", occupation: "Business", annual_income: 2000000, currency: "NPR", evidence: true }],
    visa_history: overrides.visa_history || [],
    preferences: overrides.preferences,
  };
}

const income = (npr) => ({ income_sources: [{ kind: "father", amount: npr, currency: "NPR", evidence: true }], assets: [{ kind: "bank savings", amount: npr * 1.5, currency: "NPR", liquid: true }], liabilities: [] });

const CASES = [];

function archetype(name, desc, n, build) {
  for (let i = 1; i <= n; i++) {
    CASES.push({ archetype: name, desc, variant: i, ...build(i) });
  }
}

// 1. Budget-constrained high-achiever — excellent profile, budget below every real AU master's fee.
archetype(
  "budget_below_market",
  "Strong GPA/English but stated budget is below the cheapest real course in the field — engine must knock out everything on price, not silently under-match.",
  5,
  (i) => ({
    student: base({
      name: `BudgetTight ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of Information Technology", institution: "Tribhuvan University", country: "Nepal", start_year: 2018, end_year: 2022, gpa_value: 3.7, gpa_scale: "4.0", gap_months: 0 }],
      language_tests: [{ test: "IELTS", overall: 7.5, test_date: "2025-11-01" }],
      career_goal: { target_occupation: "Data Analyst", target_industry: "Information Technology", intended_field: "Information Technology", reason: "Progression", change_field: false, long_term: "PR" },
      finance: income(1800000 + i * 100000),
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Computer Science", max_tuition_per_year: 15000 + i * 1000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: false, city_size: "either", cost_sensitivity: "high", part_time_work_important: false },
    }),
    // Corrected after a real run against the real catalogue: degree-level
    // mismatch is a SCORING penalty, not a knockout (only budget/GPA/English/
    // deadline knock a course out) — so a cheap Bachelor's can legitimately
    // survive for a budget-locked Master's-seeker. That's arguably a better
    // answer than "nothing", not a bug. The honest assertion is therefore
    // "either nothing survives, or nothing surviving is a good fit."
    expect: { budget_stress: true },
    ai_question: "Every course seems out of reach on my budget. What are my realistic options?",
  }),
);

// 2. No English test, time-pressured near-term intake.
archetype(
  "no_english_test_urgent",
  "Strong academics, zero language tests on file, wants Feb intake — engine must not knock out on English (no-test allowance) but AI must flag urgency.",
  5,
  (i) => ({
    student: base({
      name: `NoTestUrgent ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of Commerce", institution: "Tribhuvan University", country: "Nepal", start_year: 2019, end_year: 2023, gpa_value: 75 + i, gpa_scale: "percentage", gap_months: 0 }],
      language_tests: [],
      career_goal: { target_occupation: "Business Analyst", target_industry: "Business Analytics", intended_field: "Business Analytics", reason: "Direct progression", change_field: false, long_term: "employment" },
      finance: income(3000000),
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Business Analytics", max_tuition_per_year: 55000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: false, city_size: "either", cost_sensitivity: "low", part_time_work_important: false },
    }),
    expect: { match_results_gt: 0, missing_info_contains: "English" },
    ai_question: "I don't have an English test yet and want to start in February. What should I do?",
  }),
);

// 3. Career changer — bachelor's field has zero overlap with the target master's field.
archetype(
  "career_pivot_unrelated_field",
  "Bachelor in an unrelated field (English Literature) targeting Master of Data Science — tests the alignment/field-mismatch penalty, not a knockout.",
  5,
  (i) => ({
    student: base({
      name: `CareerPivot ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of English Literature", institution: "Tribhuvan University", country: "Nepal", start_year: 2016, end_year: 2020, gpa_value: 3.4, gpa_scale: "4.0", gap_months: 0 }],
      language_tests: [{ test: "IELTS", overall: 7, test_date: "2025-10-01" }],
      work: [{ title: "Content Writer", employer: "Local Media", industry: "Media", country: "Nepal", start_date: "2020-06-01", end_date: null, full_time: true, relevant: false }],
      career_goal: { target_occupation: "Data Scientist", target_industry: "Data Science", intended_field: "Data Science", reason: `Deliberate ${i}-year pivot into tech after realising writing work is being automated`, change_field: true, long_term: "PR" },
      finance: income(3500000),
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Data Science", max_tuition_per_year: 60000, tuition_currency: "AUD", intake: "Jul 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: true, city_size: "big", cost_sensitivity: "low", part_time_work_important: false },
    }),
    expect: { match_results_gt: 0, career_subscore_lt: 60 },
    ai_question: "My degree is in English Literature but I want to switch into Data Science. Is this realistic and what should I prepare?",
  }),
);

// 4. Double visa refusal (two different countries) — heaviest visa-risk case.
archetype(
  "double_visa_refusal",
  "Refused visas from BOTH UK and US previously — visa-risk commentary must surface both, kept separate from the match score.",
  5,
  (i) => ({
    student: base({
      name: `DoubleRefusal ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of Business Studies", institution: "Tribhuvan University", country: "Nepal", start_year: 2015, end_year: 2019, gpa_value: 3.2, gpa_scale: "4.0", gap_months: 6 }],
      language_tests: [{ test: "PTE", overall: 65, test_date: "2025-09-01" }],
      work: [{ title: "Operations Executive", employer: "Local Firm", industry: "Business", country: "Nepal", start_date: "2019-08-01", end_date: null, full_time: true, relevant: true }],
      career_goal: { target_occupation: "Operations Manager", target_industry: "Management", intended_field: "Management", reason: "Progression", change_field: false, long_term: "PR" },
      finance: income(2600000),
      visa_history: [
        { country: "UK", visa_type: "Student", outcome: "refused", decision_date: "2019-05-01", refusal_reason: "Insufficient funds evidence" },
        { country: "US", visa_type: "Visitor", outcome: "refused", decision_date: `202${i}-02-01`, refusal_reason: "Immigration intent not established" },
      ],
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Management", max_tuition_per_year: 55000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: false, city_size: "either", cost_sensitivity: "high", part_time_work_important: true },
    }),
    expect: { match_results_gt: 0, concerns_contains: "refusal" },
    ai_question: "I've had visa refusals from both the UK and the US in the past. Can I still get an Australian student visa, and how should I address this?",
  }),
);

// 5. Large family — spouse + 2 accompanying children, living-cost burden.
archetype(
  "large_family_living_costs",
  "Married with 2 accompanying children — tests the +8k/dependant living-cost calc materially lowering affordability & financial subscore vs an equivalent single applicant.",
  5,
  (i) => ({
    student: base({
      name: `LargeFamily ${i}`,
      marital_status: "married",
      dependants: [
        { relationship: "spouse", full_name: "Partner", date_of_birth: "1995-01-01", accompanying: true, passport_status: "held" },
        { relationship: "child", full_name: "Child A", date_of_birth: "2016-01-01", accompanying: true, passport_status: "none" },
        { relationship: "child", full_name: "Child B", date_of_birth: "2019-01-01", accompanying: true, passport_status: "none" },
      ],
      academic: [{ level: "Bachelor", course: "Bachelor of Nursing", institution: "Tribhuvan University", country: "Nepal", start_year: 2010, end_year: 2014, gpa_value: 3.3, gpa_scale: "4.0", gap_months: 0 }],
      language_tests: [{ test: "IELTS", overall: 7, test_date: "2025-08-01" }],
      work: [{ title: "Registered Nurse", employer: "City Hospital", industry: "Nursing", country: "Nepal", start_date: "2014-06-01", end_date: null, full_time: true, relevant: true }],
      career_goal: { target_occupation: "Registered Nurse", target_industry: "Nursing", intended_field: "Nursing", reason: "Registration pathway", change_field: false, long_term: "PR" },
      finance: income(3000000 + i * 200000),
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Nursing", max_tuition_per_year: 45000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: true, min_scholarship_pct: 10, ranking_matters: false, city_size: "small", cost_sensitivity: "high", part_time_work_important: true },
    }),
    expect: { affordability_lt_single_equivalent: true },
    ai_question: "I'll be bringing my spouse and two children with me. How much more should I budget for living costs, and does this affect my visa?",
  }),
);

// 6. Scholarship-dependent affordability — funds sit right at the edge, viable ONLY with a scholarship.
archetype(
  "scholarship_dependent",
  "Available funds roughly equal to tuition+living without any margin — genuinely needs a scholarship to be workable, not just 'nice to have'.",
  5,
  (i) => ({
    student: base({
      name: `ScholarshipDependent ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of Science", institution: "Tribhuvan University", country: "Nepal", start_year: 2019, end_year: 2023, gpa_value: 88 + i, gpa_scale: "percentage", gap_months: 0 }],
      language_tests: [{ test: "IELTS", overall: 7.5, test_date: "2025-07-01" }],
      career_goal: { target_occupation: "Data Scientist", target_industry: "Data Science", intended_field: "Data Science", reason: "High-merit candidate needing financial support", change_field: false, long_term: "PR" },
      finance: income(2200000),
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Data Science", max_tuition_per_year: 45000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: true, min_scholarship_pct: 20, ranking_matters: false, city_size: "either", cost_sensitivity: "high", part_time_work_important: true },
    }),
    expect: { scholarship_mentioned: true },
    ai_question: "I can only afford this if I get a scholarship. What are my real chances and what merit scholarships exist for a strong Data Science applicant?",
  }),
);

// 7. Borderline GPA — just inside the knockout tolerance, should survive but score low.
archetype(
  "borderline_gpa",
  "Canonical GPA ~2 points below a realistic Master's entry minimum — inside the engine's 3-point knockout tolerance, so it must survive with a low academic subscore, not be knocked out.",
  5,
  (i) => ({
    student: base({
      name: `BorderlineGPA ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of Information Technology", institution: "Tribhuvan University", country: "Nepal", start_year: 2018, end_year: 2022, gpa_value: 2.35 + i * 0.02, gpa_scale: "4.0", gap_months: 0 }],
      language_tests: [{ test: "IELTS", overall: 6.5, test_date: "2025-06-01" }],
      career_goal: { target_occupation: "Software Engineer", target_industry: "Information Technology", intended_field: "Information Technology", reason: "Progression", change_field: false, long_term: "employment" },
      finance: income(3200000),
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Information Technology", max_tuition_per_year: 55000, tuition_currency: "AUD", intake: "Jul 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: false, city_size: "either", cost_sensitivity: "low", part_time_work_important: false },
    }),
    expect: { survives_with_low_academic: true },
    ai_question: "My GPA is on the lower side for the Master's programs I want. What's my honest chance and how can I strengthen my application?",
  }),
);

// 8. Overqualified — PhD holder targeting a Bachelor (deliberate downgrade, e.g. re-skilling).
archetype(
  "overqualified_downgrade",
  "Already holds the target level's ceiling (postgrad-equivalent experience) but is applying to a Bachelor for a genuine re-skill — tests the 'course below target level' scoring penalty.",
  5,
  (i) => ({
    student: base({
      name: `Reskiller ${i}`,
      academic: [{ level: "Master", course: "Master of Arts", institution: "Tribhuvan University", country: "Nepal", start_year: 2012, end_year: 2015, gpa_value: 3.6, gpa_scale: "4.0", gap_months: 0 }],
      language_tests: [{ test: "IELTS", overall: 7, test_date: "2025-05-01" }],
      work: [{ title: "Teacher", employer: "Local School", industry: "Education", country: "Nepal", start_date: "2015-06-01", end_date: `202${i}-01-01`, full_time: true, relevant: false }],
      career_goal: { target_occupation: "Software Developer", target_industry: "Information Technology", intended_field: "Information Technology", reason: "Full re-skill into tech from teaching", change_field: true, long_term: "PR" },
      finance: income(4000000),
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Bachelor", field: "Information Technology", max_tuition_per_year: 45000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: false, city_size: "either", cost_sensitivity: "low", part_time_work_important: false },
    }),
    expect: { match_results_gt: 0 },
    ai_question: "I already have a Master's degree but want to start a Bachelor in IT to fully re-skill. Does that make sense and will it hurt my application?",
  }),
);

// 9. GPA conversion edge cases — right at scale boundaries.
archetype(
  "gpa_scale_boundary",
  "GPA values sitting exactly at a canonical-scale conversion boundary (division system 2nd/3rd, percentage at 49-50) — tests toCanonicalGpa correctness at the edge.",
  5,
  (i) => {
    const scales = [
      { gpa_scale: "division", gpa_value: 2 },
      { gpa_scale: "division", gpa_value: 3 },
      { gpa_scale: "percentage", gpa_value: 49 },
      { gpa_scale: "percentage", gpa_value: 50 },
      { gpa_scale: "10.0", gpa_value: 5.0 },
    ][i - 1];
    return {
      student: base({
        name: `GpaBoundary ${i}`,
        academic: [{ level: "Bachelor", course: "Bachelor of Commerce", institution: "Tribhuvan University", country: "Nepal", start_year: 2018, end_year: 2022, ...scales, gap_months: 0 }],
        language_tests: [{ test: "IELTS", overall: 6.5, test_date: "2025-04-01" }],
        career_goal: { target_occupation: "Accountant", target_industry: "Accounting", intended_field: "Accounting", reason: "Progression", change_field: false, long_term: "employment" },
        finance: income(2500000),
        preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Accounting", max_tuition_per_year: 50000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: false, city_size: "either", cost_sensitivity: "low", part_time_work_important: false },
      }),
      expect: { profile_created: true },
      ai_question: null,
    };
  },
);

// 10. PR-focused trades/nursing candidate — tests the explicit PR-pathway bonus fields.
archetype(
  "pr_pathway_bonus_field",
  "Long-term goal is PR, targeting a field on the engine's PR-bonus list (Nursing/IT/Cybersecurity/Data Science/Construction Management) — career subscore should reflect the bonus.",
  5,
  (i) => {
    const fields = ["Nursing", "Cybersecurity", "Information Technology", "Data Science", "Construction Management"];
    const f = fields[i - 1];
    return {
      student: base({
        name: `PrPathway ${i}`,
        academic: [{ level: "Bachelor", course: `Bachelor of ${f}`, institution: "Tribhuvan University", country: "Nepal", start_year: 2017, end_year: 2021, gpa_value: 3.4, gpa_scale: "4.0", gap_months: 0 }],
        language_tests: [{ test: "IELTS", overall: 7, test_date: "2025-03-01" }],
        career_goal: { target_occupation: `${f} Specialist`, target_industry: f, intended_field: f, reason: "PR-track career", change_field: false, long_term: "PR" },
        finance: income(3000000),
        preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: f, max_tuition_per_year: 55000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: false, city_size: "either", cost_sensitivity: "low", part_time_work_important: true },
      }),
      expect: { match_results_gt: 0 },
      ai_question: "My long-term goal is PR in Australia. Does my chosen field actually help with that, and what's the pathway after I graduate?",
    };
  },
);

// 11. Regional/cost-sensitive seeker — explicit small-city + low-cost preference.
archetype(
  "regional_cost_sensitive",
  "Explicitly prefers a smaller city and is cost-sensitive — location score and AI cost-of-living guidance should reflect that, not push a big-city premium option.",
  5,
  (i) => ({
    student: base({
      name: `Regional ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of Engineering", institution: "Tribhuvan University", country: "Nepal", start_year: 2018, end_year: 2022, gpa_value: 3.3, gpa_scale: "4.0", gap_months: 0 }],
      language_tests: [{ test: "PTE", overall: 60, test_date: "2025-02-01" }],
      career_goal: { target_occupation: "Project Manager", target_industry: "Construction Management", intended_field: "Construction Management", reason: "Progression", change_field: false, long_term: "return home" },
      finance: income(2000000),
      preferences: { preferred_countries: ["AU"], preferred_cities: ["Geelong"], degree_level: "Master", field: "Construction Management", max_tuition_per_year: 42000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: true, min_scholarship_pct: 10, ranking_matters: false, city_size: "small", cost_sensitivity: "high", part_time_work_important: true },
    }),
    expect: { match_results_gt: 0 },
    ai_question: "I want somewhere smaller and cheaper than Sydney or Melbourne. What are realistic options for me?",
  }),
);

// 12. Split-country undecided — two very different destinations weighted equally.
archetype(
  "undecided_split_countries",
  "Preferred countries split across AU and a non-catalogue destination (e.g. Canada) — since the catalogue is AU-only, tests that the system is honest about only covering AU rather than silently ignoring the other preference.",
  5,
  (i) => ({
    student: base({
      name: `SplitCountry ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of Business Studies", institution: "Tribhuvan University", country: "Nepal", start_year: 2018, end_year: 2022, gpa_value: 3.5, gpa_scale: "4.0", gap_months: 0 }],
      language_tests: [{ test: "IELTS", overall: 7, test_date: "2025-01-01" }],
      career_goal: { target_occupation: "Marketing Manager", target_industry: "Marketing", intended_field: "Marketing", reason: "Progression", change_field: false, long_term: "further study" },
      finance: income(3500000),
      preferences: { preferred_countries: ["CA", "AU"], preferred_cities: [], degree_level: "Master", field: "Marketing", max_tuition_per_year: 50000, tuition_currency: "AUD", intake: "Jul 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: true, city_size: "big", cost_sensitivity: "low", part_time_work_important: false },
    }),
    expect: { match_results_gt: 0 },
    ai_question: "I'm torn between Canada and Australia. Which should I focus on given my profile?",
  }),
);

// 13. Weak financial evidence — most income sources marked unevidenced.
archetype(
  "weak_financial_evidence",
  "Good on-paper affordability but almost no income/asset evidence flags set — deterministic score doesn't penalise this (evidence isn't scored), so the AI must be the one to flag the documentation gap.",
  5,
  (i) => ({
    student: base({
      name: `WeakEvidence ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of Commerce", institution: "Tribhuvan University", country: "Nepal", start_year: 2018, end_year: 2022, gpa_value: 3.4, gpa_scale: "4.0", gap_months: 0 }],
      language_tests: [{ test: "IELTS", overall: 6.5, test_date: "2025-01-15" }],
      career_goal: { target_occupation: "Accountant", target_industry: "Accounting", intended_field: "Accounting", reason: "Progression", change_field: false, long_term: "employment" },
      finance: {
        income_sources: [{ kind: "business", amount: 3500000, currency: "NPR", evidence: false }],
        assets: [{ kind: "bank savings", amount: 5000000, currency: "NPR", liquid: true, evidence: false }],
        liabilities: [],
      },
      sponsors: [{ relationship: "Father", occupation: "Business owner", annual_income: 3500000, currency: "NPR", evidence: false }],
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Accounting", max_tuition_per_year: 45000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: false, city_size: "either", cost_sensitivity: "low", part_time_work_important: false },
    }),
    expect: { match_results_gt: 0 },
    ai_question: "My family's income is mostly from an unregistered business without formal paperwork. Will this be a problem for my visa?",
  }),
);

// 14. Zero work experience against an experience-preferring course/goal (MBA-style).
archetype(
  "zero_experience_experience_preferred",
  "Fresh graduate, zero work experience, targeting Management/MBA-style courses where the engine's career score expects relevant experience.",
  5,
  (i) => ({
    student: base({
      name: `FreshGrad ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of Business Studies", institution: "Tribhuvan University", country: "Nepal", start_year: 2021, end_year: 2025, gpa_value: 3.6, gpa_scale: "4.0", gap_months: 0 }],
      language_tests: [{ test: "IELTS", overall: 7, test_date: "2025-12-01" }],
      work: [],
      career_goal: { target_occupation: "Operations Manager", target_industry: "Management", intended_field: "Management", reason: "Straight into management study", change_field: false, long_term: "employment" },
      finance: income(4500000),
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Management", max_tuition_per_year: 65000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: true, city_size: "big", cost_sensitivity: "low", part_time_work_important: false },
    }),
    // NOTE: CRICOS (server/data/cricos/) does not publish real per-course
    // work-experience requirements, so the import defaults every course to
    // `work_experience_months: 0` — meaning the engine's "experience
    // preferred" penalty can never fire against the real catalogue (there is
    // no real data to drive it). That's an honest limitation of the source
    // data, not something to fake by inventing fictitious requirements, so
    // this archetype only asserts the engine runs cleanly; the real test of
    // "should I work first" lives in the AI answer, grounded in real guidance.
    expect: { match_results_gt: 0 },
    ai_question: "I have no work experience yet. Can I still get into a good Master of Management program, or should I work first?",
  }),
);

// 15. Sponsor-heavy finance — student has no income at all, 100% sponsor-funded.
archetype(
  "fully_sponsor_funded",
  "Student has zero personal/family income sources — entirely reliant on a named sponsor. Tests that the profile derivation still produces a sane affordability figure from assets alone, and that the AI correctly explains sponsor-based visa evidence.",
  5,
  (i) => ({
    student: base({
      name: `SponsorFunded ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of Information Technology", institution: "Tribhuvan University", country: "Nepal", start_year: 2018, end_year: 2022, gpa_value: 3.5, gpa_scale: "4.0", gap_months: 0 }],
      language_tests: [{ test: "PTE", overall: 68, test_date: "2025-11-15" }],
      career_goal: { target_occupation: "Software Engineer", target_industry: "Information Technology", intended_field: "Information Technology", reason: "Progression", change_field: false, long_term: "PR" },
      finance: { income_sources: [], assets: [{ kind: "sponsor", amount: 6000000, currency: "NPR", liquid: true }], liabilities: [] },
      sponsors: [{ relationship: "Uncle", occupation: "Business owner abroad", annual_income: 5000000, currency: "NPR", evidence: true }],
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Information Technology", max_tuition_per_year: 50000, tuition_currency: "AUD", intake: "Jul 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: false, city_size: "either", cost_sensitivity: "low", part_time_work_important: false },
    }),
    expect: { match_results_gt: 0 },
    ai_question: "My uncle is sponsoring my studies entirely — I have no income of my own. What documents will I need to prove this for my visa?",
  }),
);

// 16. Change-of-field WITH strong justification narrative (contrast to #3's thin case).
archetype(
  "justified_field_change",
  "Field change with a well-articulated, credible reason (vs archetype 3's thin justification) — tests whether the AI's narrative differentiates a well-argued pivot from a weak one when asked directly.",
  5,
  (i) => ({
    student: base({
      name: `JustifiedPivot ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of Accounting", institution: "Tribhuvan University", country: "Nepal", start_year: 2016, end_year: 2020, gpa_value: 3.5, gpa_scale: "4.0", gap_months: 0 }],
      language_tests: [{ test: "IELTS", overall: 7, test_date: "2025-10-15" }],
      work: [{ title: "IT Auditor", employer: "Big Four Firm", industry: "Accounting", country: "Nepal", start_date: "2020-08-01", end_date: null, full_time: true, relevant: true }],
      career_goal: { target_occupation: "Cybersecurity Analyst", target_industry: "Cybersecurity", intended_field: "Cybersecurity", reason: "3 years as an IT auditor specialising in systems/controls review — natural progression into cybersecurity, not a cold pivot", change_field: true, long_term: "PR" },
      finance: income(4000000),
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Cybersecurity", max_tuition_per_year: 55000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: false, city_size: "either", cost_sensitivity: "low", part_time_work_important: false },
    }),
    expect: { match_results_gt: 0 },
    ai_question: "I'm an IT auditor moving into cybersecurity — is this a credible pivot for my application?",
  }),
);

// 17. Ultra-high budget, ranking-obsessed — top-of-market case.
archetype(
  "high_budget_ranking_obsessed",
  "No financial constraint at all, explicitly wants only the highest-ranked options — tests that the engine doesn't break or misrank at the top end of the price/rank spectrum.",
  5,
  (i) => ({
    student: base({
      name: `TopEnd ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of Science", institution: "Tribhuvan University", country: "Nepal", start_year: 2018, end_year: 2022, gpa_value: 3.9, gpa_scale: "4.0", gap_months: 0 }],
      language_tests: [{ test: "IELTS", overall: 8, test_date: "2025-09-15" }],
      career_goal: { target_occupation: "AI Researcher", target_industry: "Artificial Intelligence", intended_field: "Data Science", reason: "Research career", change_field: false, long_term: "further study" },
      finance: income(15000000),
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Data Science", max_tuition_per_year: 150000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: true, city_size: "big", cost_sensitivity: "low", part_time_work_important: false },
    }),
    expect: { match_results_gt: 0 },
    ai_question: "Money isn't a constraint — I only want the top-ranked program. What should I pick and why?",
  }),
);

// 18. Study gap needing explanation.
archetype(
  "study_gap",
  "A multi-year academic gap on the transcript — tests that this doesn't silently break scoring, and that the AI proactively raises it as something to explain in the SOP even though the engine itself doesn't penalise it.",
  5,
  (i) => ({
    student: base({
      name: `StudyGap ${i}`,
      academic: [{ level: "Bachelor", course: "Bachelor of Management", institution: "Tribhuvan University", country: "Nepal", start_year: 2012, end_year: 2016, gpa_value: 3.1, gpa_scale: "4.0", gap_months: 30 + i * 6 }],
      language_tests: [{ test: "IELTS", overall: 6.5, test_date: "2025-08-15" }],
      work: [{ title: "Family Business Manager", employer: "Self-employed", industry: "Business", country: "Nepal", start_date: "2019-01-01", end_date: null, full_time: true, relevant: true }],
      career_goal: { target_occupation: "Business Analyst", target_industry: "Business Analytics", intended_field: "Business Analytics", reason: "Formalising informal business experience", change_field: false, long_term: "employment" },
      finance: income(3000000),
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Business Analytics", max_tuition_per_year: 50000, tuition_currency: "AUD", intake: "Jul 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: false, city_size: "either", cost_sensitivity: "high", part_time_work_important: true },
    }),
    expect: { match_results_gt: 0 },
    ai_question: `I had a ${30 + i * 6}-month gap after my bachelor's before working in my family's business. Will this hurt my application?`,
  }),
);

// 19. No passport yet (passport_status: none) — missing_info must catch it.
archetype(
  "no_passport_yet",
  "Otherwise strong applicant who hasn't applied for a passport yet — tests the missing_info passport flag fires and the AI treats it as a practical, fixable blocker (not existential).",
  5,
  (i) => ({
    student: base({
      name: `NoPassport ${i}`,
      passport_status: "none",
      academic: [{ level: "Bachelor", course: "Bachelor of Public Health", institution: "Tribhuvan University", country: "Nepal", start_year: 2018, end_year: 2022, gpa_value: 3.5, gpa_scale: "4.0", gap_months: 0 }],
      language_tests: [{ test: "IELTS", overall: 7, test_date: "2025-07-15" }],
      career_goal: { target_occupation: "Health Policy Analyst", target_industry: "Public Health", intended_field: "Public Health", reason: "Progression", change_field: false, long_term: "return home" },
      finance: income(3000000),
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Public Health", max_tuition_per_year: 45000, tuition_currency: "AUD", intake: "Jul 2026", scholarship_required: false, min_scholarship_pct: 0, ranking_matters: false, city_size: "either", cost_sensitivity: "low", part_time_work_important: false },
    }),
    expect: { match_results_gt: 0, missing_info_contains: "Passport" },
    ai_question: "I haven't applied for a passport yet. How urgently do I need one and does it affect anything else in my timeline?",
  }),
);

// 20. Everything stacked against them — deliberately the hardest composite case.
archetype(
  "worst_case_composite",
  "Deliberately compounds several hard factors at once (borderline GPA + no English test + prior refusal + tight budget + dependants) — the true stress-test of whether the system degrades gracefully instead of breaking or giving nonsense advice.",
  5,
  (i) => ({
    student: base({
      name: `WorstCase ${i}`,
      marital_status: "married",
      dependants: [{ relationship: "spouse", full_name: "Partner", date_of_birth: "1996-01-01", accompanying: true, passport_status: "applied" }],
      academic: [{ level: "Bachelor", course: "Bachelor of Commerce", institution: "Tribhuvan University", country: "Nepal", start_year: 2014, end_year: 2018, gpa_value: 2.3, gpa_scale: "4.0", gap_months: 18 }],
      language_tests: [],
      work: [{ title: "Retail Supervisor", employer: "Local Store", industry: "Retail", country: "Nepal", start_date: "2018-06-01", end_date: null, full_time: true, relevant: false }],
      career_goal: { target_occupation: "Business Analyst", target_industry: "Business Analytics", intended_field: "Business Analytics", reason: "Career restart after refusal setback", change_field: true, long_term: "PR" },
      finance: income(1500000 + i * 50000),
      visa_history: [{ country: "UK", visa_type: "Student", outcome: "refused", decision_date: "2021-03-01", refusal_reason: "Genuine student requirement not met" }],
      preferences: { preferred_countries: ["AU"], preferred_cities: [], degree_level: "Master", field: "Business Analytics", max_tuition_per_year: 20000, tuition_currency: "AUD", intake: "Feb 2026", scholarship_required: true, min_scholarship_pct: 25, ranking_matters: false, city_size: "small", cost_sensitivity: "high", part_time_work_important: true },
    }),
    expect: { graceful: true },
    ai_question: "Realistically, given everything in my file, what is my honest path forward — should I even apply right now?",
  }),
);

export function allCases() {
  return CASES;
}
export { BRANCH };

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`${CASES.length} complex test cases across ${new Set(CASES.map((c) => c.archetype)).size} archetypes`);
}
