import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { University } from '../university/university.entity';
import { Course } from '../course/course.entity';
import { SyncChange, ChangeType, FieldDiff } from './entities/sync-change.entity';
import { SyncRun, SyncTotals } from './entities/sync-run.entity';
import { RegisterSnapshot } from './cricos-registry.service';
import {
  campusNamesByCourse,
  locationsByCode,
  mapCampuses,
  MappedCampus,
  mapCourse,
  mapUniversity,
  MappedCourse,
  MappedUniversity,
} from './cricos-mapper';
import { EMPTY_ENTRY_REQUIREMENT } from '../course/entry-requirement';
import { AdmissionPolicyEntity } from '../admission/admission-policy.entity';
import { UniversityCampus } from '../university/university-campus.entity';
import { CourseCampus } from '../course/course-campus.entity';

/**
 * Fields the register is authoritative for. A change to one of these auto-applies
 * under the tiered policy: data.gov.au is the legal source of truth for what a
 * provider is called, where it is, and what a course costs, so making a human
 * confirm a published fee change adds no safety — only a queue of clicks.
 *
 * Nothing under `entry.*` is ever in this list. The register publishes no entry
 * requirement, so any value there came from scraping or AI and must be reviewed.
 */
const AUTO_APPLY_UNIVERSITY_FIELDS = new Set([
  'name',
  'city',
  'institution_type',
  'student_capacity',
  'website',
  'address',
  'campuses',
]);

const AUTO_APPLY_COURSE_FIELDS = new Set([
  'title',
  'field',
  'duration_months',
  'tuition_fee',
  'university_name',
  'campuses',
]);

export interface DiffProgress {
  (totals: SyncTotals): Promise<void>;
}

@Injectable()
export class DiffService {
  constructor(
    @InjectRepository(University) private readonly universities: Repository<University>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(SyncChange) private readonly changes: Repository<SyncChange>,
    private readonly ds: DataSource,
  ) {}

