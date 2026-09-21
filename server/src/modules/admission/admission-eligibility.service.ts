import { Injectable, NotFoundException } from '@nestjs/common';
import { Student } from '../student/entities/student.entity';
import { StudentProfile } from '../profile/student-profile.entity';
import { ReferenceService } from '../reference/reference.service';
import { ADMISSION_POLICIES, findAdmissionPolicy } from './admission-policy.data';
import { AcademicBand, AdmissionPolicy, ProgramLevel } from './admission-policy.types';
import { DegreeLevel } from '../../common/enums';

export type CheckStatus = 'pass' | 'fail' | 'unknown' | 'info';

export interface EligibilityCheck {
  rule: string;
  status: CheckStatus;
  detail: string;
}

export interface EligibilityVerdict {
  policy_key: string;
  institution: string;
  source: string;
  matched_band: AcademicBand | null;
  overall: 'eligible' | 'not_eligible' | 'conditionally_eligible' | 'insufficient_data';
  checks: EligibilityCheck[];
}

const LEVEL_TO_PROGRAM: Record<DegreeLevel, ProgramLevel> = {
  Bachelor: 'UG',
  'PG Diploma': 'PG',
  Master: 'PG',
  PhD: 'PG_RESEARCH',
};

/**
 * Deterministic pre-visa gate: does this student clear THIS institution's
 * actual admission criteria (academic score, English score, age, marriage/
 * dependant rules, sponsor income) — separate from and prior to the
 * `match` module's visa/course-fit scoring, per the causal chain these
 * source documents make explicit: admission eligibility first, visa
 * eligibility only follows an actual offer. Deliberately does NOT touch
 * `MatchResult`/the engine's `overall` score — this is a different question
 * ("would this specific institution even offer you a place") answered from a
 * different, narrower data source (9 real agent-facing institution briefings,
 * not the CRICOS catalogue).
 *
 * Every check is graded 'pass' | 'fail' | 'unknown' | 'info' rather than
 * collapsed into a single yes/no — most institutions' rules have caveats
 * ("case by case", "with justified reason") that a hard boolean would
 * misrepresent as more certain than the source document actually is.
 */
@Injectable()
export class AdmissionEligibilityService {
  constructor(private readonly reference: ReferenceService) {}

  listPolicies() {
    return ADMISSION_POLICIES.map((p) => ({
      key: p.key,
      institution: p.institution,
      also_covers: p.also_covers ?? [],
      scope: p.scope,
      source: p.source,
    }));
  }

  getPolicy(key: string): AdmissionPolicy {
    const policy = findAdmissionPolicy(key);
    if (!policy) throw new NotFoundException(`No admission policy on file for "${key}"`);
    return policy;
  }

  evaluate(
    policyKey: string,
    student: Student,
    profile: StudentProfile | null,
    opts: { level?: ProgramLevel; courseLabel?: string } = {},
  ): EligibilityVerdict {
    const policy = this.getPolicy(policyKey);
    const checks: EligibilityCheck[] = [];

    const level = opts.level ?? this.inferLevel(student, profile);
    const band = this.pickBand(policy, level, opts.courseLabel);
    checks.push(...this.academicChecks(policy, band, profile));
    checks.push(...this.englishChecks(band, student, profile));
    checks.push(...this.ageChecks(policy, student, level));
    checks.push(...this.maritalChecks(policy, student, level));
    checks.push(...this.marriageDurationChecks(policy, student));
    checks.push(...this.spouseQualificationChecks(policy, student, profile));
    checks.push(...this.studyGapChecks(policy, student, level));
    checks.push(...this.backlogChecks(policy, student, level));
    checks.push(...this.doubleMastersChecks(policy, student));
    checks.push(...this.incomeChecks(policy, student, profile));
    checks.push(...this.sponsorCompositionChecks(policy, student));
    checks.push(...this.visaHistoryChecks(policy, student));
    checks.push(...this.bankNotice(policy, student));

    return {
      policy_key: policy.key,
      institution: policy.institution,
      source: policy.source,
      matched_band: band,
      overall: this.overallVerdict(checks),
      checks,
    };
  }

