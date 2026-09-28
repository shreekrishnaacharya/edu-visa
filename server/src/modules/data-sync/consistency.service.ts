import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Course } from '../course/course.entity';
import { University } from '../university/university.entity';
import { AdmissionEligibilityService } from '../admission/admission-eligibility.service';
import { AdmissionPolicy, ProgramLevel } from '../admission/admission-policy.types';

/**
 * How strongly a course's stored English band is evidenced. The same fact lives
 * in two places — `course.entry.min_english_band` (per course, what the matcher
 * SCORES on) and `admission_policy.data.academics[].min_ielts_overall` (per
 * institution band, what the eligibility VERDICT checks) — so when they disagree
 * something has to decide which wins.
 *
 * Higher wins. A provider's own page about a specific course beats an
 * institution-wide briefing band, which beats a blanket aggregator guess.
 */
const SOURCE_RANK = {
  human_verified: 4,
  provider_page: 3,
  admission_policy: 2,
  aggregator: 1,
  none: 0,
} as const;

export type EntrySourceKind = keyof typeof SOURCE_RANK;

export interface EntryDisagreement {
  course_id: string;
  course: string;
  institution: string;
  policy_key: string;
  band_label: string;
  course_band: number | null;
  course_source: string | null;
  course_source_kind: EntrySourceKind;
  policy_band: number | null;
  /** What the value should become if reconciled. */
  resolution: 'policy wins' | 'course wins' | 'equal' | 'no policy figure';
}

/**
 * Why a course cannot be assessed against the policy that governs it. These are
 * absences, not disagreements — `checkEntryConsistency` only sees courses where
 * both sides hold a figure, so the far larger population of courses where the
 * policy says nothing at all never showed up anywhere in the product.
 *
 * The four kinds need different work, which is the point of separating them:
 *  - `no_band_at_level`   the briefing covers other levels but not this one
 *                         (every one of the 9 briefings is silent on PhD).
 *  - `ambiguous_bands`    bands exist at this level but several could apply and
 *                         none names the course, so the matcher deliberately
 *                         refuses to guess (see `pickBand`).
 *  - `band_without_academic_figure` / `band_without_english_figure`
 *                         a band governs the course but the source document
 *                         never stated that number — re-reading the same page
 *                         will not help; a different source is needed.
 */
export type CoverageGapKind =
  | 'no_band_at_level'
  | 'ambiguous_bands'
  | 'band_without_academic_figure'
  | 'band_without_english_figure';

export interface CoverageGap {
  policy_key: string;
  /** The briefing's own name for itself, as the admission pages show it. */
  institution: string;
  /**
   * The catalogue institutions actually affected. One briefing can govern
   * several — `curtin-griffith-eynesbury` covers Curtin College, Griffith
   * College and Eynesbury — so naming the gap after whichever university the
   * loop reached first would misreport who it applies to.
   */
  universities: string[];
  program_level: ProgramLevel;
  /** The catalogue degree levels that map onto this program level. */
  degree_levels: string[];
  kind: CoverageGapKind;
  courses: number;
  /** How many bands the policy defines at this level — 0 explains `no_band_at_level`. */
  bands_defined: number;
  example_courses: string[];
}

export interface CoverageReport {
  courses_checked: number;
  /** A band governs the course AND carries a numeric academic threshold. */
  courses_assessable: number;
  courses_blocked: number;
  by_kind: Record<CoverageGapKind, number>;
  gaps: CoverageGap[];
}

@Injectable()
export class ConsistencyService {
  private readonly log = new Logger(ConsistencyService.name);

  constructor(
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(University) private readonly universities: Repository<University>,
    private readonly admission: AdmissionEligibilityService,
  ) {}

