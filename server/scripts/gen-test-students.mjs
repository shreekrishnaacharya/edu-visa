// Generates 100 diverse SYNTHETIC student intake payloads for load/behaviour
// testing. Not real people. Tagged branch="QA Batch <date>" so they can be
// filtered out / purged later. Varies GPA scale, currency, country
// preference, career field, financial posture, visa history, dependants.
import { writeFileSync } from "fs";

const FIRST = ["Priya","Rajesh","Anita","Suresh","Kavita","Mohan","Deepika","Vikram","Sunita","Arjun","Meena","Rohan","Pooja","Sanjay","Nisha","Amit","Rekha","Vijay","Sarita","Karan","Divya","Manoj","Lata","Ashok","Preeti","Ravi","Shreya","Naveen","Anju","Deepak2","Bishal","Sabina","Prakash","Gita","Ramesh","Sushma","Bikash","Anisha","Dinesh","Yamuna","Krishna2","Radha","Hari","Kamala","Bhim","Saraswati","Gopal","Laxmi","Shyam","Parvati"];
const LAST = ["Sharma","Gurung","Thapa","Adhikari","Maharjan","Shrestha","Rai","Karki","Basnet","Poudel","Khadka","Bhattarai","Tamang","Magar","Chhetri","Joshi","Pandey","Regmi","Acharya","Bhandari"];
const CITIES_NP = ["Kathmandu","Pokhara","Biratnagar","Lalitpur","Chitwan","Butwal","Nepalgunj","Dharan","Hetauda","Itahari"];
const GPA_SCALES = ["4.0","10.0","percentage","division"];
const TESTS = ["IELTS","PTE","TOEFL","Duolingo"];
const COUNTRIES = ["AU","NZ","UK","CA","US"];
const FIELDS = ["Business Analytics","Data Science","Information Technology","Accounting","Management","Nursing","Public Health","Marketing","Cybersecurity","Artificial Intelligence","Construction Management","Software Engineering"];
const OCC = ["Data Analyst","ML Engineer","Systems Analyst","Accountant","Operations Manager","Registered Nurse","Health Policy Analyst","Marketing Manager","Security Analyst","AI Researcher","Project Manager","Software Engineer"];
const LEVELS = ["Bachelor","PG Diploma","Master","PhD"];
const LONG_TERM = ["employment","PR","return home","business","further study"];
const CURR = ["NPR","AUD","GBP","CAD","USD"];

function pick(arr, seed) { return arr[seed % arr.length]; }
function rand(seed, lo, hi) { const x = Math.sin(seed * 999) * 10000; const f = x - Math.floor(x); return Math.round(lo + f * (hi - lo)); }
function randf(seed, lo, hi) { const x = Math.sin(seed * 7777) * 10000; const f = x - Math.floor(x); return +(lo + f * (hi - lo)).toFixed(2); }

function gpaFor(scale, idx) {
  switch (scale) {
    case "4.0": return randf(idx + 1, 2.2, 4.0);
    case "10.0": return randf(idx + 2, 5.5, 9.5);
    case "percentage": return rand(idx + 3, 45, 95);
    case "division": return pick([1, 2, 3], idx);
    default: return 3.0;
  }
}

