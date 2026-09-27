import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { University } from '../university/university.entity';
import { Course } from '../course/course.entity';
import { SyncRun, SyncKind, SyncLogEntry, SyncStatus, SyncTotals } from './entities/sync-run.entity';
import { SyncChange, ChangeDecision } from './entities/sync-change.entity';
import { SourcePage } from './entities/source-page.entity';
import { CricosRegistryService } from './cricos-registry.service';
import { DiffService } from './diff.service';
import { SiteScrapeService, SiteScrapeParams } from './site-scrape.service';

export const SYNC_QUEUE = 'data-sync';

/** Staleness windows the wizard offers, in days. */
export const STALENESS_WINDOWS = {
  '7w': 49,
  '1m': 30,
  '3m': 90,
  '6m': 180,
  all: 0,
} as const;
export type StalenessWindow = keyof typeof STALENESS_WINDOWS;

@Injectable()
export class SyncService {
  private readonly log = new Logger(SyncService.name);

  constructor(
    @InjectQueue(SYNC_QUEUE) private readonly queue: Queue,
    @InjectRepository(SyncRun) private readonly runs: Repository<SyncRun>,
    @InjectRepository(SyncChange) private readonly changes: Repository<SyncChange>,
    @InjectRepository(SourcePage) private readonly sources: Repository<SourcePage>,
    @InjectRepository(University) private readonly universities: Repository<University>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    private readonly registry: CricosRegistryService,
    private readonly diff: DiffService,
    private readonly scraper: SiteScrapeService,
  ) {}

  /**
   * What the wizard's first step shows: when we last synced, what upstream
   * currently publishes, and how much of the catalogue is stale. Lets the user
   * see there's nothing to do before starting a 12,749-row comparison.
   */
  async cricosStatus() {
    const lastRun = await this.runs.findOne({
      where: { kind: 'cricos_register', status: 'done' },
      order: { finished_at: 'DESC' },
    });

    let upstream: Awaited<ReturnType<CricosRegistryService['getResourceMeta']>> | null = null;
    let upstreamError: string | null = null;
    try {
      upstream = await this.registry.getResourceMeta();
    } catch (err) {
      upstreamError = err instanceof Error ? err.message : String(err);
    }

    const lastSeen = (lastRun?.source_meta as any)?.courses?.last_modified ?? null;
    const currentUpstream = upstream?.courses?.last_modified ?? null;

    const [universities, courses, staleUniversities, staleCourses, neverFetched] = await Promise.all([
      this.universities.count({ where: { country: 'AU' } }),
      this.courses.count({ where: { country: 'AU' } }),
      this.universities.count({
        where: { country: 'AU', last_fetched_at: LessThan(this.daysAgo(30)) },
      }),
      this.courses.count({ where: { country: 'AU', last_fetched_at: LessThan(this.daysAgo(30)) } }),
      this.courses.count({ where: { country: 'AU', last_fetched_at: IsNull() } }),
    ]);

    const unsourcedEnglish = await this.courses
      .createQueryBuilder('c')
      .where('c.country = :country', { country: 'AU' })
      .andWhere(`c.entry -> 'min_english_band' = 'null'::jsonb`)
      .getCount();

    return {
      last_sync: lastRun
        ? { id: lastRun.id, finished_at: lastRun.finished_at, totals: lastRun.totals }
        : null,
      upstream,
      upstream_error: upstreamError,
      /** True when upstream hasn't republished since our last completed sync. */
      source_unchanged: Boolean(lastSeen && currentUpstream && lastSeen === currentUpstream),
      catalogue: {
        universities,
        courses,
        stale_universities: staleUniversities,
        stale_courses: staleCourses,
        never_fetched_courses: neverFetched,
        courses_without_sourced_english: unsourcedEnglish,
      },
      tracked_sources: await this.sources.count(),
    };
  }