  private inferLevel(student: Student, profile: StudentProfile | null): ProgramLevel {
    const target = student.preferences?.degree_level ?? (profile?.highest_level as DegreeLevel | undefined);
    return target ? LEVEL_TO_PROGRAM[target] ?? 'PG' : 'PG';
  }

  private pickBand(policy: AdmissionPolicy, level: ProgramLevel, courseLabel?: string): AcademicBand | null {
    const candidates = policy.academics.filter((b) => b.level === level);
    if (!candidates.length) return null;
    if (courseLabel) {
      const needle = courseLabel.toLowerCase();
      const named = candidates.find((b) => b.label.toLowerCase().includes(needle));
      if (named) return named;
    }
    // Prefer a "general" band over a named-course one when no course was specified.
    return candidates.find((b) => /general/i.test(b.label)) ?? candidates[0];
  }

  private academicChecks(policy: AdmissionPolicy, band: AcademicBand | null, profile: StudentProfile | null): EligibilityCheck[] {
    if (!band) {
      return [{ rule: 'academic score', status: 'unknown', detail: `No academic-threshold data on file for ${policy.institution} at this level — verify directly.` }];
    }
    if (band.min_canonical_score == null) {
      return [{ rule: 'academic score', status: 'unknown', detail: `${policy.institution} — ${band.label}: no numeric academic figure captured in the source document.` }];
    }
    if (profile == null) {
      return [{ rule: 'academic score', status: 'unknown', detail: `No derived academic profile on file. Required: ${band.source_expression} (${band.min_canonical_score}/100 canonical).` }];
    }
    const pass = profile.canonical_gpa >= band.min_canonical_score;
    return [
      {
        rule: 'academic score',
        status: pass ? 'pass' : 'fail',
        detail: `${band.label}: requires ${band.source_expression} (${band.min_canonical_score}/100 canonical) — student is at ${profile.canonical_gpa}/100.`,
      },
    ];
  }

  private englishChecks(band: AcademicBand | null, student: Student, profile: StudentProfile | null): EligibilityCheck[] {
    if (!band || (band.min_ielts_overall == null && band.min_pte_overall == null)) return [];
    const tests = student.language_tests ?? [];
    const ielts = tests.find((t) => t.test === 'IELTS');
    const pte = tests.find((t) => t.test === 'PTE');

    if (ielts && band.min_ielts_overall != null) {
      const bands = [ielts.listening, ielts.reading, ielts.writing, ielts.speaking].filter((v): v is number => v != null);
      const minBand = bands.length ? Math.min(...bands) : null;
      const overallOk = ielts.overall >= band.min_ielts_overall;
      const bandOk = band.min_ielts_band == null || minBand == null ? null : minBand >= band.min_ielts_band;
      const ok = overallOk && bandOk !== false;
      return [
        {
          rule: 'English score (IELTS)',
          status: bandOk == null ? (overallOk ? 'unknown' : 'fail') : ok ? 'pass' : 'fail',
          detail: `Requires IELTS overall ${band.min_ielts_overall}${band.min_ielts_band != null ? `, no band below ${band.min_ielts_band}` : ''} — student has overall ${ielts.overall}${minBand != null ? `, lowest band ${minBand}` : ' (per-skill scores not on file)'}.`,
        },
      ];
    }
    if (pte && band.min_pte_overall != null) {
      const bands = [pte.listening, pte.reading, pte.writing, pte.speaking].filter((v): v is number => v != null);
      const minBand = bands.length ? Math.min(...bands) : null;
      const overallOk = pte.overall >= band.min_pte_overall;
      const bandOk = band.min_pte_band == null || minBand == null ? null : minBand >= band.min_pte_band;
      const ok = overallOk && bandOk !== false;
      return [
        {
          rule: 'English score (PTE)',
          status: bandOk == null ? (overallOk ? 'unknown' : 'fail') : ok ? 'pass' : 'fail',
          detail: `Requires PTE overall ${band.min_pte_overall}${band.min_pte_band != null ? `, no band below ${band.min_pte_band}` : ''} — student has overall ${pte.overall}${minBand != null ? `, lowest band ${minBand}` : ' (per-skill scores not on file)'}.`,
        },
      ];
    }
    // No matching test type on file — fall back to the derived IELTS-equivalent overall only (can't check per-band from a converted figure).
    if (profile?.english_band != null && band.min_ielts_overall != null) {
      return [
        {
          rule: 'English score',
          status: profile.english_band >= band.min_ielts_overall ? 'pass' : 'fail',
          detail: `Requires IELTS-equivalent overall ${band.min_ielts_overall} — student's derived equivalent is ${profile.english_band} (${profile.english_source}). Per-band minimums could not be checked from a converted score — verify against the actual test result.`,
        },
      ];
    }
    return [{ rule: 'English score', status: 'unknown', detail: 'No English test on file.' }];
  }

