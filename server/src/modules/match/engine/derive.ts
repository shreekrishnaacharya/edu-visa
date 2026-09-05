// ---------------------------------------------------------------------------
// deriveProfile(student) → DerivedProfile
// Ported VERBATIM from the prototype's src/mocks/engine/derive.ts.  Guarded by
// the golden test (test/engine-golden.spec.ts).
// ---------------------------------------------------------------------------

import { Currency } from '../../../common/enums';
import { DerivedProfile, EngineStudent } from './types';
import { FX_TO_AUD, toAud as toAudDefault, toCanonicalGpa, toIeltsEquivalent } from './reference';

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.44;

/**
 * `fxRates` defaults to the static table but is DB-backed in production via
 * ReferenceService — see ProfileService.deriveAndSave.
 */
export function deriveProfile(
  student: EngineStudent,
  version = 1,
  fxRates: Record<Currency, number> = FX_TO_AUD,
): DerivedProfile {
  const toAud = (amount: number, currency: Currency) =>
    fxRates === FX_TO_AUD ? toAudDefault(amount, currency) : Math.round(amount * fxRates[currency]);
  // --- canonical GPA: take the highest qualification we have ----------------
  const sorted = [...student.academic].sort((a, b) => b.end_year - a.end_year);
  const primary = sorted[0];
  const canonical_gpa = primary
    ? toCanonicalGpa(primary.gpa_value, primary.gpa_scale)
    : 0;

  // --- English: best available test, converted to an IELTS-equivalent band --
  let english_band: number | null = null;
  let english_source = 'no test on file';
  for (const t of student.language_tests) {
    const band = toIeltsEquivalent(t.test, t.overall);
    if (english_band == null || band > english_band) {
      english_band = band;
      english_source = `${t.test} ${t.overall} → IELTS ${band}`;
    }
  }

  // --- relevant work experience in months ---------------------------------
  const relevant_experience_months = Math.round(
    student.work
      .filter((w) => w.relevant)
      .reduce((sum, w) => {
        const end = w.end_date ? new Date(w.end_date) : new Date();
        return (
          sum +
          Math.max(
            0,
            (end.getTime() - new Date(w.start_date).getTime()) / MONTH_MS,
          )
        );
      }, 0),
  );

  // --- finances, all normalised to AUD ---------------------------------
  const annual_household_income_aud = student.finance.income_sources.reduce(
    (sum, s) => sum + toAud(s.amount, s.currency),
    0,
  );
  const liquidAssets = student.finance.assets
    .filter((a) => a.liquid)
    .reduce((sum, a) => sum + toAud(a.amount, a.currency), 0);
  const liabilities = student.finance.liabilities.reduce(
    (sum, l) => sum + toAud(l.amount, l.currency),
    0,
  );
  const available_funds_aud = Math.max(
    0,
    Math.round(liquidAssets + annual_household_income_aud - liabilities * 0.5),
  );

  const budgetAud = toAud(
    student.preferences.max_tuition_per_year,
    student.preferences.tuition_currency,
  );
  const accompanyingDependants = student.dependants.filter(
    (d) => d.accompanying,
  ).length;
  const livingPerYear = 29000 + accompanyingDependants * 8000;
  const needed = budgetAud * 2 + livingPerYear * 2;
  const affordability_score = clamp(
    Math.round((available_funds_aud / needed) * 100),
  );

  const pr_intent =
    student.career_goal.long_term === 'PR'
      ? 'high'
      : student.career_goal.long_term === 'employment'
        ? 'medium'
        : 'low';

  return {
    student_id: student.id,
    version,
    canonical_gpa,
    english_band,
    english_source,
    relevant_experience_months,
    annual_household_income_aud,
    available_funds_aud,
    affordability_score,
    pr_intent,
    highest_level: primary?.level ?? null,
    field_of_study: primary?.course ?? student.career_goal.intended_field,
  };
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}