  /**
   * Compares a register snapshot against the catalogue and writes `sync_change`
   * rows. Nothing is applied here — `applyAccepted` does that, after a decision.
   *
   * `staleBefore` scopes which existing rows are re-compared. The register is
   * one monthly CSV, so this cannot reduce what's downloaded; it exists so a
   * user can say "only re-check rows I haven't looked at in 6 months" and get a
   * short review list instead of all 12,749.
   */
  async buildDiff(
    run: SyncRun,
    snapshot: RegisterSnapshot,
    opts: { staleBefore?: Date | null } = {},
    onProgress?: DiffProgress,
  ): Promise<SyncTotals> {
    const locationsFor = locationsByCode(snapshot.locations);
    const campusNamesFor = campusNamesByCourse(snapshot.courseLocations ?? []);
    const totals: SyncTotals = {
      step: 'comparing institutions',
      processed: 0,
      total: snapshot.institutions.length + snapshot.courses.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      disappeared: 0,
      auto_applied: 0,
    };

    // Courses owned by a DIFFERENT import are out of scope: the aggregator
    // import holds third-party figures, and some of its rows carry a `cricos`
    // value that collides with a real register code, so comparing them would let
    // the register overwrite an aggregator fee or flag one as "disappeared".
    //
    // The exclusion is on the COURSES, never on the universities that hold them.
    // Excluding whole universities was correct only while aggregator rows were
    // separate; once those courses were merged onto real register rows, it hid 8
    // genuine providers from the diff, which then staged them as `create` —
    // duplicating CQU, UTAS, Newcastle and five others on every sync.
    const existingUnis = await this.universities.find({
      where: { country: 'AU' },
      relations: { campuses: true },
    });
    const uniByCode = new Map(
      existingUnis.filter((u) => u.cricos_provider_code).map((u) => [u.cricos_provider_code!, u]),
    );
    // Pre-registry rows were only ever identified by name; match on it as a
    // fallback so the first sync updates them instead of duplicating them.
    const uniByName = new Map(existingUnis.map((u) => [u.name.trim().toLowerCase(), u]));

    const staged: Partial<SyncChange>[] = [];
    const seenUniCodes = new Set<string>();

    for (const inst of snapshot.institutions) {
      const mapped = mapUniversity(
        inst,
        mapCampuses(inst, locationsFor.get(inst['CRICOS Provider Code']) ?? []),
      );
      seenUniCodes.add(mapped.cricos_provider_code);
      const existing =
        uniByCode.get(mapped.cricos_provider_code) ?? uniByName.get(mapped.name.trim().toLowerCase());

      if (!existing) {
        staged.push(this.stage(run, 'university', null, mapped.cricos_provider_code, mapped.name, 'create', [], mapped));
        totals.created!++;
      } else if (opts.staleBefore && existing.last_fetched_at && existing.last_fetched_at > opts.staleBefore) {
        totals.unchanged!++;
      } else {
        const diffs = this.diffUniversity(existing, mapped);
        if (!diffs.length) {
          totals.unchanged!++;
        } else {
          const auto = diffs.every((d) => AUTO_APPLY_UNIVERSITY_FIELDS.has(d.field));
          staged.push({
            ...this.stage(run, 'university', existing.id, mapped.cricos_provider_code, mapped.name, 'update', diffs, mapped),
            auto_applied: auto,
            decision: auto ? 'accepted' : 'pending',
          });
          totals.updated!++;
          if (auto) totals.auto_applied!++;
        }
      }
      totals.processed!++;
    }

    // Providers we hold that upstream no longer lists. Flagged only: a provider
    // missing from one monthly export is not proof it should be deleted, and
    // deleting a university cascades to every course under it.
    for (const u of existingUnis) {
      if (!u.cricos_provider_code || seenUniCodes.has(u.cricos_provider_code)) continue;
      staged.push(
        this.stage(run, 'university', u.id, u.cricos_provider_code, u.name, 'disappeared', [], {}),
      );
      totals.disappeared!++;
    }

    await this.flush(staged);
    totals.step = 'comparing courses';
    if (onProgress) await onProgress(totals);

    // Course identity is the CRICOS course code, which is unique nationally.
    // Aggregator-owned rows are excluded for the reason given above.
    const existingCourses = await this.courses.find({
      where: { country: 'AU', data_confidence: 'verified' },
      select: ['id', 'cricos', 'title', 'field', 'duration_months', 'tuition_fee', 'university_name', 'content_hash', 'last_fetched_at'],
    });
    const courseByCricos = new Map(
      existingCourses.filter((c) => c.cricos).map((c) => [c.cricos!, c]),
    );

    // Existing campus links, aggregated in one query rather than a relation load
    // per course — needed so a campus-only change is diffed rather than dropped.
    const existingCampusNamesFor = new Map<string, string[]>();
    for (const row of await this.ds.query<{ course_id: string; names: string[] }[]>(`
      SELECT cc.course_id, array_agg(uc.location_name ORDER BY uc.location_name) AS names
        FROM course_campus cc
        JOIN university_campus uc ON uc.id = cc.campus_id
       GROUP BY cc.course_id
    `)) {
      existingCampusNamesFor.set(row.course_id, row.names ?? []);
    }
    const seenCourseCodes = new Set<string>();
    const courseStaged: Partial<SyncChange>[] = [];

    for (const row of snapshot.courses) {
      const mapped = mapCourse(row, campusNamesFor.get(row['CRICOS Course Code']) ?? []);
      totals.processed!++;
      if (!mapped) continue;
      seenCourseCodes.add(mapped.cricos);
      const existing = courseByCricos.get(mapped.cricos);

      if (!existing) {
        courseStaged.push(
          this.stage(run, 'course', null, mapped.cricos, `${mapped.title} — ${mapped.university_name}`, 'create', [], mapped),
        );
        totals.created!++;
      } else if (opts.staleBefore && existing.last_fetched_at && existing.last_fetched_at > opts.staleBefore) {
        totals.unchanged!++;
      } else if (existing.content_hash && existing.content_hash === mapped.content_hash) {
        totals.unchanged!++;
      } else {
        const diffs = this.diffCourse(
          existing,
          mapped,
          existingCampusNamesFor.get(existing.id!) ?? [],
        );
        if (!diffs.length) {
          totals.unchanged!++;
        } else {
          const auto = diffs.every((d) => AUTO_APPLY_COURSE_FIELDS.has(d.field));
          courseStaged.push({
            ...this.stage(run, 'course', existing.id, mapped.cricos, `${mapped.title} — ${mapped.university_name}`, 'update', diffs, mapped),
            auto_applied: auto,
            decision: auto ? 'accepted' : 'pending',
          });
          totals.updated!++;
          if (auto) totals.auto_applied!++;
        }
      }
      if (courseStaged.length >= 500) {
        await this.flush(courseStaged.splice(0, courseStaged.length));
        if (onProgress) await onProgress(totals);
      }
    }

    for (const c of existingCourses) {
      if (!c.cricos || seenCourseCodes.has(c.cricos)) continue;
      courseStaged.push(
        this.stage(run, 'course', c.id, c.cricos, c.title, 'disappeared', [], {}),
      );
      totals.disappeared!++;
    }

    await this.flush(courseStaged);
    totals.step = 'compared';
    if (onProgress) await onProgress(totals);
    return totals;
  }