  private ageChecks(policy: AdmissionPolicy, student: Student, level: ProgramLevel): EligibilityCheck[] {
    if (!policy.age_limit || !student.date_of_birth) return [];
    const age = Math.floor((Date.now() - new Date(student.date_of_birth).getTime()) / 3.15576e10);
    const cap =
      level === 'UG' ? policy.age_limit.ug_max : level === 'PG_RESEARCH' ? policy.age_limit.research_max_high ?? policy.age_limit.pg_max : policy.age_limit.pg_max;
    if (cap == null) return [];
    return [
      {
        rule: 'age limit',
        status: age <= cap ? 'pass' : 'fail',
        detail: `${policy.institution} age limit for this level: ${cap}${policy.age_limit.note ? ` (${policy.age_limit.note})` : ''} — student is ${age}.`,
      },
    ];
  }

  private maritalChecks(policy: AdmissionPolicy, student: Student, level: ProgramLevel): EligibilityCheck[] {
    if (!policy.marriage_rules?.length) return [];
    const checks: EligibilityCheck[] = [];
    const isMarried = student.marital_status === 'married';
    const blanketUgReject = level === 'UG' && isMarried && policy.marriage_rules.some((r) => /UG[-\s]*reject|undergraduate programs$/i.test(r) || /married applicants accepted for undergraduate/i.test(r));
    if (blanketUgReject) {
      checks.push({ rule: 'marital status', status: 'fail', detail: `${policy.institution} does not accept married applicants for undergraduate programs.` });
    } else if (isMarried) {
      checks.push({ rule: 'marital status', status: 'info', detail: `Student is married — review ${policy.institution}'s marriage-specific rules: ${policy.marriage_rules.join(' ')}` });
    }
    if (student.dependants?.some((d) => d.accompanying)) {
      checks.push({ rule: 'accompanying dependants', status: 'info', detail: `Student has accompanying dependant(s) — review ${policy.institution}'s dependant rules alongside its marriage rules.` });
    }
    return checks;
  }

  /** Only fires when the source gave an actual number ("minimum 12 months") — never inferred from the narrative rule text. */
  private marriageDurationChecks(policy: AdmissionPolicy, student: Student): EligibilityCheck[] {
    if (policy.min_marriage_months == null || student.marital_status !== 'married') return [];
    const spouse = student.dependants?.find((d) => d.relationship === 'spouse');
    if (!spouse?.marriage_date) {
      return [{ rule: 'marriage duration', status: 'unknown', detail: `${policy.institution} requires a marriage of at least ${policy.min_marriage_months} months — no marriage date on file for the spouse.` }];
    }
    const months = Math.floor((Date.now() - new Date(spouse.marriage_date).getTime()) / (30.44 * 24 * 3600 * 1000));
    return [
      {
        rule: 'marriage duration',
        status: months >= policy.min_marriage_months ? 'pass' : 'fail',
        detail: `${policy.institution} requires a marriage of at least ${policy.min_marriage_months} months — student's marriage is ${months} months old.`,
      },
    ];
  }

  private static readonly LEVEL_RANK: Record<string, number> = {
    'High School': 0,
    Bachelor: 1,
    'PG Diploma': 2,
    Master: 2,
    PhD: 3,
  };

