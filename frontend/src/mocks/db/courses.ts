import type { Course, DegreeLevel, EnglishTest } from "../types";
import { universities } from "./universities";

// ---------------------------------------------------------------------------
// ~60 courses generated from a small set of realistic templates so the
// catalogue and the matching engine have enough spread to be interesting.
// ---------------------------------------------------------------------------

interface Template {
  title: string;
  field: string;
  level: DegreeLevel;
  base_fee_aud: number; // tuition/yr at an "average" school; scaled by rank
  min_gpa: number; // canonical 0-100
  min_band: number; // IELTS-equivalent
  prereqs: string[];
  work_months: number;
  outcomes: string[];
}

const TEMPLATES: Template[] = [
  { title: "Master of Business Analytics", field: "Business Analytics", level: "Master", base_fee_aud: 46000, min_gpa: 65, min_band: 6.5, prereqs: [], work_months: 0, outcomes: ["Data Analyst", "Business Analyst", "Insights Consultant"] },
  { title: "Master of Data Science", field: "Data Science", level: "Master", base_fee_aud: 48000, min_gpa: 68, min_band: 6.5, prereqs: ["Programming", "Statistics"], work_months: 0, outcomes: ["Data Scientist", "ML Engineer"] },
  { title: "Master of Information Technology", field: "Information Technology", level: "Master", base_fee_aud: 44000, min_gpa: 60, min_band: 6.5, prereqs: [], work_months: 0, outcomes: ["Software Engineer", "Systems Analyst"] },
  { title: "Master of Professional Accounting", field: "Accounting", level: "Master", base_fee_aud: 43000, min_gpa: 58, min_band: 6.5, prereqs: [], work_months: 0, outcomes: ["Accountant", "Auditor"] },
  { title: "Master of Business Administration", field: "Management", level: "Master", base_fee_aud: 62000, min_gpa: 65, min_band: 6.5, prereqs: [], work_months: 24, outcomes: ["Operations Manager", "Product Manager"] },
  { title: "Master of Engineering (Software)", field: "Software Engineering", level: "Master", base_fee_aud: 47000, min_gpa: 65, min_band: 6.5, prereqs: ["Engineering degree"], work_months: 0, outcomes: ["Software Engineer", "Solutions Architect"] },
  { title: "Master of Nursing", field: "Nursing", level: "Master", base_fee_aud: 42000, min_gpa: 62, min_band: 7, prereqs: ["Nursing degree", "Registration"], work_months: 12, outcomes: ["Registered Nurse", "Clinical Nurse"] },
  { title: "Master of Public Health", field: "Public Health", level: "Master", base_fee_aud: 41000, min_gpa: 60, min_band: 6.5, prereqs: [], work_months: 0, outcomes: ["Health Policy Analyst", "Epidemiologist"] },
  { title: "Master of Marketing", field: "Marketing", level: "Master", base_fee_aud: 44000, min_gpa: 60, min_band: 6.5, prereqs: [], work_months: 0, outcomes: ["Marketing Manager", "Brand Strategist"] },
  { title: "Master of Cybersecurity", field: "Cybersecurity", level: "Master", base_fee_aud: 47000, min_gpa: 63, min_band: 6.5, prereqs: ["IT background"], work_months: 0, outcomes: ["Security Analyst", "Penetration Tester"] },
  { title: "Bachelor of Information Technology", field: "Information Technology", level: "Bachelor", base_fee_aud: 39000, min_gpa: 55, min_band: 6, prereqs: [], work_months: 0, outcomes: ["Software Developer", "IT Support Lead"] },
  { title: "Bachelor of Commerce", field: "Business", level: "Bachelor", base_fee_aud: 40000, min_gpa: 55, min_band: 6, prereqs: [], work_months: 0, outcomes: ["Analyst", "Consultant"] },
  { title: "Graduate Diploma in IT", field: "Information Technology", level: "PG Diploma", base_fee_aud: 34000, min_gpa: 50, min_band: 6, prereqs: [], work_months: 0, outcomes: ["Junior Developer"] },
  { title: "Master of Artificial Intelligence", field: "Artificial Intelligence", level: "Master", base_fee_aud: 49000, min_gpa: 70, min_band: 6.5, prereqs: ["Programming", "Linear Algebra"], work_months: 0, outcomes: ["ML Engineer", "AI Researcher"] },
  { title: "Master of Construction Management", field: "Construction Management", level: "Master", base_fee_aud: 45000, min_gpa: 60, min_band: 6.5, prereqs: [], work_months: 12, outcomes: ["Project Manager", "Site Manager"] },
];

// School "premium" multiplier from world rank — top schools cost more, ask more.
function rankFactor(rank: number): number {
  if (rank <= 25) return 1.18;
  if (rank <= 60) return 1.08;
  if (rank <= 150) return 1.0;
  return 0.9;
}

const ALL_TESTS: EnglishTest[] = ["IELTS", "PTE", "TOEFL"];

function isoInMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export const courses: Course[] = (() => {
  const out: Course[] = [];
  // Give each university 4-5 courses picked round-robin from the templates.
  universities.forEach((u, ui) => {
    const count = 4 + (ui % 2);
    for (let i = 0; i < count; i++) {
      const t = TEMPLATES[(ui * 3 + i) % TEMPLATES.length];
      const rf = rankFactor(u.world_rank);
      const fee = Math.round((t.base_fee_aud * rf) / 500) * 500;
      const gpaBump = u.world_rank <= 40 ? 6 : u.world_rank <= 120 ? 2 : 0;
      const nextIntakeMonths = [2, 5, 8][(ui + i) % 3];
      out.push({
        id: `c-${u.id.replace("u-", "")}-${i + 1}`,
        university_id: u.id,
        // denormalised for the catalogue grid + mock filtering
        university_name: u.name,
        country: u.country,
        city: u.city,
        world_rank: u.world_rank,
        title: t.title,
        degree_level: t.level,
        field: t.field,
        duration_months: t.level === "Bachelor" ? 36 : t.level === "PG Diploma" ? 12 : 24,
        tuition_fee: fee,
        currency: "AUD",
        intakes: ["Feb", "Jul", "Nov"].slice(0, 2 + (i % 2)),
        next_intake_date: isoInMonths(nextIntakeMonths),
        application_deadline: isoInMonths(nextIntakeMonths - 2),
        entry: {
          min_gpa: Math.min(85, t.min_gpa + gpaBump),
          min_english_band: t.min_band + (u.world_rank <= 40 ? 0.5 : 0),
          accepted_tests: ALL_TESTS,
          prerequisites: t.prereqs,
          work_experience_months: t.work_months,
        },
        scholarships:
          i % 3 === 0
            ? [
                {
                  id: `sch-${u.id}-${i}`,
                  name: `${u.name} Merit Scholarship`,
                  pct: u.world_rank <= 60 ? 15 : 25,
                  criteria: "Academic merit, assessed at offer stage",
                  min_gpa: 72,
                },
              ]
            : [],
        career_outcomes: t.outcomes,
        cricos: `0${(ui + 1) * 1000 + i}${String.fromCharCode(65 + (i % 6))}`,
      });
    }
  });
  return out;
})();
