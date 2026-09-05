import type {
  Student,
  StudentState,
  Country,
  DegreeLevel,
} from "../types";

let seq = 0;
const uid = (p: string) => `${p}-${(++seq).toString(36)}`;

interface Seed {
  name: string;
  city: string;
  state: StudentState;
  counsellor: string;
  bachelor_field: string;
  gpa4: number;
  ielts: number | null;
  pte: number | null;
  work_years: number;
  work_relevant: boolean;
  intended_field: string;
  target_occupation: string;
  long_term: "employment" | "PR" | "return home" | "business" | "further study";
  income_npr: number;
  savings_npr: number;
  loan_npr: number;
  budget_aud: number;
  countries: Country[];
  level: DegreeLevel;
  scholarship_required: boolean;
  refusal?: { country: string; reason: string };
  passport: "none" | "applied" | "held";
}

const SEEDS: Seed[] = [
  {
    name: "Aarati Sharma", city: "Kathmandu", state: "Shortlisted", counsellor: "Bina Rai",
    bachelor_field: "Business Studies", gpa4: 3.25, ielts: null, pte: 67, work_years: 1.8,
    work_relevant: true, intended_field: "Business Analytics", target_occupation: "Business/Data Analyst",
    long_term: "PR", income_npr: 2400000, savings_npr: 3500000, loan_npr: 5000000, budget_aud: 48000,
    countries: ["AU", "NZ"], level: "Master", scholarship_required: true, passport: "held",
  },
  {
    name: "Bibek Gurung", city: "Pokhara", state: "Profiling", counsellor: "Bina Rai",
    bachelor_field: "Computer Engineering", gpa4: 3.6, ielts: 7, pte: null, work_years: 2.5,
    work_relevant: true, intended_field: "Artificial Intelligence", target_occupation: "ML Engineer",
    long_term: "PR", income_npr: 3200000, savings_npr: 6000000, loan_npr: 3000000, budget_aud: 55000,
    countries: ["AU", "CA"], level: "Master", scholarship_required: false, passport: "held",
  },
  {
    name: "Chandni Thapa", city: "Biratnagar", state: "Enquiry", counsellor: "Suman K.C.",
    bachelor_field: "Nursing", gpa4: 3.1, ielts: 6.5, pte: null, work_years: 3,
    work_relevant: true, intended_field: "Nursing", target_occupation: "Registered Nurse",
    long_term: "PR", income_npr: 1800000, savings_npr: 2500000, loan_npr: 6000000, budget_aud: 42000,
    countries: ["AU"], level: "Master", scholarship_required: true, passport: "applied",
  },
  {
    name: "Deepak Adhikari", city: "Lalitpur", state: "Applied", counsellor: "Suman K.C.",
    bachelor_field: "Management", gpa4: 2.8, ielts: 6, pte: null, work_years: 5,
    work_relevant: true, intended_field: "Management", target_occupation: "Operations Manager",
    long_term: "employment", income_npr: 4200000, savings_npr: 9000000, loan_npr: 0, budget_aud: 65000,
    countries: ["UK", "AU"], level: "Master", scholarship_required: false, passport: "held",
    refusal: { country: "UK", reason: "Insufficient maintenance funds evidence (2019)" },
  },
  {
    name: "Elina Maharjan", city: "Kathmandu", state: "Profiling", counsellor: "Bina Rai",
    bachelor_field: "Statistics", gpa4: 3.8, ielts: 7.5, pte: null, work_years: 0.5,
    work_relevant: false, intended_field: "Data Science", target_occupation: "Data Scientist",
    long_term: "further study", income_npr: 2800000, savings_npr: 4200000, loan_npr: 4000000, budget_aud: 50000,
    countries: ["AU", "NZ", "CA"], level: "Master", scholarship_required: true, passport: "held",
  },
  {
    name: "Farhan Ansari", city: "Nepalgunj", state: "Enquiry", counsellor: "Suman K.C.",
    bachelor_field: "Civil Engineering", gpa4: 3.0, ielts: null, pte: null, work_years: 1,
    work_relevant: true, intended_field: "Construction Management", target_occupation: "Project Manager",
    long_term: "PR", income_npr: 2000000, savings_npr: 2000000, loan_npr: 5500000, budget_aud: 45000,
    countries: ["AU"], level: "Master", scholarship_required: true, passport: "none",
  },
];

