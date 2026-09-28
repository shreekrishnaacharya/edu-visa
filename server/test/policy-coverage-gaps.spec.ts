// ---------------------------------------------------------------------------
// The coverage report has to mirror what the matcher will actually do, so it
// runs the REAL AdmissionEligibilityService band resolution rather than a
// second copy of the rules. A parallel implementation would drift and the
// worklist would then point at the wrong briefings.
//
// The distinction these tests defend is between an absence the source can fix
// and one it cannot:
//   - no band at this level        -> the briefing never covered it
//   - several bands, none governs  -> `pickBand` refuses to guess (by design)
//   - a band with no number in it  -> re-reading the same page will not help
// Collapsing them into one "unknown" count is what hid 1,024 courses.
// ---------------------------------------------------------------------------

import { ConsistencyService } from '../src/modules/data-sync/consistency.service';
import { AdmissionEligibilityService } from '../src/modules/admission/admission-eligibility.service';
import type { AcademicBand, AdmissionPolicy } from '../src/modules/admission/admission-policy.types';

const band = (over: Partial<AcademicBand>): AcademicBand => ({
  level: 'PG',
  label: 'Postgraduate (general)',
  min_canonical_score: 50,
  source_expression: '50%',
  min_ielts_overall: 6.0,
  min_ielts_band: null,
  min_pte_overall: null,
  min_pte_band: null,
  ...over,
});

const policy = (academics: AcademicBand[]): AdmissionPolicy => ({
  key: 'p1',
  institution: 'Test Institute',
  scope: 'General',
  source: 'test.docx',
  academics,
  sponsors: [],
  income_thresholds: [],
  other_notes: [],
});

type CourseRow = {
  id: string;
  title: string;
  field?: string;
  degree_level: string;
  university_id?: string;
};

function build(
  academics: AcademicBand[],
  rows: CourseRow[],
  unis: { id: string; name: string }[] = [{ id: 'u1', name: 'Test Institute' }],
) {
  const policies = {
    findOne: jest.fn().mockResolvedValue({ key: 'p1', data: policy(academics) }),
  };
  const admission = new AdmissionEligibilityService({ toAud: (n: number) => n } as any, policies as any);

  const courses = {
    createQueryBuilder: () => {
      const qb: any = {
        where: () => qb,
        andWhere: () => qb,
        getMany: async () =>
          rows.map((r) => ({ ...r, university_id: r.university_id ?? 'u1', entry: {} })),
      };
      return qb;
    },
  };
  const universities = {
    find: jest.fn().mockResolvedValue(unis.map((u) => ({ ...u, policy_key: 'p1' }))),
  };

  return new ConsistencyService(courses as any, universities as any, admission);
}

