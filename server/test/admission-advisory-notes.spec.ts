// ---------------------------------------------------------------------------
// Policy guidance that cannot be checked must never move the verdict.
//
// `gs_notes`, `excluded_regions` and `country_tier_notes` are real and a
// counsellor needs them, but they are not assessable: `excluded_regions` names
// Indian state boards while the student record has no home-region field at all
// (`student.state` is a pipeline stage, defaulting to "Enquiry").
//
// The obvious way to surface them — as `info` checks — would have been wrong:
// `overallVerdict()` maps any `info` to `conditionally_eligible`, so every course
// at SCU, Excelsia and CQU would have been downgraded purely because advisory
// text exists. They are carried as `advisory_notes` instead, and this pins that.
// ---------------------------------------------------------------------------

import { AdmissionEligibilityService } from '../src/modules/admission/admission-eligibility.service';
import type { AdmissionPolicy } from '../src/modules/admission/admission-policy.types';

const basePolicy = (over: Partial<AdmissionPolicy> = {}): AdmissionPolicy => ({
  key: 'test',
  institution: 'Test Institute',
  scope: 'General',
  source: 'test.docx',
  academics: [
    {
      level: 'PG',
      label: 'Postgraduate (general)',
      min_canonical_score: 50,
      source_expression: '50%',
      min_ielts_overall: 6.0,
      min_ielts_band: null,
      min_pte_overall: null,
      min_pte_band: null,
    },
  ],
  sponsors: [],
  income_thresholds: [],
  other_notes: [],
  ...over,
});

function makeService(policy: AdmissionPolicy) {
  const policies = { findOne: jest.fn().mockResolvedValue({ key: policy.key, data: policy }) };
  const reference = { toAud: (n: number) => n };
  return new AdmissionEligibilityService(reference as any, policies as any);
}

const student: any = {
  id: 's1',
  date_of_birth: '2000-01-01',
  marital_status: 'single',
  state: 'Enquiry', // pipeline stage, NOT a region — the reason regions can't be checked
  sponsors: [],
  visa_history: [],
  academic: [],
  preferences: { degree_level: 'Master' },
};

// Clears the academic and English bars so the verdict can reach `eligible`.
const profile: any = { canonical_gpa: 90, english_band: 8, english_source: 'IELTS' };

describe('advisory notes never change the verdict', () => {
  it('stays eligible when GS notes are present', async () => {
    const svc = makeService(
      basePolicy({ gs_notes: ['Interview may be required.', 'Funds must be explained.'] }),
    );
    const v = await svc.evaluate('test', student, profile, { level: 'PG' });
    expect(v.overall).toBe('eligible');
    expect(v.advisory_notes.map((n) => n.label)).toEqual([
      'Genuine Student (GS)',
      'Genuine Student (GS)',
    ]);
  });

  it('carries region restrictions without treating them as a check', async () => {
    const svc = makeService(
      basePolicy({ excluded_regions: ['India: degrees from Haryana are not accepted.'] }),
    );
    const v = await svc.evaluate('test', student, profile, { level: 'PG' });
    expect(v.overall).toBe('eligible');
    expect(v.checks.some((c) => /region|board/i.test(c.rule))).toBe(false);
    expect(v.advisory_notes[0].label).toBe('Region / board restriction');
  });

  it('labels country-tier rules and still does not gate on them', async () => {
    const svc = makeService(basePolicy({ country_tier_notes: ['Assessment Level 3 applies.'] }));
    const v = await svc.evaluate('test', student, profile, { level: 'PG' });
    expect(v.overall).toBe('eligible');
    expect(v.advisory_notes[0]).toEqual({
      label: 'Country tier',
      text: 'Assessment Level 3 applies.',
      // Names no country, so it is nobody-specific and always shown.
      scope_country: null,
      applies_to_applicant: true,
    });
  });

  it('is empty, not absent, when the policy has no such guidance', async () => {
    const svc = makeService(basePolicy());
    const v = await svc.evaluate('test', student, profile, { level: 'PG' });
    expect(v.advisory_notes).toEqual([]);
    expect(v.overall).toBe('eligible');
  });

  it('still fails a student who misses a real bar, regardless of guidance', async () => {
    const svc = makeService(basePolicy({ gs_notes: ['Interview may be required.'] }));
    const v = await svc.evaluate('test', student, { ...profile, canonical_gpa: 10 }, { level: 'PG' });
    expect(v.overall).toBe('not_eligible');
    expect(v.advisory_notes).toHaveLength(1);
  });

  it('reports the band it assessed against', async () => {
    const svc = makeService(basePolicy());
    const v = await svc.evaluate('test', student, profile, { level: 'PG' });
    expect(v.matched_band?.label).toBe('Postgraduate (general)');
  });
});