  /** Classifies where a course's stored band came from. */
  classifySource(requirementSource: string | null | undefined): EntrySourceKind {
    const src = (requirementSource ?? '').trim();
    if (!src) return 'none';
    if (src === 'unverified_aggregator') return 'aggregator';
    if (src.startsWith('admission_policy:')) return 'admission_policy';
    if (/^https?:\/\//.test(src)) return 'provider_page';
    // Anything else was typed or confirmed by a person (counsellor CSV, curation).
    return 'human_verified';
  }

  /**
   * Loads each distinct policy once for a whole-catalogue pass. `getPolicy`
   * reads its row on every call, so resolving a band per course would issue one
   * query per course for the same nine policies — and these two reports run on
   * the same page load.
   */
  private async loadPolicies(keys: string[]): Promise<Map<string, AdmissionPolicy>> {
    const out = new Map<string, AdmissionPolicy>();
    for (const key of new Set(keys)) {
      try {
        out.set(key, await this.admission.getPolicy(key));
      } catch {
        // A university may name a policy key that has no row yet; it simply has
        // nothing to compare against rather than failing the whole report.
      }
    }
    return out;
  }

  /**
   * Compares every course at a policy-linked institution against the policy band
   * that governs it, resolved through the matcher's own rules.
   */
  async checkEntryConsistency(): Promise<{
    checked: number;
    disagreements: EntryDisagreement[];
    summary: Record<string, number>;
  }> {
    const linked = await this.universities.find({
      where: { policy_key: Not(IsNull()) },
      select: ['id', 'name', 'policy_key'],
    });
    const byId = new Map(linked.map((u) => [u.id, u]));
    if (!linked.length) return { checked: 0, disagreements: [], summary: {} };

    const courses = await this.courses
      .createQueryBuilder('c')
      .where('c.country = :c', { c: 'AU' })
      .andWhere('c.university_id IN (:...ids)', { ids: linked.map((u) => u.id) })
      .getMany();

    const policies = await this.loadPolicies(linked.map((u) => u.policy_key!));
    const out: EntryDisagreement[] = [];
    const summary: Record<string, number> = {};
    const bump = (k: string) => (summary[k] = (summary[k] ?? 0) + 1);

    for (const c of courses) {
      const uni = byId.get(c.university_id);
      if (!uni?.policy_key) continue;
      const policy = policies.get(uni.policy_key);
      if (!policy) continue;
      const { band } = this.admission.bandForCourseIn(policy, c.degree_level, c.title, c.field);
      const policyBand = band?.min_ielts_overall ?? null;
      const courseBand = c.entry?.min_english_band ?? null;
      const kind = this.classifySource(c.entry?.requirement_source);

      if (policyBand == null) {
        bump(courseBand == null ? 'neither has a figure' : 'course only');
        continue;
      }
      if (courseBand == null) {
        bump('policy only — course unset');
        out.push({
          course_id: c.id,
          course: c.title,
          institution: uni.name,
          policy_key: uni.policy_key,
          band_label: band!.label,
          course_band: null,
          course_source: c.entry?.requirement_source ?? null,
          course_source_kind: kind,
          policy_band: policyBand,
          resolution: 'policy wins',
        });
        continue;
      }
      if (Number(courseBand) === Number(policyBand)) {
        bump('agree');
        continue;
      }
      bump('DISAGREE');
      out.push({
        course_id: c.id,
        course: c.title,
        institution: uni.name,
        policy_key: uni.policy_key,
        band_label: band!.label,
        course_band: Number(courseBand),
        course_source: c.entry?.requirement_source ?? null,
        course_source_kind: kind,
        policy_band: Number(policyBand),
        resolution:
          SOURCE_RANK[kind] > SOURCE_RANK.admission_policy ? 'course wins' : 'policy wins',
      });
    }

    return { checked: courses.length, disagreements: out, summary };
  }

  /**
   * Writes the policy band onto the courses it governs, but only where the
   * course's own value is weaker evidence (unset, or a blanket aggregator
   * figure). A course-specific provider page or a human-entered value is left
   * alone — an institution-wide band should not overwrite something more
   * specific.
   *
   * Records `admission_policy:<key>` as the provenance so the next run can tell
   * where the number came from and re-derive it.
   */
  async reconcileEntryFromPolicies(dryRun = true): Promise<{
    dry_run: boolean;
    updated: number;
    skipped_stronger_source: number;
    changes: EntryDisagreement[];
  }> {
    const { disagreements } = await this.checkEntryConsistency();
    const toApply = disagreements.filter((d) => d.resolution === 'policy wins');
    const skipped = disagreements.filter((d) => d.resolution === 'course wins').length;

    if (!dryRun) {
      for (const d of toApply) {
        await this.courses.query(
          `UPDATE "course"
              SET "entry" = "entry" || jsonb_build_object(
                    'min_english_band', $1::numeric,
                    'requirement_source', $2::text
                  )
            WHERE "id" = $3`,
          [d.policy_band, `admission_policy:${d.policy_key}`, d.course_id],
        );
      }
      this.log.log(`Reconciled ${toApply.length} course band(s) from admission policies`);
    }

    return {
      dry_run: dryRun,
      updated: toApply.length,
      skipped_stronger_source: skipped,
      changes: toApply.slice(0, 200),
    };
  }

  /**
   * What the catalogue *cannot* answer and why, as a worklist ordered by how
   * many courses each gap blocks.
   *
   * Distinct from `checkEntryConsistency`, which finds courses where the policy
   * and the course row hold DIFFERENT figures. That check is blind to the much
   * bigger problem: a course whose governing policy has no figure at all still
   * produces a verdict of `conditionally_eligible` with an `unknown` check, and
   * nothing anywhere counted how often that happens or which briefing to go
   * fix. Resolving the band through `bandForCourse` means this reports exactly
   * what the matcher will actually do, not a parallel guess at it.
   */
  async policyCoverageGaps(): Promise<CoverageReport> {
    const linked = await this.universities.find({
      where: { policy_key: Not(IsNull()) },
      select: ['id', 'name', 'policy_key'],
    });
    const byId = new Map(linked.map((u) => [u.id, u]));
    const empty: CoverageReport = {
      courses_checked: 0,
      courses_assessable: 0,
      courses_blocked: 0,
      by_kind: {
        no_band_at_level: 0,
        ambiguous_bands: 0,
        band_without_academic_figure: 0,
        band_without_english_figure: 0,
      },
      gaps: [],
    };
    if (!linked.length) return empty;

    const courses = await this.courses
      .createQueryBuilder('c')
      .where('c.country = :c', { c: 'AU' })
      .andWhere('c.university_id IN (:...ids)', { ids: linked.map((u) => u.id) })
      .getMany();

    const policies = await this.loadPolicies(linked.map((u) => u.policy_key!));
    const report: CoverageReport = { ...empty, by_kind: { ...empty.by_kind } };
    const buckets = new Map<string, CoverageGap>();

    const record = (
      uni: { name: string; policy_key: string; institution: string },
      level: ProgramLevel,
      degreeLevel: string,
      kind: CoverageGapKind,
      bands: number,
      title: string,
    ) => {
      const key = `${uni.policy_key}|${level}|${kind}`;
      let g = buckets.get(key);
      if (!g) {
        g = {
          policy_key: uni.policy_key,
          institution: uni.institution,
          universities: [],
          program_level: level,
          degree_levels: [],
          kind,
          courses: 0,
          bands_defined: bands,
          example_courses: [],
        };
        buckets.set(key, g);
      }
      g.courses += 1;
      if (!g.universities.includes(uni.name)) g.universities.push(uni.name);
      if (!g.degree_levels.includes(degreeLevel)) g.degree_levels.push(degreeLevel);
      if (g.example_courses.length < 3) g.example_courses.push(title);
      report.by_kind[kind] += 1;
    };

    for (const c of courses) {
      const uni = byId.get(c.university_id);
      if (!uni?.policy_key) continue;
      const policy = policies.get(uni.policy_key);
      if (!policy) continue;
      report.courses_checked += 1;

      const { band, level } = this.admission.bandForCourseIn(
        policy,
        c.degree_level,
        c.title,
        c.field,
      );
      const defined = this.admission.bandsAtLevel(policy, level).length;
      const u = { name: uni.name, policy_key: uni.policy_key, institution: policy.institution };

      if (!band) {
        // No band resolved: either the policy is silent at this level, or it
        // defines several and `pickBand` refused to guess between them.
        record(
          u,
          level,
          c.degree_level,
          defined === 0 ? 'no_band_at_level' : 'ambiguous_bands',
          defined,
          c.title,
        );
        report.courses_blocked += 1;
        continue;
      }

      // A band governs the course but the source never stated the numbers. Both
      // can be missing on the same band, so these are recorded independently.
      let blocked = false;
      if (band.min_canonical_score == null) {
        record(u, level, c.degree_level, 'band_without_academic_figure', defined, c.title);
        blocked = true;
      }
      if (band.min_ielts_overall == null && band.min_pte_overall == null) {
        record(u, level, c.degree_level, 'band_without_english_figure', defined, c.title);
      }
      if (blocked) report.courses_blocked += 1;
      else report.courses_assessable += 1;
    }

    report.gaps = [...buckets.values()].sort((a, b) => b.courses - a.courses);
    return report;
  }
}