describe('policyCoverageGaps', () => {
  it('reports a level the briefing never covered, and says no bands exist there', async () => {
    const svc = build([band({})], [{ id: 'c1', title: 'Doctor of Philosophy', degree_level: 'PhD' }]);
    const r = await svc.policyCoverageGaps();

    expect(r.courses_checked).toBe(1);
    expect(r.courses_assessable).toBe(0);
    expect(r.courses_blocked).toBe(1);
    expect(r.gaps).toHaveLength(1);
    expect(r.gaps[0]).toMatchObject({
      kind: 'no_band_at_level',
      program_level: 'PG_RESEARCH',
      bands_defined: 0,
      courses: 1,
      degree_levels: ['PhD'],
    });
  });

  it('counts a fully specified band as assessable and raises no gap', async () => {
    const svc = build([band({})], [{ id: 'c1', title: 'Master of Business', degree_level: 'Master' }]);
    const r = await svc.policyCoverageGaps();

    expect(r.courses_assessable).toBe(1);
    expect(r.courses_blocked).toBe(0);
    expect(r.gaps).toHaveLength(0);
  });

  it('separates a band with no academic figure from one with no English figure', async () => {
    const noAcademic = build(
      [band({ min_canonical_score: null, source_expression: 'n/a (English only)' })],
      [{ id: 'c1', title: 'Master of Business', degree_level: 'Master' }],
    );
    const a = await noAcademic.policyCoverageGaps();
    expect(a.by_kind.band_without_academic_figure).toBe(1);
    expect(a.courses_blocked).toBe(1);
    expect(a.courses_assessable).toBe(0);

    // An English figure is not what the academic check needs, so a band that
    // states the GPA but no test score still assesses — it must not be counted
    // as blocked, or the worklist overstates the problem.
    const noEnglish = build(
      [band({ min_ielts_overall: null, min_pte_overall: null })],
      [{ id: 'c1', title: 'Master of Business', degree_level: 'Master' }],
    );
    const e = await noEnglish.policyCoverageGaps();
    expect(e.by_kind.band_without_english_figure).toBe(1);
    expect(e.courses_blocked).toBe(0);
    expect(e.courses_assessable).toBe(1);
  });

  it('reports ambiguity as its own kind, with the band count that caused it', async () => {
    // Two named, non-general bands and a course matching neither: pickBand
    // deliberately returns null rather than guessing. That is not the same
    // problem as a missing briefing and must not be reported as one.
    const svc = build(
      [
        band({ label: 'Medical programs', min_canonical_score: 65 }),
        band({ label: 'Engineering programs', min_canonical_score: 70 }),
      ],
      [{ id: 'c1', title: 'Master of Fine Arts', field: 'Creative Arts', degree_level: 'Master' }],
    );
    const r = await svc.policyCoverageGaps();

    expect(r.gaps).toHaveLength(1);
    expect(r.gaps[0]).toMatchObject({ kind: 'ambiguous_bands', bands_defined: 2 });
    expect(r.courses_blocked).toBe(1);
  });

  it('ranks the worklist by how many courses each gap blocks', async () => {
    const svc = build(
      [band({})],
      [
        { id: 'c1', title: 'PhD A', degree_level: 'PhD' },
        { id: 'c2', title: 'PhD B', degree_level: 'PhD' },
        { id: 'c3', title: 'PhD C', degree_level: 'PhD' },
        { id: 'c4', title: 'Bachelor of Arts', degree_level: 'Bachelor' },
      ],
    );
    const r = await svc.policyCoverageGaps();

    expect(r.gaps.map((g) => [g.program_level, g.courses])).toEqual([
      ['PG_RESEARCH', 3],
      ['UG', 1],
    ]);
    // Examples are capped so the payload stays a summary, not a course dump.
    expect(r.gaps[0].example_courses).toEqual(['PhD A', 'PhD B', 'PhD C']);
  });

  it('names every institution a shared briefing governs, not just the first', async () => {
    // One briefing covering several providers is real — the Navitas pathway
    // document covers Curtin, Griffith and Eynesbury colleges. Labelling the gap
    // with whichever university the loop reached first misreports who it hits.
    const svc = build(
      [band({})],
      [
        { id: 'c1', title: 'PhD A', degree_level: 'PhD', university_id: 'u1' },
        { id: 'c2', title: 'PhD B', degree_level: 'PhD', university_id: 'u2' },
      ],
      [
        { id: 'u1', name: 'First College' },
        { id: 'u2', name: 'Second College' },
      ],
    );
    const r = await svc.policyCoverageGaps();

    expect(r.gaps).toHaveLength(1);
    // The briefing's own name for itself, as the admission pages show it.
    expect(r.gaps[0].institution).toBe('Test Institute');
    expect(r.gaps[0].universities).toEqual(['First College', 'Second College']);
    expect(r.gaps[0].courses).toBe(2);
  });

  it('holds the same course in two gap kinds without double-counting it as blocked', async () => {
    const svc = build(
      [band({ min_canonical_score: null, min_ielts_overall: null, min_pte_overall: null })],
      [{ id: 'c1', title: 'Master of Business', degree_level: 'Master' }],
    );
    const r = await svc.policyCoverageGaps();

    expect(r.by_kind.band_without_academic_figure).toBe(1);
    expect(r.by_kind.band_without_english_figure).toBe(1);
    expect(r.gaps).toHaveLength(2);
    expect(r.courses_checked).toBe(1);
    expect(r.courses_blocked).toBe(1);
  });
});
