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

/**
 * 1. `keep_both`         — report only, change nothing.
 * 2. `course_to_policy`  — the course figure replaces the policy band's.
 * 3. `policy_to_course`  — the policy band's figure replaces the course's.
 */
export type ReconcileDirection = 'keep_both' | 'course_to_policy' | 'policy_to_course';

export interface ReconcileResult {
  direction: ReconcileDirection;
  dry_run: boolean;
  updated: number;
  skipped: { course_id: string; reason: string }[];
  changes: EntryDisagreement[];
}

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

  /**
   * How many courses that band actually governs, resolved through the matcher's
   * own band selection so the count reflects reality rather than a guess.
   */
  private async coursesGovernedByBand(policyKey: string, bandLabel: string): Promise<number> {
    const unis = await this.universities.find({ where: { policy_key: policyKey }, select: ['id'] });
    if (!unis.length) return 0;
    const courses = await this.courses
      .createQueryBuilder('c')
      .where('c.university_id IN (:...ids)', { ids: unis.map((u) => u.id) })
      .getMany();
    let n = 0;
    for (const c of courses) {
      const { band } = await this.admission.bandForCourse(policyKey, c.degree_level, c.title, c.field);
      if (band?.label === bandLabel) n++;
    }
    return n;
  }

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
   * What to do about a disagreement. There is no single correct direction: a
   * course-specific figure scraped from the provider may be the accurate one and
   * belong in the policy, or the institution briefing may be right and the course
   * row stale. The caller chooses; `keep_both` only reports.
   */
  async reconcile(opts: {
    direction: ReconcileDirection;
    /** Limit to these courses; omitted means every disagreement. */
    course_ids?: string[];
    apply?: boolean;
    /**
     * Allow `course_to_policy` even when the band governs courses beyond the ones
     * being promoted. Off by default: an institution-wide band is shared, so one
     * course's figure would silently become the requirement for all of them.
     */
    force?: boolean;
  }): Promise<ReconcileResult> {
    const apply = opts.apply === true;
    const { disagreements } = await this.checkEntryConsistency();
    const scoped = opts.course_ids?.length
      ? disagreements.filter((d) => opts.course_ids!.includes(d.course_id))
      : disagreements;

    if (opts.direction === 'keep_both') {
      return {
        direction: 'keep_both',
        dry_run: true,
        updated: 0,
        skipped: scoped.map((d) => ({ course_id: d.course_id, reason: 'left as-is by choice' })),
        changes: [],
      };
    }

    if (opts.direction === 'policy_to_course') {
      const usable = scoped.filter((d) => d.policy_band != null);
      const skipped = scoped
        .filter((d) => d.policy_band == null)
        .map((d) => ({ course_id: d.course_id, reason: 'the policy has no figure for this band' }));
      if (apply) {
        for (const d of usable) {
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
        this.log.log(`Wrote ${usable.length} policy band(s) onto courses`);
      }
      return {
        direction: 'policy_to_course',
        dry_run: !apply,
        updated: usable.length,
        skipped,
        changes: usable.slice(0, 200),
      };
    }

    // course_to_policy: push the course figure up into the institution band.
    const usable = scoped.filter((d) => d.course_band != null);
    const skipped = scoped
      .filter((d) => d.course_band == null)
      .map((d) => ({ course_id: d.course_id, reason: 'the course has no figure to promote' }));

    // Several courses share one band, so they must agree before it can be set —
    // otherwise whichever was written last would silently win.
    const byBand = new Map<string, EntryDisagreement[]>();
    for (const d of usable) {
      const k = `${d.policy_key}|${d.band_label}`;
      byBand.set(k, [...(byBand.get(k) ?? []), d]);
    }

    const applied: EntryDisagreement[] = [];
    for (const [k, group] of byBand) {
      const values = [...new Set(group.map((g) => Number(g.course_band)))];
      if (values.length > 1) {
        for (const g of group) {
          skipped.push({
            course_id: g.course_id,
            reason:
              `courses sharing the band "${g.band_label}" disagree with each other ` +
              `(${values.join(', ')}) — resolve them individually first`,
          });
        }
        continue;
      }
      const [policyKey, bandLabel] = k.split('|');

      // A band is institution-wide. Promoting one course's figure into
      // "Undergraduate (general)" rewrites the requirement for every UG course at
      // that provider — 33 of them at CQU. Refuse unless the caller has said it
      // means to change the band for all of them.
      const governed = await this.coursesGovernedByBand(policyKey, bandLabel);
      if (!opts.force && governed > group.length) {
        for (const g of group) {
          skipped.push({
            course_id: g.course_id,
            reason:
              `"${bandLabel}" governs ${governed} course(s) at this institution, not just the ` +
              `${group.length} being promoted — changing the band would change all of them. ` +
              `Re-send with force to do that deliberately, or fix the course row instead.`,
          });
        }
        continue;
      }

      if (apply) {
        const policy = await this.admission.getPolicy(policyKey);
        const academics = (policy.academics ?? []).map((b) =>
          b.label === bandLabel ? { ...b, min_ielts_overall: values[0] } : b,
        );
        await this.admission.upsertPolicy(
          policyKey,
          policy.institution,
          { ...policy, academics },
          // A person chose this direction, so the policy is human-decided now.
          { reviewStatus: 'reviewed' },
        );
      }
      applied.push(...group);
    }
    if (apply) this.log.log(`Promoted ${byBand.size} course figure(s) into policy bands`);

    return {
      direction: 'course_to_policy',
      dry_run: !apply,
      updated: applied.length,
      skipped,
      changes: applied.slice(0, 200),
    };
  }
}
