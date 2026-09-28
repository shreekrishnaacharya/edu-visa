import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Course } from '../course/course.entity';
import { University } from '../university/university.entity';
import { AdmissionEligibilityService } from '../admission/admission-eligibility.service';

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

    const out: EntryDisagreement[] = [];
    const summary: Record<string, number> = {};
    const bump = (k: string) => (summary[k] = (summary[k] ?? 0) + 1);

    for (const c of courses) {
      const uni = byId.get(c.university_id);
      if (!uni?.policy_key) continue;
      const { band } = await this.admission.bandForCourse(
        uni.policy_key,
        c.degree_level,
        c.title,
        c.field,
      );
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
}