  /**
   * Two genuinely different claims a source can make about a spouse's
   * education, kept separate rather than one overloaded threshold: "equal
   * to the APPLICANT's own level" (relative — needs the applicant's own
   * highest level, from `profile.highest_level`) vs a flat minimum level
   * ("a +2/Year-12 qualification is acceptable") that doesn't move with the
   * applicant's own level at all.
   */
  private spouseQualificationChecks(policy: AdmissionPolicy, student: Student, profile: StudentProfile | null): EligibilityCheck[] {
    const rule = policy.spouse_qualification_rule;
    if (!rule || student.marital_status !== 'married') return [];
    if (!rule.required_equal && !rule.min_level) {
      return [{ rule: 'spouse qualification', status: 'info', detail: `${policy.institution}: ${rule.note ?? 'no equal-qualification requirement for the spouse.'}` }];
    }
    const spouse = student.dependants?.find((d) => d.relationship === 'spouse');
    const requirement = rule.required_equal ? "match the applicant's own qualification level" : `be at least ${rule.min_level}`;
    if (!spouse?.qualification_level) {
      return [{ rule: 'spouse qualification', status: 'unknown', detail: `${policy.institution} requires the spouse's qualification to ${requirement} — no spouse qualification on file.${rule.note ? ` (${rule.note})` : ''}` }];
    }
    const spouseRank = AdmissionEligibilityService.LEVEL_RANK[spouse.qualification_level] ?? -1;
    if (rule.required_equal) {
      const applicantLevel = profile?.highest_level;
      if (!applicantLevel) {
        return [{ rule: 'spouse qualification', status: 'unknown', detail: `${policy.institution} requires the spouse's qualification to match the applicant's own — applicant's own highest level isn't on file yet.` }];
      }
      const applicantRank = AdmissionEligibilityService.LEVEL_RANK[applicantLevel] ?? -1;
      return [
        {
          rule: 'spouse qualification',
          status: spouseRank >= applicantRank ? 'pass' : 'fail',
          detail: `${policy.institution} requires the spouse's qualification (${spouse.qualification_level}) to match the applicant's own (${applicantLevel}).${rule.note ? ` (${rule.note})` : ''}`,
        },
      ];
    }
    const minRank = AdmissionEligibilityService.LEVEL_RANK[rule.min_level!] ?? -1;
    return [
      {
        rule: 'spouse qualification',
        status: spouseRank >= minRank ? 'pass' : 'fail',
        detail: `${policy.institution} requires the spouse's qualification to be at least ${rule.min_level} — spouse is at ${spouse.qualification_level}.${rule.note ? ` (${rule.note})` : ''}`,
      },
    ];
  }

  /** Only fires when the SOURCE gave an actual number ("more than a 5-year gap... not acceptable") — never inferred from the narrative rule text. */
  private studyGapChecks(policy: AdmissionPolicy, student: Student, level: ProgramLevel): EligibilityCheck[] {
    const gaps = (student.academic ?? []).map((a) => a.gap_months ?? 0);
    const maxGap = gaps.length ? Math.max(...gaps) : 0;
    const cap = policy.max_study_gap_months?.find((g) => g.level === level);
    if (cap) {
      return [
        {
          rule: 'study gap',
          status: maxGap <= cap.months ? 'pass' : 'fail',
          detail: `${policy.institution} allows at most ${cap.months} months' study gap at this level${cap.note ? ` (${cap.note})` : ''} — student's longest recorded gap is ${maxGap} months.`,
        },
      ];
    }
    // No hard number for this institution/level — still surface the narrative rule if the student actually has a gap, rather than staying silent.
    if (policy.study_gap_rules?.length && maxGap > 0) {
      return [{ rule: 'study gap', status: 'info', detail: `Student has a recorded study gap of ${maxGap} months. ${policy.institution}'s gap rules: ${policy.study_gap_rules.join(' ')}` }];
    }
    return [];
  }

