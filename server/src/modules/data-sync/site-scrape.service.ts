import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AutoSourceReason, University } from '../university/university.entity';
import { Course } from '../course/course.entity';
import { AdmissionPolicyEntity } from '../admission/admission-policy.entity';
import { IngestionService } from '../knowledge/ingestion.service';
import { SourcePage } from './entities/source-page.entity';
import { SyncChange } from './entities/sync-change.entity';
import { SyncRun, SyncTotals } from './entities/sync-run.entity';
import { SiteFetchService } from './site-fetch.service';
import { PageDiscoveryService } from './page-discovery.service';
import { ExtractedBand, RequirementExtractionService } from './requirement-extraction.service';
import { ProgramLevel } from '../admission/admission-policy.types';
import { DegreeLevel } from '../../common/enums';

export interface SiteScrapeParams {
  /** Specific institutions; omitted = chosen by `only_missing` / staleness. */
  university_ids?: string[];
  /** Only institutions with no English band sourced yet. Default true. */
  only_missing?: boolean;
  /** Re-check pages not fetched in this many days. */
  stale_days?: number;
  /** Institutions per run — scraping 663 sites in one go is neither polite nor reviewable. */
  limit?: number;
  /** Candidate pages to try per institution. */
  max_pages?: number;
  /** Re-attempt institutions already flagged as unreadable. */
  retry_blocked?: boolean;
}

/** How a policy level maps onto the catalogue's degree levels. */
const LEVEL_TO_DEGREES: Record<ProgramLevel, DegreeLevel[]> = {
  UG: ['Bachelor'],
  PG: ['Master', 'PG Diploma'],
  PG_RESEARCH: ['PhD'],
  PATHWAY: [],
};

/**
 * Programs that commonly carry a higher English bar than an institution's
 * general requirement. Used only to MATCH a band the page already stated to the
 * courses it names — never to invent a program-specific bar.
 */
const PROGRAM_KEYWORDS = [
  'law',
  'nursing',
  'midwifery',
  'medicine',
  'teaching',
  'education',
  'psychology',
  'social work',
  'pharmacy',
  'dentistry',
  'physiotherapy',
  'speech pathology',
  'occupational therapy',
  'veterinary',
  'engineering',
  'translation',
];

@Injectable()
export class SiteScrapeService {
  private readonly log = new Logger(SiteScrapeService.name);

  constructor(
    @InjectRepository(University) private readonly universities: Repository<University>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(SourcePage) private readonly sources: Repository<SourcePage>,
    @InjectRepository(SyncChange) private readonly changes: Repository<SyncChange>,
    @InjectRepository(AdmissionPolicyEntity)
    private readonly policies: Repository<AdmissionPolicyEntity>,
    private readonly fetcher: SiteFetchService,
    private readonly discovery: PageDiscoveryService,
    private readonly extractor: RequirementExtractionService,
    private readonly ingestion: IngestionService,
  ) {}