export function buildStudent(idx) {
  const first = pick(FIRST, idx);
  const last = pick(LAST, idx + 3);
  const gpaScale = pick(GPA_SCALES, idx);
  const hasTest = idx % 5 !== 0; // 20% have no English test on file
  const test = pick(TESTS, idx);
  const overallByTest = { IELTS: randf(idx, 5.5, 8.5), PTE: rand(idx, 45, 88), TOEFL: rand(idx, 60, 118), Duolingo: rand(idx, 85, 155) };
  const married = idx % 4 === 0;
  const hasRefusal = idx % 9 === 0;
  const prereqField = pick(FIELDS, idx);
  const targetCountries = married ? [pick(COUNTRIES, idx), pick(COUNTRIES, idx + 1)] : [pick(COUNTRIES, idx)];
  const dob = `${1993 + (idx % 12)}-${String(1 + (idx % 12)).padStart(2, "0")}-${String(1 + (idx % 27)).padStart(2, "0")}`;
  const workYears = rand(idx, 0, 6);
  const currency = married ? "NPR" : pick(CURR, idx);

  return {
    full_name: `${first} ${last} (QA${idx})`,
    date_of_birth: dob,
    gender: idx % 3 === 0 ? "female" : idx % 3 === 1 ? "male" : "other",
    nationality: "Nepal",
    current_city: pick(CITIES_NP, idx),
    passport_status: pick(["none", "applied", "held"], idx),
    marital_status: married ? "married" : "single",
    dependants: married
      ? [{ relationship: "spouse", full_name: `Partner of ${first}`, date_of_birth: "1995-05-05", accompanying: idx % 2 === 0, passport_status: "none" }]
      : [],
    state: pick(["Enquiry", "Profiling", "Shortlisted"], idx),
    counsellor: idx % 2 === 0 ? "Bina Rai" : "Suman K.C.",
    branch: `QA Batch 2026-09-02`,
    consent_given_at: new Date().toISOString(),
    academic: [
      {
        level: "Bachelor",
        course: `Bachelor of ${prereqField}`,
        institution: "Tribhuvan University",
        country: "Nepal",
        start_year: 2016 + (idx % 5),
        end_year: 2020 + (idx % 5),
        gpa_value: gpaFor(gpaScale, idx),
        gpa_scale: gpaScale,
        gap_months: idx % 4 === 0 ? 8 : 0,
      },
    ],
    language_tests: hasTest
      ? [{ test, overall: overallByTest[test], listening: null, reading: null, writing: null, speaking: null, test_date: "2025-09-01" }]
      : [],
    work: workYears
      ? [{ title: pick(OCC, idx), employer: "Everest Global Pvt. Ltd.", industry: prereqField, country: "Nepal", start_date: new Date(Date.now() - workYears * 365 * 86400000).toISOString().slice(0, 10), end_date: null, full_time: true, relevant: idx % 2 === 0 }]
      : [],
    career_goal: {
      target_occupation: pick(OCC, idx),
      target_industry: prereqField,
      intended_field: prereqField,
      reason: `Progression into ${prereqField}.`,
      change_field: idx % 3 === 0,
      long_term: pick(LONG_TERM, idx),
    },
    finance: {
      income_sources: [
        { kind: "father", amount: rand(idx, 800000, 4500000), currency: "NPR", evidence: idx % 2 === 0 },
        { kind: "self", amount: rand(idx + 1, 0, 900000), currency: "NPR", evidence: idx % 3 === 0 },
      ],
      assets: [
        { kind: "bank savings", amount: rand(idx + 2, 500000, 7000000), currency: "NPR", liquid: true },
        ...(idx % 3 === 0 ? [{ kind: "education loan", amount: rand(idx + 3, 2000000, 6000000), currency: "NPR", liquid: true }] : []),
      ],
      liabilities: idx % 3 === 0 ? [{ kind: "Education loan servicing", amount: rand(idx + 4, 2000000, 6000000), currency: "NPR", monthly_repayment: rand(idx + 5, 15000, 60000) }] : [],
    },
    sponsors: [{ relationship: "Father", occupation: "Business", annual_income: rand(idx + 6, 800000, 4500000), currency: "NPR", evidence: true }],
    visa_history: hasRefusal
      ? [{ country: pick(["UK", "US", "CA"], idx), visa_type: "Student", outcome: "refused", decision_date: "2020-03-01", refusal_reason: "Insufficient funds evidence" }]
      : [],
    preferences: {
      preferred_countries: targetCountries,
      preferred_cities: targetCountries.includes("AU") ? [pick(["Sydney", "Melbourne", "Brisbane", "Perth"], idx)] : ["Auckland"],
      degree_level: pick(LEVELS, idx) === "PhD" ? "Master" : pick(LEVELS, idx), // keep realistic for AU masters catalogue
      field: prereqField,
      max_tuition_per_year: rand(idx + 7, 28000, 65000),
      tuition_currency: "AUD",
      intake: pick(["Feb 2026", "Jul 2026", "Nov 2026"], idx),
      scholarship_required: idx % 2 === 0,
      min_scholarship_pct: idx % 2 === 0 ? 15 : 0,
      ranking_matters: idx % 3 === 0,
      city_size: pick(["big", "small", "either"], idx),
      cost_sensitivity: idx % 2 === 0 ? "high" : "low",
      part_time_work_important: idx % 2 === 1,
    },
    _qa: { idx, currency, hasRefusal, hasTest, gpaScale },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const students = Array.from({ length: 100 }, (_, i) => buildStudent(i + 1));
  writeFileSync("/tmp/qa-students.json", JSON.stringify(students, null, 2));
  console.log(`Generated ${students.length} synthetic students -> /tmp/qa-students.json`);
}