  /**
   * Checks the backlog count on the PRIOR qualification that gates entry to
   * `level` — a UG application is gated by the student's High School record,
   * a PG one by their Bachelor's record (that's genuinely what "no backlogs
   * in Year 12" vs "8 backlogs in the bachelor degree" each mean in the
   * source docs — two different levels' rules, not one number).
   */
  private backlogChecks(policy: AdmissionPolicy, student: Student, level: ProgramLevel): EligibilityCheck[] {
    const cap = policy.max_backlogs?.find((b) => b.level === level);
    if (!cap) return [];
    const priorLevel = level === 'UG' ? 'High School' : 'Bachelor';
    const records = (student.academic ?? []).filter((a) => a.level === priorLevel);
    if (!records.length) {
      return [{ rule: 'backlogs', status: 'unknown', detail: `${policy.institution} allows at most ${cap.count} backlogs on the ${priorLevel} record for this level${cap.note ? ` (${cap.note})` : ''} — no ${priorLevel} record on file.` }];
    }
    const maxBacklogs = Math.max(...records.map((a) => a.backlogs ?? 0));
    return [
      {
        rule: 'backlogs',
        status: maxBacklogs <= cap.count ? 'pass' : 'fail',
        detail: `${policy.institution} allows at most ${cap.count} backlogs on the ${priorLevel} record for this level${cap.note ? ` (${cap.note})` : ''} — student has ${maxBacklogs}.`,
      },
    ];
  }

  private doubleMastersChecks(policy: AdmissionPolicy, student: Student): EligibilityCheck[] {
    if (!policy.double_masters_policy) return [];
    const masterCount = (student.academic ?? []).filter((a) => a.level === 'Master').length;
    if (masterCount < 2) return [];
    // A blanket ban reads as a flat "not accepted/acceptable" with no escape
    // clause; anything conditional ("if...", "unless...", "can instead apply
    // for a research course") is real but not an automatic fail.
    const blanket = /not accept(ed|able)/i.test(policy.double_masters_policy) && !/\bif\b|\bunless\b|\bprovided\b|research course/i.test(policy.double_masters_policy);
    return [
      {
        rule: "double Master's",
        status: blanket ? 'fail' : 'info',
        detail: `Student has ${masterCount} Master's-level records on file. ${policy.institution}'s policy: "${policy.double_masters_policy}"`,
      },
    ];
  }

  // Canonical relationship buckets shared between a policy's free-text
  // `relation` field and a student's free-text `sponsor.relationship` — the
  // ordering matters ("brother-in-law" must be caught before the generic
  // "brother"/sibling pattern eats it, since several institutions treat
  // siblings-in-law very differently from siblings or from parents-in-law).
  private classifyRelation(text: string): Set<string> {
    const t = text.toLowerCase();
    const cats = new Set<string>();
    if (/brother-in-law|sister-in-law/.test(t)) cats.add('in-law-sibling');
    if (/father-in-law|mother-in-law/.test(t)) cats.add('in-law-parent');
    else if (/in-laws?\b/.test(t) && !cats.has('in-law-sibling')) cats.add('in-law-parent');
    if (/\bparents?\b|\bfather\b|\bmother\b/.test(t)) cats.add('parent');
    if (/grandparent/.test(t)) cats.add('grandparent');
    if (/\bspouse\b|\bhusband\b|\bwife\b/.test(t)) cats.add('spouse');
    if (/\buncle\b|\baunt\b/.test(t)) cats.add('uncle-aunt');
    if (/\bcousin\b/.test(t)) cats.add('cousin');
    if (/\bself\b/.test(t)) cats.add('self');
    if (/\b(brother|sister|sibling)s?\b/.test(t) && !cats.has('in-law-sibling')) cats.add('sibling');
    return cats;
  }