const FIELD_GENERIC = ["Business Studies", "Information Technology", "Management", "Commerce", "Science"];
const OCC_GENERIC = ["Business Analyst", "Software Engineer", "Accountant", "Marketing Manager"];

function buildStudent(s: Seed, idx: number): Student {
  const dobYear = 1998 - (idx % 4);
  const gradYear = 2020 + (idx % 4);
  const married = s.work_years > 3;
  const dependants: Student["dependants"] = [];
  if (married) {
    dependants.push({
      id: uid("dep"),
      relationship: "spouse",
      full_name: `${s.name.split(" ")[1] ?? "Partner"} (spouse)`,
      date_of_birth: `${dobYear + 1}-03-20`,
      accompanying: true,
      passport_status: s.passport === "held" ? "held" : "applied",
    });
  }
  if (s.work_years > 4) {
    dependants.push({
      id: uid("dep"),
      relationship: "child",
      full_name: `${s.name.split(" ")[0]}'s child`,
      date_of_birth: `${gradYear + 1}-07-11`,
      accompanying: true,
      passport_status: "none",
    });
  }
  return {
    id: `s-${(idx + 1).toString().padStart(3, "0")}`,
    full_name: s.name,
    date_of_birth: `${dobYear}-0${(idx % 8) + 1}-15`,
    gender: idx % 2 === 0 ? "female" : "male",
    nationality: "Nepal",
    current_city: s.city,
    passport_status: s.passport,
    marital_status: married ? "married" : "single",
    dependants,
    state: s.state,
    counsellor: s.counsellor,
    branch: "Kathmandu HQ",
    created_at: new Date(Date.now() - idx * 86400000 * 3).toISOString(),
    consent_given_at: s.state === "Enquiry" ? null : new Date(Date.now() - idx * 86400000 * 2).toISOString(),
    academic: [
      {
        id: uid("ac"),
        level: "Bachelor",
        course: `Bachelor of ${s.bachelor_field}`,
        institution: "Tribhuvan University",
        country: "Nepal",
        start_year: gradYear - 4,
        end_year: gradYear,
        gpa_value: s.gpa4,
        gpa_scale: "4.0",
        gap_months: idx % 3 === 0 ? 10 : 0,
      },
    ],
    language_tests: [
      ...(s.ielts != null
        ? [{ id: uid("lt"), test: "IELTS" as const, overall: s.ielts, listening: s.ielts, reading: s.ielts - 0.5, writing: s.ielts - 0.5, speaking: s.ielts, test_date: "2025-11-10" }]
        : []),
      ...(s.pte != null
        ? [{ id: uid("lt"), test: "PTE" as const, overall: s.pte, listening: s.pte - 5, reading: s.pte - 3, writing: s.pte, speaking: s.pte - 8, test_date: "2025-10-02" }]
        : []),
    ],
    work: s.work_years
      ? [
          {
            id: uid("wk"),
            title: s.target_occupation,
            employer: "Himalayan Solutions Pvt. Ltd.",
            industry: s.intended_field,
            country: "Nepal",
            // start = work_years ago, still employed → ~work_years of experience
            start_date: new Date(Date.now() - s.work_years * 365 * 86400000)
              .toISOString()
              .slice(0, 10),
            end_date: null,
            full_time: true,
            relevant: s.work_relevant,
          },
        ]
      : [],
    career_goal: {
      target_occupation: s.target_occupation,
      target_industry: s.intended_field,
      intended_field: s.intended_field,
      reason: `Progression from ${s.bachelor_field} into ${s.intended_field}.`,
      change_field: !s.bachelor_field.toLowerCase().includes(s.intended_field.split(" ")[0].toLowerCase()),
      long_term: s.long_term,
    },
    finance: {
      income_sources: [
        { id: uid("in"), kind: "father", amount: Math.round(s.income_npr * 0.6), currency: "NPR", evidence: true },
        { id: uid("in"), kind: "business", amount: Math.round(s.income_npr * 0.4), currency: "NPR", evidence: idx % 2 === 0 },
      ],
      assets: [
        { id: uid("as"), kind: "bank savings", amount: Math.round(s.savings_npr * 0.5), currency: "NPR", liquid: true },
        { id: uid("as"), kind: "fixed deposit", amount: Math.round(s.savings_npr * 0.5), currency: "NPR", liquid: true },
        ...(s.loan_npr ? [{ id: uid("as"), kind: "education loan" as const, amount: s.loan_npr, currency: "NPR" as const, liquid: true }] : []),
      ],
      liabilities: s.loan_npr
        ? [{ id: uid("li"), kind: "Education loan servicing", amount: s.loan_npr, currency: "NPR", monthly_repayment: Math.round(s.loan_npr / 120) }]
        : [],
    },
    sponsors: [
      {
        id: uid("sp"),
        relationship: "Father",
        occupation: "Business owner",
        annual_income: s.income_npr,
        currency: "NPR",
        evidence: true,
      },
    ],
    visa_history: s.refusal
      ? [
          {
            id: uid("vh"),
            country: s.refusal.country,
            visa_type: "Student (subclass 500 / Tier 4)",
            outcome: "refused",
            decision_date: "2019-06-14",
            refusal_reason: s.refusal.reason,
          },
        ]
      : [],
    preferences: {
      preferred_countries: s.countries,
      preferred_cities: s.countries.includes("AU") ? ["Sydney", "Melbourne"] : ["Auckland"],
      degree_level: s.level,
      field: s.intended_field,
      max_tuition_per_year: s.budget_aud,
      tuition_currency: "AUD",
      intake: "Feb 2026",
      scholarship_required: s.scholarship_required,
      min_scholarship_pct: s.scholarship_required ? 15 : 0,
      ranking_matters: idx % 2 === 0,
      city_size: idx % 3 === 0 ? "big" : "either",
      cost_sensitivity: s.loan_npr > 4000000 ? "high" : "low",
      part_time_work_important: s.long_term === "PR",
    },
  };
}