  private stage(
    run: SyncRun,
    entity_type: SyncChange['entity_type'],
    entity_id: string | null,
    natural_key: string,
    label: string,
    change_type: ChangeType,
    field_diffs: FieldDiff[],
    payload: object,
  ): Partial<SyncChange> {
    return {
      sync_run_id: run.id,
      entity_type,
      entity_id,
      natural_key,
      label,
      change_type,
      field_diffs,
      payload: payload as Record<string, unknown>,
      decision: 'pending',
    };
  }

  private async flush(rows: Partial<SyncChange>[]): Promise<void> {
    for (let i = 0; i < rows.length; i += 500) {
      // QueryDeepPartialEntity, not DeepPartial: SyncRun <-> SyncChange is a
      // bidirectional relation, which DeepPartial cannot resolve.
      await this.changes.insert(rows.slice(i, i + 500) as QueryDeepPartialEntity<SyncChange>[]);
    }
    rows.length = 0;
  }

  private diffUniversity(existing: University, mapped: MappedUniversity): FieldDiff[] {
    const candidates: [string, unknown, unknown][] = [
      ['name', existing.name, mapped.name],
      ['city', existing.city, mapped.city],
      ['world_rank', existing.world_rank, mapped.world_rank],
      ['institution_type', existing.institution_type, mapped.institution_type],
      ['student_capacity', existing.student_capacity, mapped.student_capacity],
      ['website', existing.website, mapped.website],
      ['address', existing.address, mapped.address],
      ['cricos_provider_code', existing.cricos_provider_code, mapped.cricos_provider_code],
      ['policy_key', existing.policy_key, mapped.policy_key],
      [
        'campuses',
        (existing.campuses ?? []).map((c) => c.location_name).sort().join(' · ') || null,
        mapped.campuses.map((c) => c.location_name).sort().join(' · ') || null,
      ],
    ];
    return candidates
      .filter(([, before, after]) => !this.same(before, after))
      // Never downgrade a curated rank to UNRANKED, or unlink a policy a human
      // attached, just because the register has nothing to say about either.
      .filter(([field, , after]) => {
        if (field === 'world_rank' && after === 999) return false;
        if (field === 'policy_key' && after == null) return false;
        return true;
      })
      .map(([field, before, after]) => ({ field, before, after }));
  }