  /**
   * Checks WHO is sponsoring, not just how much — a student with sufficient
   * total income can still fail an institution that rejects a specific
   * sponsor relationship (e.g. a brother-in-law), caps one relationship's
   * share (e.g. "in-laws max 20%"), or requires a FLOOR from primary sponsors
   * (e.g. "at least 70% from parents"). Floor and ceiling are genuinely
   * different things a real source can state about the same category — a
   * student sponsored 100% by their father must PASS a "minimum 70% from
   * parents" rule, not fail it, which is why `SponsorRule` carries separate
   * `min_percent`/`max_percent` fields rather than one overloaded number.
   *
   * Evaluated per CATEGORY, not per individual sponsor: "80% of income must
   * come from primary sponsors" is about the combined contribution of every
   * sponsor classified as parent/grandparent, not any one sponsor's own %
   * against that figure (a father alone at 60% shouldn't "fail" a combined
   * floor that a mother's additional 25% would clear). Deliberately
   * conservative: an unclassifiable relationship string surfaces as 'info'
   * with the computed percentage rather than guessing at pass/fail.
   */
  private sponsorCompositionChecks(policy: AdmissionPolicy, student: Student): EligibilityCheck[] {
    if (!policy.sponsors.length) return [];
    const sponsors = student.sponsors ?? [];
    if (!sponsors.length) return [];

    const withAud = sponsors.map((s) => ({
      relationship: s.relationship,
      aud: this.reference.toAud(s.annual_income, s.currency),
      cats: this.classifyRelation(s.relationship),
    }));
    const total = withAud.reduce((sum, s) => sum + s.aud, 0);
    if (total <= 0) return [];

    const checks: EligibilityCheck[] = [];

    // 1. Any individual sponsor matching an explicitly banned relationship.
    for (const s of withAud) {
      const banned = policy.sponsors.find((rule) => rule.status === 'not_accepted' && [...this.classifyRelation(rule.relation)].some((c) => s.cats.has(c)));
      if (banned) {
        const pct = Math.round((s.aud / total) * 100);
        checks.push({
          rule: 'sponsor composition',
          status: 'fail',
          detail: `${policy.institution} does not accept "${banned.relation}" as a sponsor — student has a sponsor recorded as "${s.relationship}" (~${pct}% of declared income).`,
        });
      }
    }

    // 2. Category-aggregate floor/ceiling checks.
    for (const rule of policy.sponsors) {
      if (rule.min_percent == null && rule.max_percent == null) continue;
      const ruleCats = this.classifyRelation(rule.relation);
      if (!ruleCats.size) continue;
      const matchingAud = withAud.filter((s) => [...s.cats].some((c) => ruleCats.has(c))).reduce((sum, s) => sum + s.aud, 0);
      if (matchingAud === 0 && rule.min_percent == null) continue; // nothing to say about a ceiling category with zero contribution
      const pct = Math.round((matchingAud / total) * 100);
      if (rule.min_percent != null && pct < rule.min_percent) {
        checks.push({ rule: 'sponsor composition', status: 'fail', detail: `${policy.institution} requires at least ${rule.min_percent}% of sponsor income from "${rule.relation}" — student's sponsors in that category contribute ~${pct}% combined.` });
      } else if (rule.max_percent != null && pct > rule.max_percent) {
        checks.push({ rule: 'sponsor composition', status: 'fail', detail: `${policy.institution} caps "${rule.relation}" sponsorship at ${rule.max_percent}% — student's sponsors in that category contribute ~${pct}% combined.` });
      } else {
        checks.push({
          rule: 'sponsor composition',
          status: 'info',
          detail: `Sponsors classified as "${rule.relation}" contribute ~${pct}% of declared income combined (${policy.institution}'s rule: ${rule.status}${rule.min_percent != null ? `, min ${rule.min_percent}%` : ''}${rule.max_percent != null ? `, max ${rule.max_percent}%` : ''}).`,
        });
      }
    }

    // 3. Any sponsor this policy's rules don't mention at all.
    for (const s of withAud) {
      const anyMatch = policy.sponsors.some((rule) => [...this.classifyRelation(rule.relation)].some((c) => s.cats.has(c)));
      if (!anyMatch) {
        const pct = Math.round((s.aud / total) * 100);
        checks.push({
          rule: 'sponsor composition',
          status: 'info',
          detail: `Sponsor "${s.relationship}" (~${pct}% of declared income) is not automatically classified against ${policy.institution}'s sponsor rules; verify manually.`,
        });
      }
    }

    return checks;
  }