function makeFiller(idx: number): Seed {
  const f = FIELD_GENERIC[idx % FIELD_GENERIC.length];
  return {
    name: `Demo Student ${idx + 1}`,
    city: ["Kathmandu", "Pokhara", "Chitwan", "Butwal"][idx % 4],
    state: (["Enquiry", "Profiling", "Shortlisted"] as StudentState[])[idx % 3],
    counsellor: idx % 2 === 0 ? "Bina Rai" : "Suman K.C.",
    bachelor_field: f,
    gpa4: 2.7 + ((idx * 7) % 12) / 10,
    ielts: idx % 3 === 0 ? null : 6 + ((idx % 4) * 0.5),
    pte: idx % 3 === 0 ? 58 + (idx % 5) * 3 : null,
    work_years: idx % 5,
    work_relevant: idx % 2 === 0,
    intended_field: ["Information Technology", "Business Analytics", "Accounting", "Marketing"][idx % 4],
    target_occupation: OCC_GENERIC[idx % OCC_GENERIC.length],
    long_term: (["employment", "PR", "return home", "business"] as const)[idx % 4],
    income_npr: 1800000 + (idx % 6) * 400000,
    savings_npr: 2500000 + (idx % 5) * 800000,
    loan_npr: idx % 3 === 0 ? 0 : 4000000 + (idx % 4) * 700000,
    budget_aud: 40000 + (idx % 6) * 4000,
    countries: [(["AU", "NZ", "CA", "UK"] as Country[])[idx % 4]],
    level: "Master",
    scholarship_required: idx % 2 === 0,
    passport: (["none", "applied", "held"] as const)[idx % 3],
  };
}

export const students: Student[] = [
  ...SEEDS.map((s, i) => buildStudent(s, i)),
  ...Array.from({ length: 9 }, (_, i) => buildStudent(makeFiller(i + SEEDS.length), i + SEEDS.length)),
];