  async queueRun(
    kind: SyncKind,
    params: Record<string, unknown>,
    userId: string | null,
  ): Promise<SyncRun> {
    const active = await this.runs.count({
      where: { kind, status: In(['queued', 'running', 'applying'] as SyncStatus[]) },
    });
    if (active > 0) {
      throw new BadRequestException(
        `A ${kind} run is already in progress. Wait for it to finish or cancel it.`,
      );
    }
    const run = await this.runs.save(
      this.runs.create({ kind, params, created_by: userId, status: 'queued' }),
    );
    await this.queue.add(kind, { runId: run.id }, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: 50,
      removeOnFail: 100,
    });
    return run;
  }

  /** Runs the CRICOS pull + diff. Called by the queue processor, not the API. */
  async executeCricosRun(runId: string): Promise<void> {
    const run = await this.runs.findOneByOrFail({ id: runId });
    await this.patch(run, { status: 'running', started_at: new Date() });
    await this.appendLog(run, 'info', 'Reading data.gov.au resource metadata');

    try {
      const params = (run.params ?? {}) as {
        window?: StalenessWindow;
        include_vet?: boolean;
        states?: string[];
        institution_types?: string[];
      };

      const snapshot = await this.registry.fetchSnapshot({
        include_vet: params.include_vet,
        states: params.states,
        institution_types: params.institution_types,
      });
      await this.patch(run, { source_meta: snapshot.meta as any });
      await this.appendLog(
        run,
        'info',
        `Fetched ${snapshot.institutions.length} institutions / ${snapshot.courses.length} in-scope courses ` +
          `(source file dated ${snapshot.meta.courses?.last_modified ?? 'unknown'})`,
      );

      const days = STALENESS_WINDOWS[params.window ?? 'all'];
      const staleBefore = days > 0 ? this.daysAgo(days) : null;
      if (staleBefore) {
        await this.appendLog(
          run,
          'info',
          `Only comparing records not fetched since ${staleBefore.toISOString().slice(0, 10)}`,
        );
      }

      const totals = await this.diff.buildDiff(run, snapshot, { staleBefore }, async (t) =>
        this.patch(run, { totals: t }),
      );

      // Auto-applied changes were staged pre-accepted; apply them now so the
      // review list contains only what genuinely needs a human.
      if (totals.auto_applied) {
        await this.patch(run, { status: 'applying' });
        const applied = await this.diff.applyAccepted(run);
        await this.appendLog(
          run,
          'info',
          `Auto-applied ${applied.applied} register-sourced change(s); ${applied.failed} failed`,
        );
        totals.applied = applied.applied;
        totals.failed = applied.failed;
      }

      const needsReview = await this.changes.count({
        where: { sync_run_id: run.id, decision: 'pending' },
      });
      totals.step = needsReview > 0 ? 'awaiting review' : 'complete';
      await this.patch(run, {
        totals,
        status: needsReview > 0 ? 'awaiting_review' : 'done',
        finished_at: needsReview > 0 ? null : new Date(),
      });
      await this.appendLog(
        run,
        'info',
        needsReview > 0
          ? `${needsReview} change(s) staged for review`
          : 'Nothing needed review — run complete',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.appendLog(run, 'error', message);
      await this.patch(run, { status: 'failed', error: message, finished_at: new Date() });
      throw err;
    }
  }

  /**
   * Visits institution websites for the English requirements CRICOS doesn't
   * publish. Everything it finds is staged — nothing auto-applies, because
   * these values come from AI extraction rather than a government register.
   */
  async executeSiteScrapeRun(runId: string): Promise<void> {
    const run = await this.runs.findOneByOrFail({ id: runId });
    await this.patch(run, { status: 'running', started_at: new Date() });

    try {
      const totals = await this.scraper.execute(
        run,
        (run.params ?? {}) as SiteScrapeParams,
        async (t, message) => {
          if (Object.keys(t).length) await this.patch(run, { totals: { ...run.totals, ...t } });
          if (message) await this.appendLog(run, 'info', message);
        },
      );

      const needsReview = await this.changes.count({
        where: { sync_run_id: run.id, decision: 'pending' },
      });
      totals.step = needsReview > 0 ? 'awaiting review' : 'complete';
      await this.patch(run, {
        totals,
        status: needsReview > 0 ? 'awaiting_review' : 'done',
        finished_at: needsReview > 0 ? null : new Date(),
      });
      await this.appendLog(
        run,
        'info',
        needsReview > 0
          ? `${needsReview} requirement proposal(s) staged for review`
          : 'No new requirements found — run complete',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.appendLog(run, 'error', message);
      await this.patch(run, { status: 'failed', error: message, finished_at: new Date() });
      throw err;
    }
  }

  /** Coverage + freshness of the per-institution requirement sourcing. */
  async sourcesStatus() {
    const [tracked, ok, blocked, failed] = await Promise.all([
      this.sources.count(),
      this.sources.count({ where: { fetch_status: 'ok' } }),
      this.sources.count({ where: { fetch_status: 'blocked_by_robots' } }),
      this.sources.count({ where: { fetch_status: 'http_error' } }),
    ]);

    const withBand = await this.courses
      .createQueryBuilder('c')
      .where('c.country = :c', { c: 'AU' })
      .andWhere(`jsonb_typeof(c.entry -> 'min_english_band') = 'number'`)
      .getCount();
    const totalCourses = await this.courses.count({ where: { country: 'AU' } });

    // `source_page.entity_id` is polymorphic (university | course |
    // admission_policy) so it cannot carry a foreign key. That let the whole
    // provenance registry silently orphan when a reseed recreated university
    // rows with new ids — 49 of 49 rows pointed at records that no longer
    // existed, and nothing surfaced it. Counted and reported so it is loud.
    const orphanedPages = await this.sources
      .createQueryBuilder('sp')
      .where(`sp.entity_type = 'university'`)
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM university u WHERE u.id = sp.entity_id)`,
      )
      .getCount();

    const institutionsWithSource = await this.sources
      .createQueryBuilder('sp')
      .select('COUNT(DISTINCT sp.entity_id)', 'n')
      .where(`sp.entity_type = 'university'`)
      .andWhere(`sp.fetch_status = 'ok'`)
      .getRawOne<{ n: string }>();
    const totalInstitutions = await this.universities.count({ where: { country: 'AU' } });

    // Institutions the scraper has established it cannot read. Surfaced as a
    // first-class number because they need a different workflow (manual entry or
    // a document upload), not another scrape attempt.
    const blockedRows = await this.universities
      .createQueryBuilder('u')
      .select('u.auto_source_reason', 'reason')
      .addSelect('COUNT(*)::int', 'count')
      .where(`u.auto_source_status = 'blocked'`)
      .groupBy('u.auto_source_reason')
      .getRawMany<{ reason: string | null; count: number }>();
    const blockedTotal = blockedRows.reduce((n, r) => n + Number(r.count), 0);

    return {
      pages: {
        tracked,
        ok,
        blocked_by_robots: blocked,
        http_error: failed,
        /** Pages whose institution no longer exists — provenance has been lost. */
        orphaned: orphanedPages,
      },
      auto_source: {
        blocked_institutions: blockedTotal,
        by_reason: blockedRows.map((r) => ({ reason: r.reason ?? 'unknown', count: Number(r.count) })),
      },
      coverage: {
        courses_with_sourced_band: withBand,
        courses_total: totalCourses,
        institutions_with_a_source: Number(institutionsWithSource?.n ?? 0),
        institutions_total: totalInstitutions,
      },
    };
  }

  /** Institutions that cannot be auto-sourced, so a human can work through them. */
  async listBlockedInstitutions(opts: { skip?: number; take?: number } = {}) {
    const [items, total] = await this.universities.findAndCount({
      where: { auto_source_status: 'blocked' },
      select: [
        'id',
        'name',
        'website',
        'auto_source_reason',
        'auto_source_note',
        'auto_source_checked_at',
        'auto_source_failures',
      ],
      order: { name: 'ASC' },
      skip: opts.skip ?? 0,
      take: Math.min(opts.take ?? 100, 300),
    });
    return { items, total };
  }

  async listSourcePages(opts: {
    entity_id?: string;
    fetch_status?: string;
    q?: string;
    skip?: number;
    take?: number;
  }) {
    const qb = this.sources
      .createQueryBuilder('sp')
      .orderBy('sp.last_fetched_at', 'DESC', 'NULLS LAST')
      .skip(opts.skip ?? 0)
      .take(Math.min(opts.take ?? 50, 200));
    if (opts.entity_id) qb.andWhere('sp.entity_id = :id', { id: opts.entity_id });
    if (opts.fetch_status) qb.andWhere('sp.fetch_status = :s', { s: opts.fetch_status });
    if (opts.q) qb.andWhere('(sp.url ILIKE :q OR sp.description ILIKE :q)', { q: `%${opts.q}%` });
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /** A counsellor correcting what a tracked page actually holds. */
  async updateSourcePage(
    id: string,
    patch: { description?: string; data_kinds?: string[]; notes?: string; verified?: boolean },
    userId: string | null,
  ) {
    const page = await this.sources.findOne({ where: { id } });
    if (!page) throw new NotFoundException('Source page not found');
    await this.sources.update(id, {
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.data_kinds !== undefined ? { data_kinds: patch.data_kinds as any } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.verified
        ? { verified_by: userId, verified_at: new Date() }
        : patch.verified === false
          ? { verified_by: null, verified_at: null }
          : {}),
    });
    return this.sources.findOne({ where: { id } });
  }

  async getRun(id: string): Promise<SyncRun> {
    const run = await this.runs.findOne({ where: { id } });
    if (!run) throw new NotFoundException('Sync run not found');
    return run;
  }

  async listRuns(kind?: SyncKind, limit = 25): Promise<SyncRun[]> {
    return this.runs.find({
      where: kind ? { kind } : {},
      order: { created_at: 'DESC' },
      take: Math.min(limit, 100),
    });
  }

  async listChanges(
    runId: string,
    opts: { entity_type?: string; change_type?: string; decision?: string; q?: string; skip?: number; take?: number },
  ) {
    const qb = this.changes
      .createQueryBuilder('c')
      .where('c.sync_run_id = :runId', { runId })
      .orderBy('c.change_type', 'ASC')
      .addOrderBy('c.label', 'ASC')
      .skip(opts.skip ?? 0)
      .take(Math.min(opts.take ?? 50, 200));

    if (opts.entity_type) qb.andWhere('c.entity_type = :et', { et: opts.entity_type });
    if (opts.change_type) qb.andWhere('c.change_type = :ct', { ct: opts.change_type });
    if (opts.decision) qb.andWhere('c.decision = :d', { d: opts.decision });
    if (opts.q) qb.andWhere('(c.label ILIKE :q OR c.natural_key ILIKE :q)', { q: `%${opts.q}%` });

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /** Counts per change_type/entity_type — drives the review step's summary chips. */
  async changeSummary(runId: string) {
    const rows = await this.changes
      .createQueryBuilder('c')
      .select('c.entity_type', 'entity_type')
      .addSelect('c.change_type', 'change_type')
      .addSelect('c.decision', 'decision')
      .addSelect('COUNT(*)::int', 'count')
      .where('c.sync_run_id = :runId', { runId })
      .groupBy('c.entity_type')
      .addGroupBy('c.change_type')
      .addGroupBy('c.decision')
      .getRawMany();
    return rows;
  }

  async decide(
    runId: string,
    ids: string[],
    decision: Extract<ChangeDecision, 'accepted' | 'rejected'>,
    userId: string | null,
  ) {
    if (!ids.length) throw new BadRequestException('No change ids supplied');
    const res = await this.changes.update(
      { id: In(ids), sync_run_id: runId, decision: Not(In(['applied'] as ChangeDecision[])) },
      { decision, decided_by: userId, decided_at: new Date() },
    );
    return { updated: res.affected ?? 0 };
  }

  /** Accept/reject everything still pending, optionally narrowed by type. */
  async decideAll(
    runId: string,
    decision: Extract<ChangeDecision, 'accepted' | 'rejected'>,
    filter: { entity_type?: string; change_type?: string },
    userId: string | null,
  ) {
    const where: Record<string, unknown> = { sync_run_id: runId, decision: 'pending' };
    if (filter.entity_type) where.entity_type = filter.entity_type;
    if (filter.change_type) where.change_type = filter.change_type;
    const res = await this.changes.update(where, {
      decision,
      decided_by: userId,
      decided_at: new Date(),
    });
    return { updated: res.affected ?? 0 };
  }

  async applyRun(id: string): Promise<SyncRun> {
    const run = await this.getRun(id);
    if (!['awaiting_review', 'done'].includes(run.status)) {
      throw new BadRequestException(`Run is ${run.status}; only a reviewed run can be applied.`);
    }
    await this.patch(run, { status: 'applying' });
    const totals = await this.diff.applyAccepted(run);
    const merged = { ...run.totals, ...totals };
    const stillPending = await this.changes.count({
      where: { sync_run_id: run.id, decision: 'pending' },
    });
    await this.patch(run, {
      totals: merged,
      status: stillPending > 0 ? 'awaiting_review' : 'done',
      finished_at: stillPending > 0 ? null : new Date(),
    });
    await this.appendLog(
      run,
      'info',
      `Applied ${totals.applied} change(s), ${totals.failed} failed, ${stillPending} still pending`,
    );
    return this.getRun(id);
  }

  async cancelRun(id: string): Promise<SyncRun> {
    const run = await this.getRun(id);
    if (['done', 'failed', 'cancelled'].includes(run.status)) return run;
    await this.patch(run, { status: 'cancelled', finished_at: new Date() });
    await this.appendLog(run, 'warn', 'Cancelled by user');
    return this.getRun(id);
  }

  private daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  /** QueryDeepPartialEntity: the SyncRun <-> SyncChange relation defeats DeepPartial. */
  private async patch(run: SyncRun, patch: QueryDeepPartialEntity<SyncRun>): Promise<void> {
    Object.assign(run, patch);
    await this.runs.update(run.id, patch);
  }

  private async appendLog(run: SyncRun, level: SyncLogEntry['level'], message: string): Promise<void> {
    const entry: SyncLogEntry = { at: new Date().toISOString(), level, message };
    this.log[level === 'error' ? 'error' : 'log'](`[${run.kind}:${run.id.slice(0, 8)}] ${message}`);
    // Append in SQL so concurrent progress writes don't clobber each other.
    await this.runs.query(`UPDATE "sync_run" SET "log" = "log" || $1::jsonb WHERE "id" = $2`, [
      JSON.stringify([entry]),
      run.id,
    ]);
  }
}