  private incomeChecks(policy: AdmissionPolicy, student: Student, profile: StudentProfile | null): EligibilityCheck[] {
    if (!policy.income_thresholds.length) return [];
    const hasDependant = student.dependants?.some((d) => d.accompanying) ?? false;
    const isMarried = student.marital_status === 'married';
    const scenario =
      (hasDependant && policy.income_thresholds.find((t) => /dependant|dependent/i.test(t.scenario))) ||
      (isMarried && policy.income_thresholds.find((t) => /married/i.test(t.scenario))) ||
      policy.income_thresholds.find((t) => /single/i.test(t.scenario)) ||
      policy.income_thresholds[0];
    const thresholdAud = scenario.min_annual_aud ?? (scenario.min_annual_npr_lakh != null ? this.reference.toAud(scenario.min_annual_npr_lakh * 100_000, 'NPR') : null);
    if (thresholdAud == null) return [];
    if (profile == null) {
      return [{ rule: 'sponsor/household income', status: 'unknown', detail: `No derived financial profile on file. Required (${scenario.scenario}): ${scenario.min_annual_npr_lakh != null ? `NPR ${scenario.min_annual_npr_lakh} lakh/yr` : `AUD ${scenario.min_annual_aud}/yr`}.` }];
    }
    const pass = profile.annual_household_income_aud >= thresholdAud;
    return [
      {
        rule: 'sponsor/household income',
        status: pass ? 'pass' : 'fail',
        detail: `${policy.institution} requires ${scenario.min_annual_npr_lakh != null ? `NPR ${scenario.min_annual_npr_lakh} lakh/yr` : `AUD ${scenario.min_annual_aud}/yr`} (scenario: ${scenario.scenario}, ≈AUD ${thresholdAud.toLocaleString()}) — student's derived household income is AUD ${profile.annual_household_income_aud.toLocaleString()}/yr. See the separate "sponsor composition" check(s) below for whether the specific sponsors count toward this.`,
      },
    ];
  }

  private visaHistoryChecks(policy: AdmissionPolicy, student: Student): EligibilityCheck[] {
    if (!policy.visa_refusal_policy) return [];
    const refused = student.visa_history?.some((v) => v.outcome === 'refused');
    if (!refused) return [];
    const blanket = /no (visa )?refusals accepted/i.test(policy.visa_refusal_policy) && !/case.?by.?case|acceptable if/i.test(policy.visa_refusal_policy);
    return [
      {
        rule: 'prior visa refusal',
        status: blanket ? 'fail' : 'info',
        detail: `Student has a prior visa refusal on file. ${policy.institution}'s policy: "${policy.visa_refusal_policy}"`,
      },
    ];
  }

  /** Real per-sponsor check when `sponsor.bank_name` is on file; a blanket notice (as before) when it isn't. */
  private bankNotice(policy: AdmissionPolicy, student: Student): EligibilityCheck[] {
    if (!policy.excluded_banks?.length) return [];
    const named = (student.sponsors ?? []).filter((s) => s.bank_name?.trim());
    if (!named.length) {
      return [
        {
          rule: 'sponsor bank eligibility',
          status: 'info',
          detail: `${policy.institution} does not accept funds from: ${policy.excluded_banks.join(', ')}. No sponsor bank name on file to check automatically — confirm manually.`,
        },
      ];
    }
    return named.map((s) => {
      const bank = s.bank_name.trim().toLowerCase();
      const hit = policy.excluded_banks!.find((b) => {
        const excluded = b.toLowerCase().replace(/\s+bank\b/, '');
        return bank.includes(excluded) || excluded.includes(bank);
      });
      return hit
        ? { rule: 'sponsor bank eligibility', status: 'fail' as const, detail: `${policy.institution} does not accept funds from ${hit} — sponsor "${s.relationship}"'s funds are held at "${s.bank_name}".` }
        : { rule: 'sponsor bank eligibility', status: 'pass' as const, detail: `Sponsor "${s.relationship}"'s bank ("${s.bank_name}") is not on ${policy.institution}'s excluded list (${policy.excluded_banks!.join(', ')}).` };
    });
  }

  private overallVerdict(checks: EligibilityCheck[]): EligibilityVerdict['overall'] {
    if (checks.some((c) => c.status === 'fail')) return 'not_eligible';
    const mandatory = checks.filter((c) => c.rule === 'academic score' || c.rule.startsWith('English score'));
    if (mandatory.some((c) => c.status === 'unknown')) return 'insufficient_data';
    if (checks.some((c) => c.status === 'info' || c.status === 'unknown')) return 'conditionally_eligible';
    return 'eligible';
  }
}
