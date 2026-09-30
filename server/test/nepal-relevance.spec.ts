// ---------------------------------------------------------------------------
// This consultancy's applicants are Nepali — all 350 on file — and the report
// has to read that way.
//
// Two defects found in a real University of Newcastle match report:
//
// 1. It printed "Region / board restriction: India: only Andhra Pradesh,
//    Telangana, ... state boards are currently accepted." Both `excluded_regions`
//    entries in the entire system are India-only, so that note appeared on every
//    report for applicants it could never apply to.
//
// 2. The verdict read "Insufficient data" although the student was at 88/100
//    against a 55% bar and IELTS 7.0 against 6.5. The one unknown was the
//    per-skill breakdown, absent from 182 of 192 IELTS records. "Insufficient
//    data" says we know nothing; in fact we knew the bar was cleared and needed
//    one document.
//
// Both are about the same thing: the report must distinguish what applies to
// THIS applicant from what merely exists in the source.
// ---------------------------------------------------------------------------

import { AdmissionEligibilityService } from '../src/modules/admission/admission-eligibility.service';
import type { AdmissionPolicy } from '../src/modules/admission/admission-policy.types';

const policy = (over: Partial<AdmissionPolicy> = {}): AdmissionPolicy => ({
  key: 'test',
  institution: 'Test Institute',
  scope: 'General',
  source: 'test.docx',
  academics: [
    {
      level: 'PG',
      label: 'Postgraduate (general)',
      min_canonical_score: 55,
      source_expression: '55%',
      min_ielts_overall: 6.5,
      min_ielts_band: 6.0,
      min_pte_overall: null,
      min_pte_band: null,
    },
  ],
  sponsors: [],
  income_thresholds: [],
  other_notes: [],
  ...over,
});

function makeService(p: AdmissionPolicy) {
  const policies = { findOne: jest.fn().mockResolvedValue({ key: p.key, data: p }) };
  return new AdmissionEligibilityService({ toAud: (n: number) => n } as any, policies as any);
}

const student = (over: any = {}): any => ({
  id: 's1',
  date_of_birth: '1997-01-01',
  nationality: 'Nepal',
  marital_status: 'single',
  state: 'Enquiry',
  sponsors: [],
  visa_history: [],
  academic: [],
  preferences: { degree_level: 'Master' },
  // IELTS 7.0 overall, no per-skill breakdown — the shape 95% of records have.
  language_tests: [{ test: 'IELTS', overall: 7.0, listening: null, reading: null, writing: null, speaking: null }],
  ...over,
});

const profile: any = { canonical_gpa: 88, english_band: 7.0, english_source: 'IELTS 7 → IELTS 7' };

describe('notes scoped to another country', () => {
  const indiaNote = 'India: only Andhra Pradesh, Telangana and Kerala state boards are accepted.';

  it('marks an India-scoped restriction as not applying to a Nepali applicant', async () => {
    const svc = makeService(policy({ excluded_regions: [indiaNote] }));
    const v = await svc.evaluate('test', student(), profile, { level: 'PG' });
    const note = v.advisory_notes[0];

    expect(note.scope_country).toBe('India');
    expect(note.applies_to_applicant).toBe(false);
    // Still carried, so nothing is silently lost from the source.
    expect(note.text).toBe(indiaNote);
  });

  it('applies the same note to an applicant it really is about', async () => {
    const svc = makeService(policy({ excluded_regions: [indiaNote] }));
    const v = await svc.evaluate('test', student({ nationality: 'India' }), profile, { level: 'PG' });
    expect(v.advisory_notes[0].applies_to_applicant).toBe(true);
  });

  it('shows everything when no nationality is on file rather than hiding notes', async () => {
    const svc = makeService(policy({ excluded_regions: [indiaNote] }));
    const v = await svc.evaluate('test', student({ nationality: '' }), profile, { level: 'PG' });
    expect(v.advisory_notes[0].applies_to_applicant).toBe(true);
  });

  it('never mistakes ordinary prose with a colon for a country scope', async () => {
    // A real SCU note. "Study gaps" must not be read as a country and hidden.
    const prose = 'Study gaps: any gap of 6 months or more must be explained with evidence.';
    const svc = makeService(policy({ gs_notes: [prose] }));
    const v = await svc.evaluate('test', student(), profile, { level: 'PG' });

    expect(v.advisory_notes[0].scope_country).toBeNull();
    expect(v.advisory_notes[0].applies_to_applicant).toBe(true);
  });

  it('keeps GS guidance applicable — it is about the applicant, not a region', async () => {
    const svc = makeService(policy({ gs_notes: ['300-word SOP required at GTE stage.'], excluded_regions: [indiaNote] }));
    const v = await svc.evaluate('test', student(), profile, { level: 'PG' });

    const gs = v.advisory_notes.find((n) => n.label === 'Genuine Student (GS)')!;
    const region = v.advisory_notes.find((n) => n.label === 'Region / board restriction')!;
    expect(gs.applies_to_applicant).toBe(true);
    expect(region.applies_to_applicant).toBe(false);
  });
});

describe('a met threshold with one document outstanding', () => {
  it('is conditionally eligible, not insufficient data', async () => {
    const svc = makeService(policy());
    const v = await svc.evaluate('test', student(), profile, { level: 'PG' });

    // This is the Newcastle report: 88 vs 55, IELTS 7.0 vs 6.5, per-skill absent.
    expect(v.overall).toBe('conditionally_eligible');
    const eng = v.checks.find((c) => c.rule.startsWith('English score'))!;
    expect(eng.status).toBe('unknown');
    expect(eng.missing_evidence).toMatch(/per-skill IELTS scores/);
  });

  it('is still insufficient data when there is no test at all', async () => {
    const svc = makeService(policy());
    const v = await svc.evaluate('test', student({ language_tests: [] }), { ...profile, english_band: null }, { level: 'PG' });

    expect(v.overall).toBe('insufficient_data');
    const eng = v.checks.find((c) => c.rule.startsWith('English score'))!;
    expect(eng.missing_evidence).toBeUndefined();
  });

  it('does not soften a genuine failure into a document request', async () => {
    const svc = makeService(policy());
    // Per-skill scores ARE on file and one is below the 6.0 floor.
    const v = await svc.evaluate('test', student({
      language_tests: [{ test: 'IELTS', overall: 7.0, listening: 7, reading: 7, writing: 5.5, speaking: 7 }],
    }), profile, { level: 'PG' });

    expect(v.overall).toBe('not_eligible');
    const eng = v.checks.find((c) => c.rule.startsWith('English score'))!;
    expect(eng.status).toBe('fail');
    expect(eng.missing_evidence).toBeUndefined();
  });

  it('does not soften a missing overall score either', async () => {
    // Overall below the bar with no per-skill detail is a fail, not a pending doc.
    const svc = makeService(policy());
    const v = await svc.evaluate('test', student({
      language_tests: [{ test: 'IELTS', overall: 6.0, listening: null, reading: null, writing: null, speaking: null }],
    }), profile, { level: 'PG' });

    expect(v.overall).toBe('not_eligible');
    expect(v.checks.find((c) => c.rule.startsWith('English score'))!.missing_evidence).toBeUndefined();
  });
});