  /** Institutions this run should visit, in a deliberate order. */
  async selectTargets(params: SiteScrapeParams): Promise<University[]> {
    const limit = Math.min(params.limit ?? 25, 200);

    if (params.university_ids?.length) {
      return this.universities.findByIds(params.university_ids);
    }

    const qb = this.universities
      .createQueryBuilder('u')
      .where('u.country = :c', { c: 'AU' })
      .andWhere('u.website IS NOT NULL')
      // Biggest catalogues first: sourcing one band for a 900-course provider
      // buys far more coverage than for a two-course college.
      .orderBy(
        `(SELECT COUNT(*) FROM course c WHERE c.university_id = u.id)`,
        'DESC',
      )
      .limit(limit);

    // Don't keep re-attempting sites already known to block automated reads —
    // that's the whole point of recording it. `retry_blocked` forces a recheck
    // if a site is thought to have changed.
    if (!params.retry_blocked) {
      qb.andWhere(`u.auto_source_status <> 'blocked'`);
    }
    if (params.only_missing !== false) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM course c WHERE c.university_id = u.id
                 AND c.entry -> 'min_english_band' = 'null'::jsonb)`,
      );
    }
    if (params.stale_days) {
      qb.andWhere(
        `NOT EXISTS (SELECT 1 FROM source_page sp
                     WHERE sp.entity_type = 'university' AND sp.entity_id = u.id
                     AND sp.last_fetched_at > NOW() - (:days || ' days')::interval)`,
        { days: params.stale_days },
      );
    }
    return qb.getMany();
  }

  /**
   * Visits each target institution's own site, extracts whatever English
   * requirements it actually publishes, and stages them for review.
   *
   * Nothing is written to the catalogue here. Every extracted band becomes a
   * `sync_change` a human accepts or rejects, and every page read becomes a
   * `source_page` row so the same fact can be re-pulled later instead of
   * quietly ageing.
   */
  async execute(
    run: SyncRun,
    params: SiteScrapeParams,
    onProgress: (t: SyncTotals, log?: string) => Promise<void>,
  ): Promise<SyncTotals> {
    const targets = await this.selectTargets(params);
    const maxPages = Math.min(params.max_pages ?? 4, 10);
    const totals: SyncTotals = {
      step: 'scraping institution sites',
      total: targets.length,
      processed: 0,
      created: 0,
      unchanged: 0,
      failed: 0,
    };
    await onProgress(totals, `Visiting ${targets.length} institution site(s)`);

    for (const uni of targets) {
      try {
        const result = await this.scrapeOne(run.id, uni, maxPages, onProgress);
        totals.created! += result.staged;
        // An institution whose site couldn't be read at all is a FAILURE, not
        // "unchanged" — conflating them hid a 50% block rate behind a clean
        // -looking total on the first real multi-institution run.
        if (!result.readable) totals.failed!++;
        else if (result.staged === 0) totals.unchanged!++;
      } catch (e) {
        totals.failed!++;
        await onProgress(totals, `${uni.name}: ${(e as Error).message}`);
      }
      totals.processed!++;
      await onProgress(totals);
    }

    totals.step = 'compared';
    await onProgress(
      totals,
      `Read ${totals.processed! - totals.failed!} of ${totals.processed} site(s); ` +
        `${totals.failed} could not be read (robots.txt, anti-bot, or client-rendered)`,
    );
    return totals;
  }

  private async scrapeOne(
    runId: string,
    uni: University,
    maxPages: number,
    onProgress: (t: SyncTotals, log?: string) => Promise<void>,
  ): Promise<{ staged: number; readable: boolean }> {
    const { candidates, notes } = await this.discovery.discover(uni.website!, maxPages);
    if (!candidates.length) {
      const detail = notes.join('; ');
      await this.noteFailure(uni, detail);
      const reason = this.classifyFailure(detail);
      await this.markAutoSource(uni, 'blocked', reason, detail);
      await onProgress(
        {},
        `${uni.name}: cannot be auto-sourced (${reason}) — flagged for manual entry. ${detail}`,
      );
      return { staged: 0, readable: false };
    }

    let stagedTotal = 0;
    let anyPageRead = false;
    for (const candidate of candidates) {
      const page = await this.fetcher.fetch(candidate.url);
      const existing = await this.sources.findOne({ where: { url: candidate.url } });

      if (!page.ok) {
        await this.sources.save({
          ...(existing ?? {}),
          url: candidate.url,
          domain: this.hostOf(candidate.url),
          trust_tier: this.fetcher.trustTierFor(candidate.url),
          data_kinds: candidate.data_kinds,
          entity_type: 'university' as const,
          entity_id: uni.id,
          last_fetched_at: new Date(),
          http_status: page.status,
          fetch_status: page.robotsBlocked ? ('blocked_by_robots' as const) : page.status ? ('http_error' as const) : ('fetch_error' as const),
          robots_allowed: !page.robotsBlocked,
          notes: page.reason,
        });
        continue;
      }

      anyPageRead = true;

      // Unchanged page: record the visit, skip the LLM call entirely.
      if (existing?.content_hash === page.contentHash) {
        await this.sources.update(existing.id, {
          last_fetched_at: new Date(),
          http_status: page.status,
          fetch_status: 'unchanged',
        });
        continue;
      }

      const extraction = await this.extractor.extract({
        url: page.finalUrl,
        title: page.title,
        text: page.text,
      });

      const source = await this.sources.save({
        ...(existing ?? {}),
        url: candidate.url,
        domain: this.hostOf(candidate.url),
        trust_tier: this.fetcher.trustTierFor(candidate.url),
        data_kinds: extraction.has_requirements
          ? (['english_requirements'] as const).slice()
          : candidate.data_kinds,
        description:
          extraction.page_description ||
          existing?.description ||
          `Matched "${candidate.matched}" on ${uni.name}'s site.`,
        entity_type: 'university' as const,
        entity_id: uni.id,
        last_fetched_at: new Date(),
        last_changed_at: new Date(),
        content_hash: page.contentHash,
        http_status: page.status,
        fetch_status: 'ok' as const,
        robots_allowed: true,
        notes: extraction.notes.join('; '),
      });

      if (!extraction.has_requirements) {
        // The page talks about English requirements but states no numbers —
        // most universities put the actual table one hop below an
        // "entry requirements" hub. Observed on Curtin, Flinders and Swinburne,
        // where two-hop discovery reached the hub and stopped. Follow the page's
        // own English-requirement links rather than giving up on the provider.
        if (/\b(ielts|pte|toefl|english language)\b/i.test(page.text)) {
          stagedTotal += await this.drillDown(runId, uni, page, onProgress);
        }
        continue;
      }

      // Into the RAG corpus too, so the AI can quote the page's wording — with
      // its real URL and today's date, per PLAN.md's citation requirement.
      await this.ingestion.ingestText(page.finalUrl, page.text, {
        title: page.title || `${uni.name} — entry requirements`,
        doc_type: 'entry_requirement',
        country: 'AU',
        institution: uni.name,
        publisher: uni.name,
        effective_date: new Date().toISOString().slice(0, 10),
      });

      const staged = await this.stage(runId, uni, source, extraction.bands, extraction.confidence);
      stagedTotal += staged;
      await onProgress(
        {},
        `${uni.name}: read ${extraction.bands.length} band(s) from ${candidate.matched}` +
          ` (confidence ${extraction.confidence.toFixed(2)}) -> ` +
          this.stagedSummary(staged, extraction.bands.length),
      );
    }

    await this.markAutoSource(
      uni,
      anyPageRead ? 'ok' : 'blocked',
      anyPageRead ? null : 'anti_bot',
      anyPageRead ? '' : 'candidate pages were found but none could be fetched',
    );
    return { staged: stagedTotal, readable: anyPageRead };
  }

  /**
   * One extra hop from a hub page that mentions English tests but gives no
   * numbers, following only its links that look like the actual requirements
   * table. Bounded to two fetches so a miss costs little.
   */
  private async drillDown(
    runId: string,
    uni: University,
    hub: { finalUrl: string; links: { href: string; text: string }[] },
    onProgress: (t: SyncTotals, log?: string) => Promise<void>,
  ): Promise<number> {
    const rootHost = new URL(hub.finalUrl).hostname;
    const targets = hub.links
      .filter((l) => this.fetcher.isSameSite(l.href, rootHost))
      .map((l) => ({ ...l, href: l.href.split('#')[0] }))
      .filter((l) =>
        /english[-_ ]?(language)?[-_ ]?(requirement|proficiency|competenc)|ielts|pte/i.test(
          `${l.text} ${decodeURIComponent(new URL(l.href).pathname)}`,
        ),
      )
      .filter((l) => l.href !== hub.finalUrl)
      .slice(0, 2);

    let staged = 0;
    for (const target of targets) {
      const page = await this.fetcher.fetch(target.href);
      if (!page.ok) continue;
      const extraction = await this.extractor.extract({
        url: page.finalUrl,
        title: page.title,
        text: page.text,
      });

      const existing = await this.sources.findOne({ where: { url: target.href } });
      const source = await this.sources.save({
        ...(existing ?? {}),
        url: target.href,
        domain: this.hostOf(target.href),
        trust_tier: this.fetcher.trustTierFor(target.href),
        data_kinds: extraction.has_requirements
          ? (['english_requirements'] as const).slice()
          : (['entry_requirements'] as const).slice(),
        description: extraction.page_description || existing?.description || '',
        entity_type: 'university' as const,
        entity_id: uni.id,
        last_fetched_at: new Date(),
        last_changed_at: new Date(),
        content_hash: page.contentHash,
        http_status: page.status,
        fetch_status: 'ok' as const,
        robots_allowed: true,
        notes: extraction.notes.join('; '),
      });

      if (!extraction.has_requirements) continue;

      await this.ingestion.ingestText(page.finalUrl, page.text, {
        title: page.title || `${uni.name} — English requirements`,
        doc_type: 'entry_requirement',
        country: 'AU',
        institution: uni.name,
        publisher: uni.name,
        effective_date: new Date().toISOString().slice(0, 10),
      });

      const n = await this.stage(runId, uni, source, extraction.bands, extraction.confidence);
      staged += n;
      await onProgress(
        {},
        `${uni.name}: read ${extraction.bands.length} band(s) one hop deeper at ` +
          `${new URL(target.href).pathname} -> ${this.stagedSummary(n, extraction.bands.length)}`,
      );
    }
    return staged;
  }

  /**
   * Turns extracted bands into staged changes: one institution-level
   * `admission_policy` proposal, plus per-course proposals where the page named
   * a specific program.
   */
  private async stage(
    runId: string,
    uni: University,
    source: SourcePage,
    bands: ExtractedBand[],
    confidence: number,
  ): Promise<number> {
    let count = await this.stagePolicy(runId, uni, source, bands, confidence);

    // Most specific label first, general ("") last. Two bands can legitimately
    // match the same course (UNSW's "Science" and "Engineering" both match a
    // Bachelor of Computer Science), so each course is claimed by exactly one
    // proposal and removed from the pool. Without this the per-proposal counts
    // shown to the reviewer would double-count, and which band actually won
    // would depend on the order the reviewer happened to accept them in.
    const claimed = new Set<string>();
    const ordered = [...bands].sort((a, b) => this.specificity(b) - this.specificity(a));
    for (const band of ordered) {
      count += await this.stageCourseBand(runId, uni, source, band, confidence, claimed);
    }
    return count;
  }

  /** A named program beats a faculty name, which beats the general band. */
  private specificity(b: ExtractedBand): number {
    if (!b.label) return 0;
    const lower = b.label.toLowerCase();
    return PROGRAM_KEYWORDS.some((k) => lower.includes(k)) ? 2 : 1;
  }

  private async stagePolicy(
    runId: string,
    uni: University,
    source: SourcePage,
    bands: ExtractedBand[],
    confidence: number,
  ): Promise<number> {
    const key = uni.policy_key ?? this.slug(uni.name);
    const existing = await this.policies.findOne({ where: { key } });

    // Never overwrite a human-reviewed briefing with a scrape. Those 9 policies
    // came from real partner-portal documents and are richer than anything a
    // public page states.
    if (existing?.review_status === 'reviewed') {
      await this.sources.update(source.id, {
        notes: `${source.notes ? source.notes + '; ' : ''}institution already has a reviewed policy — English bands staged per course only`,
      });
      return 0;
    }

    // Typed as Partial<SyncChange> before insert: TypeORM's DeepPartial mangles
    // an inline object literal whose jsonb fields hold nulls and primitives.
    const row: Partial<SyncChange> = {
      sync_run_id: runId,
      entity_type: 'admission_policy',
      entity_id: existing?.key ? null : null,
      natural_key: key,
      label: `${uni.name} — English requirements`,
      change_type: existing ? 'update' : 'create',
      field_diffs: bands.map((b) => ({
        field: `academics[${b.level}${b.label ? `:${b.label}` : ''}]`,
        before: null,
        after: this.describeBand(b),
      })),
      payload: {
        key,
        institution: uni.name,
        university_id: uni.id,
        source_url: source.url,
        bands,
      },
      auto_applied: false,
      decision: 'pending',
      source_page_id: source.id,
      confidence,
    };
    await this.changes.insert(row as QueryDeepPartialEntity<SyncChange>);
    return 1;
  }

  private async stageCourseBand(
    runId: string,
    uni: University,
    source: SourcePage,
    band: ExtractedBand,
    confidence: number,
    claimed: Set<string>,
  ): Promise<number> {
    const degrees = LEVEL_TO_DEGREES[band.level];
    if (!degrees.length) return 0;

    const ielts = band.min_ielts_overall;
    if (ielts == null) return 0; // the catalogue's canonical bar is IELTS-equivalent

    const qb = this.courses
      .createQueryBuilder('c')
      .where('c.university_id = :id', { id: uni.id })
      .andWhere('c.degree_level IN (:...levels)', { levels: degrees })
      .andWhere(`c.entry -> 'min_english_band' = 'null'::jsonb`);

    if (band.label) {
      const terms = this.matchTerms(band.label);
      // A label we can't turn into any usable term ("Other programs") is too
      // vague to attach to specific courses — skip rather than guess wide.
      if (!terms.length) return 0;
      qb.andWhere(
        `(${terms.map((_, i) => `LOWER(c.title) LIKE :t${i} OR LOWER(c.field) LIKE :t${i}`).join(' OR ')})`,
        Object.fromEntries(terms.map((t, i) => [`t${i}`, `%${t}%`])),
      );
    }

    const matched = await qb.limit(2000).getMany();
    const affected = matched.filter((c) => !claimed.has(c.id));
    if (!affected.length) return 0;
    for (const c of affected) claimed.add(c.id);

    const row: Partial<SyncChange> = {
      sync_run_id: runId,
      entity_type: 'course',
      entity_id: null,
      natural_key: `${uni.cricos_provider_code ?? uni.id}:${band.level}:${band.label || 'general'}`,
      // Level is in the label because a page often states the same faculty
      // twice with different figures for UG and PG; without it the review list
      // shows two identical-looking rows.
      label: `${uni.name} — ${band.label || 'general'} [${band.level}] (${affected.length} course${affected.length === 1 ? '' : 's'})`,
      change_type: 'update',
      field_diffs: [
        { field: 'entry.min_english_band', before: null, after: ielts },
        { field: 'entry.requirement_source', before: null, after: source.url },
      ],
      payload: {
        kind: 'course_english_band',
        university_id: uni.id,
        course_ids: affected.map((c) => c.id),
        min_english_band: ielts,
        min_ielts_band: band.min_ielts_band,
        requirement_source: source.url,
        quote: band.quote,
        label: band.label,
        level: band.level,
      },
      auto_applied: false,
      decision: 'pending',
      source_page_id: source.id,
      confidence,
    };
    await this.changes.insert(row as QueryDeepPartialEntity<SyncChange>);
    return 1;
  }

  /**
   * Turns a page's own label for a band into terms that can match course titles
   * and fields.
   *
   * Universities label these by faculty ("Arts, Design & Architecture") as often
   * as by program ("Master of Teaching"), so a fixed keyword list misses most of
   * them — on UNSW it attached only 88 of 598 courses, leaving real published
   * bands for Business and Science unusable. A recognised program keyword is
   * preferred when present, since it's more specific than a faculty name;
   * otherwise the label's own distinctive words are used.
   */
  private matchTerms(label: string): string[] {
    const lower = label.toLowerCase();
    const keyword = PROGRAM_KEYWORDS.find((k) => lower.includes(k));
    if (keyword) return [keyword];

    const STOPWORDS = new Set([
      'bachelor', 'master', 'masters', 'doctor', 'graduate', 'degree', 'degrees',
      'honours', 'program', 'programs', 'programme', 'course', 'courses', 'and',
      'the', 'for', 'all', 'other', 'with', 'studies', 'student', 'students',
      'undergraduate', 'postgraduate', 'coursework', 'research', 'entry', 'level',
      'primary', 'secondary', 'general', 'faculty', 'school',
    ]);
    return [...new Set(lower.split(/[^a-z]+/))]
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
      .slice(0, 4);
  }

  /**
   * Extracting a band and being able to use it are different things, and saying
   * "3 bands" then "no requirements found" in the same run is just confusing.
   * A band stages nothing when the institution already has a human-reviewed
   * policy (never overwritten), when the page gave no IELTS overall (the
   * catalogue's canonical bar), or when its label matched no course.
   */
  private stagedSummary(staged: number, extracted: number): string {
    if (staged > 0) return `staged ${staged} proposal(s)`;
    if (extracted === 0) return 'nothing usable';
    return 'staged nothing (reviewed policy already on file, no IELTS overall stated, or no course matched the labels)';
  }

  private describeBand(b: ExtractedBand): string {
    const parts: string[] = [];
    if (b.min_ielts_overall != null) parts.push(`IELTS ${b.min_ielts_overall}`);
    if (b.min_ielts_band != null) parts.push(`no band < ${b.min_ielts_band}`);
    if (b.min_pte_overall != null) parts.push(`PTE ${b.min_pte_overall}`);
    if (b.min_toefl_overall != null) parts.push(`TOEFL ${b.min_toefl_overall}`);
    return parts.join(', ') || 'no numeric band';
  }

  /**
   * Turns an observed failure into a standing reason. A 403 or a robots.txt
   * disallow is deterministic — it will happen again — so it blocks on first
   * sight. A bare timeout might be transient, so it only blocks after repeated
   * failures.
   */
  private classifyFailure(detail: string): AutoSourceReason {
    if (/403/.test(detail)) return 'anti_bot';
    if (/robots\.txt/i.test(detail)) return 'robots_disallow';
    if (/no candidates|yielded 0|too little extractable text/i.test(detail)) return 'client_rendered';
    return 'unreachable';
  }

  private async markAutoSource(
    uni: University,
    status: 'ok' | 'blocked',
    reason: AutoSourceReason | null,
    note: string,
  ): Promise<void> {
    if (status === 'ok') {
      await this.universities.update(uni.id, {
        auto_source_status: 'ok',
        auto_source_reason: null,
        auto_source_note: '',
        auto_source_checked_at: new Date(),
        auto_source_failures: 0,
      });
      return;
    }

    const failures = (uni.auto_source_failures ?? 0) + 1;
    // 'unreachable' could be a blip; everything else is a property of the site.
    const definitive = reason !== 'unreachable';
    await this.universities.update(uni.id, {
      auto_source_status: definitive || failures >= 3 ? 'blocked' : 'unknown',
      auto_source_reason: reason,
      auto_source_note: note.slice(0, 500),
      auto_source_checked_at: new Date(),
      auto_source_failures: failures,
    });
  }

  private async noteFailure(uni: University, reason: string): Promise<void> {
    const url = this.fetcher.normaliseUrl(uni.website);
    if (!url) return;
    const existing = await this.sources.findOne({ where: { url } });
    await this.sources.save({
      ...(existing ?? {}),
      url,
      domain: this.hostOf(url),
      trust_tier: this.fetcher.trustTierFor(url),
      data_kinds: [],
      entity_type: 'university' as const,
      entity_id: uni.id,
      last_fetched_at: new Date(),
      fetch_status: 'fetch_error' as const,
      notes: reason.slice(0, 500),
    });
  }

  private hostOf(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  private slug(name: string): string {
    return name
      .toLowerCase()
      .replace(/\([^)]*\)/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }
}
