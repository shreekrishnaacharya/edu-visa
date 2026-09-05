import type { Student } from "@mocks/types";

export type IntakeForm = Omit<Student, "id" | "created_at">;

export const emptyIntake = (): IntakeForm => ({
  full_name: "",
  date_of_birth: "",
  gender: "male",
  nationality: "Nepal",
  current_city: "",
  passport_status: "none",
  marital_status: "single",
  dependants: [],
  state: "Enquiry",
  counsellor: "Bina Rai",
  branch: "Kathmandu HQ",
  consent_given_at: null,

  academic: [
    {
      id: "ac-new",
      level: "Bachelor",
      course: "",
      institution: "",
      country: "Nepal",
      start_year: 2019,
      end_year: 2023,
      gpa_value: 3,
      gpa_scale: "4.0",
      gap_months: 0,
    },
  ],
  language_tests: [],
  work: [],
  career_goal: {
    target_occupation: "",
    target_industry: "",
    intended_field: "",
    reason: "",
    change_field: false,
    long_term: "PR",
  },
  finance: {
    income_sources: [
      { id: "in-new", kind: "father", amount: 2000000, currency: "NPR", evidence: true },
    ],
    assets: [
      { id: "as-new", kind: "bank savings", amount: 3000000, currency: "NPR", liquid: true },
    ],
    liabilities: [],
  },
  sponsors: [
    { id: "sp-new", relationship: "Father", occupation: "", annual_income: 2000000, currency: "NPR", evidence: true },
  ],
  visa_history: [],
  preferences: {
    preferred_countries: ["AU"],
    preferred_cities: [],
    degree_level: "Master",
    field: "",
    max_tuition_per_year: 45000,
    tuition_currency: "AUD",
    intake: "Feb 2026",
    scholarship_required: false,
    min_scholarship_pct: 0,
    ranking_matters: false,
    city_size: "either",
    cost_sensitivity: "low",
    part_time_work_important: true,
  },
});

export const STEP_LABELS = [
  "Personal",
  "Academic",
  "English",
  "Work",
  "Career goals",
  "Financial",
  "Sponsor",
  "Destination",
  "Course preferences",
  "Visa history",
];