  private diffCourse(
    existing: Partial<Course>,
    mapped: MappedCourse,
    existingCampusNames: string[] = [],
  ): FieldDiff[] {
    const candidates: [string, unknown, unknown][] = [
      ['title', existing.title, mapped.title],
      ['field', existing.field, mapped.field],
      ['duration_months', existing.duration_months, mapped.duration_months],
      ['tuition_fee', existing.tuition_fee, mapped.tuition_fee],
      ['university_name', existing.university_name, mapped.university_name],
      // Included so a course that only gained or lost a teaching campus still
      // produces a diff. Without it the change is detected by content_hash and
      // then dropped for having no field diffs, and the links never update.
      [
        'campuses',
        [...existingCampusNames].sort().join(' · ') || null,
        mapped.campus_location_names.join(' · ') || null,
      ],
    ];
    return candidates
      .filter(([, before, after]) => !this.same(before, after))
      .map(([field, before, after]) => ({ field, before, after }));
  }

  /** Numeric columns arrive as strings from some drivers; compare loosely. */
  private same(a: unknown, b: unknown): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    if (typeof a === 'number' || typeof b === 'number') {
      return Number(a) === Number(b);
    }
    return String(a) === String(b);
  }

  /**
   * Applies every accepted change in a run, in one transaction per batch.
   * `disappeared` rows are never applied — accepting one only acknowledges it.
   */
  async applyAccepted(run: SyncRun): Promise<SyncTotals> {
    const totals: SyncTotals = { applied: 0, failed: 0, step: 'applying' };
    const accepted = await this.changes.find({
      where: { sync_run_id: run.id, decision: 'accepted' },
      order: { entity_type: 'ASC' },
    });

    // Universities first: a created course needs its university_id to exist.
    const ordered = [
      ...accepted.filter((c) => c.entity_type === 'university'),
      ...accepted.filter((c) => c.entity_type !== 'university'),
    ];

    const now = new Date();
    for (const change of ordered) {
      if (change.change_type === 'disappeared') {
        await this.changes.update(change.id, { decision: 'applied', decided_at: now });
        continue;
      }
      try {
        await this.ds.transaction(async (m) => {
          if (change.entity_type === 'university') {
            await this.applyUniversity(m, change, now);
          } else if (change.entity_type === 'admission_policy') {
            await this.applyAdmissionPolicy(m, change, now);
          } else if (change.payload?.kind === 'course_english_band') {
            await this.applyCourseEnglishBand(m, change, now);
          } else if (change.payload?.kind === 'curation_patch') {
            await this.applyCurationPatch(m, change, now);
          } else if (change.entity_type === 'course') {
            await this.applyCourse(m, change, now);
          }
        });
        await this.changes.update(change.id, { decision: 'applied', decided_at: now });
        totals.applied!++;
      } catch (err) {
        await this.changes.update(change.id, {
          apply_error: err instanceof Error ? err.message : String(err),
        });
        totals.failed!++;
      }
    }
    return totals;
  }

  private async applyUniversity(m: any, change: SyncChange, now: Date): Promise<void> {
    const p = change.payload as unknown as MappedUniversity;
    const repo = m.getRepository(University);
    if (change.change_type === 'create') {
      const inserted = await repo.insert({
        name: p.name,
        country: 'AU',
        city: p.city,
        world_rank: p.world_rank,
        logo_hue: p.logo_hue,
        policy_key: p.policy_key,
        cricos_provider_code: p.cricos_provider_code,
        institution_type: p.institution_type,
        student_capacity: p.student_capacity,
        website: p.website,
        address: p.address,
        content_hash: p.content_hash,
        last_fetched_at: now,
      });
      const newId = inserted.identifiers?.[0]?.id as string | undefined;
      if (newId) await this.replaceCampuses(m, newId, p.campuses ?? []);
      return;
    }
    // Apply only the fields this change actually diffed, so an accepted change
    // can't silently revert an edit made elsewhere in the same row. `campuses` is
    // a diff entry for reviewer visibility, not a column — it is applied by
    // replacing the campus rows instead.
    const patch: Record<string, unknown> = { last_fetched_at: now, content_hash: p.content_hash };
    for (const d of change.field_diffs) {
      if (d.field === 'campuses') continue;
      patch[d.field] = d.after;
    }
    await repo.update(change.entity_id!, patch);
    if (change.field_diffs.some((d) => d.field === 'campuses')) {
      await this.replaceCampuses(m, change.entity_id!, p.campuses ?? []);
      // A campus that disappeared took its links with it (FK cascade), so the
      // denormalised city list on every course here has to be recomputed — not
      // just on the courses that independently changed in this run.
      await this.refreshCampusCitiesFor(m, change.entity_id!);
    }
  }

  /** Recomputes `course.campus_cities` from the surviving links for one provider. */
  private async refreshCampusCitiesFor(m: any, universityId: string): Promise<void> {
    await m.query(
      `UPDATE "course" c
          SET "campus_cities" = coalesce(sub.cities, '{}')
         FROM (
           SELECT cc.course_id, array_agg(DISTINCT uc.city ORDER BY uc.city) AS cities
             FROM "course_campus" cc
             JOIN "university_campus" uc ON uc.id = cc.campus_id
            GROUP BY cc.course_id
         ) sub
        WHERE sub.course_id = c.id AND c.university_id = $1`,
      [universityId],
    );
    await m.query(
      `UPDATE "course" c SET "campus_cities" = '{}'
        WHERE c.university_id = $1
          AND array_length(c."campus_cities", 1) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "course_campus" cc WHERE cc.course_id = c.id)`,
      [universityId],
    );
  }

  /**
   * Reconciles an institution's campuses against the register: updates the ones
   * that still exist, inserts new ones, deletes only those genuinely gone.
   *
   * Deliberately NOT delete-and-recreate. `course_campus.campus_id` is
   * ON DELETE CASCADE, so wiping a provider's campuses silently takes every one
   * of its course links with it — a first attempt at this dropped the catalogue
   * from 19,471 links to 1,731. Keeping campus ids stable is what keeps the
   * course links intact.
   */
  private async replaceCampuses(m: any, universityId: string, campuses: MappedCampus[]): Promise<void> {
    const repo = m.getRepository(UniversityCampus);
    const existing: UniversityCampus[] = await repo.find({ where: { university_id: universityId } });
    const keyOf = (c: { location_name: string; postcode: string | null }) =>
      `${c.location_name}|${c.postcode ?? ''}`;
    const existingByKey = new Map(existing.map((c) => [keyOf(c), c]));

    const wanted = new Set<string>();
    for (const c of campuses) {
      const key = keyOf(c);
      wanted.add(key);
      const match = existingByKey.get(key);
      if (match) {
        await repo.update(match.id, { ...c, university_id: universityId });
      } else {
        await repo.insert({ ...c, university_id: universityId });
      }
    }

    // Only campuses the register no longer lists. Their course links cascade
    // away with them, which is correct — the course is no longer taught there.
    const removed = existing.filter((c) => !wanted.has(keyOf(c))).map((c) => c.id);
    if (removed.length) await repo.delete({ id: In(removed) });
  }

  /**
   * Rebuilds a course's teaching-campus links and the denormalised
   * `campus_cities` it is derived from, resolving the register's location names
   * against the campuses of the course's own provider.
   */
  private async replaceCourseCampuses(
    m: any,
    courseId: string,
    universityId: string,
    locationNames: string[],
  ): Promise<void> {
    const linkRepo = m.getRepository(CourseCampus);
    await linkRepo.delete({ course_id: courseId });

    let cities: string[] = [];
    if (locationNames.length) {
      const campuses: UniversityCampus[] = await m
        .getRepository(UniversityCampus)
        .find({ where: { university_id: universityId } });
      const byName = new Map(campuses.map((c) => [c.location_name, c]));
      const matched = locationNames
        .map((n) => byName.get(n))
        .filter((c): c is UniversityCampus => !!c);
      if (matched.length) {
        await linkRepo.insert(matched.map((c) => ({ course_id: courseId, campus_id: c.id })));
        cities = [...new Set(matched.map((c) => c.city))].sort();
      }
    }
    // Kept in step with the links, and emptied when there are none — matching
    // reads this column and treats empty as "primary city only", never
    // "everywhere the provider operates".
    await m.getRepository(Course).update(courseId, { campus_cities: cities });
  }

  private async applyCourse(m: any, change: SyncChange, now: Date): Promise<void> {
    const p = change.payload as unknown as MappedCourse;
    const repo = m.getRepository(Course);
    if (change.change_type === 'create') {
      const uni = await m.getRepository(University).findOne({
        where: { cricos_provider_code: p.provider_code },
      });
      if (!uni) {
        throw new Error(`no university for provider code ${p.provider_code}`);
      }
      const inserted = await repo.insert({
        university_id: uni.id,
        university_name: p.university_name,
        country: 'AU',
        city: uni.city,
        world_rank: uni.world_rank,
        title: p.title,
        degree_level: p.degree_level,
        field: p.field,
        duration_months: p.duration_months,
        tuition_fee: p.tuition_fee,
        currency: 'AUD',
        intakes: ['Feb', 'Jul'],
        next_intake_date: isoInMonths(p.degree_level === 'PhD' ? 6 : 3),
        application_deadline: isoInMonths(p.degree_level === 'PhD' ? 4 : 1),
        // The register carries no entry requirement, so it stays unsourced and
        // the engine reports those gates as unknown. Real bands arrive from the
        // institution's own page, never from here.
        entry: { ...EMPTY_ENTRY_REQUIREMENT },
        career_outcomes: [],
        cricos: p.cricos,
        content_hash: p.content_hash,
        last_fetched_at: now,
      });
      const newId = inserted.identifiers?.[0]?.id as string | undefined;
      if (newId) {
        await this.replaceCourseCampuses(m, newId, uni.id, p.campus_location_names ?? []);
      }
      return;
    }
    const patch: Record<string, unknown> = { last_fetched_at: now, content_hash: p.content_hash };
    for (const d of change.field_diffs) {
      // Not a column — applied by rebuilding the link rows below.
      if (d.field === 'campuses') continue;
      patch[d.field] = d.after;
    }
    await repo.update(change.entity_id!, patch);
    if (change.field_diffs.some((d) => d.field === 'campuses')) {
      const existing = await repo.findOne({ where: { id: change.entity_id! } });
      if (existing) {
        await this.replaceCourseCampuses(
          m,
          existing.id,
          existing.university_id,
          p.campus_location_names ?? [],
        );
      }
    }
  }

  /**
   * Writes a scraped English band onto the courses it applies to, recording the
   * page it came from. Only touches courses whose band is STILL unsourced, so
   * accepting a general band later can't overwrite a program-specific one
   * accepted earlier, and a counsellor's manual figure always wins.
   */
  private async applyCourseEnglishBand(m: any, change: SyncChange, now: Date): Promise<void> {
    const p = change.payload as {
      course_ids: string[];
      min_english_band: number;
      requirement_source: string;
    };
    if (!p.course_ids?.length) return;
    await m.query(
      `UPDATE "course"
          SET "entry" = "entry" || jsonb_build_object(
                'min_english_band', $1::numeric,
                'requirement_source', $2::text
              ),
              "verified_at" = $3
        WHERE "id" = ANY($4::uuid[])
          AND "entry" -> 'min_english_band' = 'null'::jsonb`,
      [p.min_english_band, p.requirement_source, now, p.course_ids],
    );
  }

  /**
   * Applies a single field accepted from a conversational curation turn.
   *
   * Writes only the one field named in the proposal, and for a nested `entry.*`
   * field merges into the existing jsonb rather than replacing it — a curation
   * turn that set an English band must not blank out a GPA sourced elsewhere.
   * Records the citation as that value's provenance so the edit stays traceable
   * to the material the counsellor supplied.
   */
  private async applyCurationPatch(m: any, change: SyncChange, now: Date): Promise<void> {
    const p = change.payload as { field: string; value: unknown; cited?: string };
    if (!change.entity_id) throw new Error('curation patch has no target record');

    if (change.entity_type === 'course') {
      if (p.field.startsWith('entry.')) {
        const key = p.field.slice('entry.'.length);
        await m.query(
          `UPDATE "course"
              SET "entry" = "entry" || jsonb_build_object($1::text, $2::jsonb, 'requirement_source', $3::jsonb),
                  "verified_at" = $4
            WHERE "id" = $5`,
          [key, JSON.stringify(p.value), JSON.stringify(p.cited ?? null), now, change.entity_id],
        );
        return;
      }
      await m
        .getRepository(Course)
        .update(change.entity_id, { [p.field]: p.value as never, verified_at: now });
      return;
    }

    if (change.entity_type === 'university') {
      await m
        .getRepository(University)
        .update(change.entity_id, { [p.field]: p.value as never, verified_at: now });
      return;
    }

    // admission_policy: everything lives inside the `data` jsonb blob, and the
    // row stays `ai_drafted` until a human promotes it via the admission module.
    const repo = m.getRepository(AdmissionPolicyEntity);
    const existing = await repo.findOne({ where: { key: change.entity_id } });
    if (!existing) throw new Error(`no admission policy for key ${change.entity_id}`);
    await repo.update(existing.key, {
      data: { ...(existing.data as object), [p.field]: p.value },
      review_status: 'ai_drafted',
    });
  }

  /**
   * Upserts the institution-level policy as an AI draft. Never touches a policy
   * a human already marked `reviewed` — those came from real partner-portal
   * briefings and say far more than a public web page does.
   */
  private async applyAdmissionPolicy(m: any, change: SyncChange, now: Date): Promise<void> {
    const p = change.payload as {
      key: string;
      institution: string;
      source_url: string;
      bands: {
        level: string;
        label: string;
        min_ielts_overall: number | null;
        min_ielts_band: number | null;
        min_pte_overall: number | null;
        min_pte_band: number | null;
        quote: string;
      }[];
    };
    const repo = m.getRepository(AdmissionPolicyEntity);
    const existing = await repo.findOne({ where: { key: p.key } });
    if (existing?.review_status === 'reviewed') return;

    const academics = p.bands.map((b) => ({
      level: b.level,
      label: b.label || 'General',
      // The scrape reads English requirements only; the academic bar stays null
      // rather than being guessed from them.
      min_canonical_score: null,
      source_expression: b.quote,
      min_ielts_overall: b.min_ielts_overall,
      min_ielts_band: b.min_ielts_band,
      min_pte_overall: b.min_pte_overall,
      min_pte_band: b.min_pte_band,
    }));

    const data = {
      ...(existing?.data ?? {}),
      key: p.key,
      institution: p.institution,
      scope: 'English-language requirements read from the institution’s own site',
      source: p.source_url,
      effective_date: now.toISOString().slice(0, 10),
      academics,
      sponsors: (existing?.data as any)?.sponsors ?? [],
      income_thresholds: (existing?.data as any)?.income_thresholds ?? [],
      other_notes: (existing?.data as any)?.other_notes ?? [],
    };

    if (existing) {
      await repo.update(existing.key, { data, review_status: 'ai_drafted' });
    } else {
      await repo.insert({
        key: p.key,
        institution: p.institution,
        data,
        review_status: 'ai_drafted',
      });
    }
  }
}

/** CRICOS carries no live intake dates — forward-looking placeholders, flagged as such. */
function isoInMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
