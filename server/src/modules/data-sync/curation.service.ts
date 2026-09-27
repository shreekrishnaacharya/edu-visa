import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { University } from '../university/university.entity';
import { Course } from '../course/course.entity';
import { AdmissionPolicyEntity } from '../admission/admission-policy.entity';
import { OpenRouterService } from '../knowledge/openrouter.service';
import { IngestionService } from '../knowledge/ingestion.service';
import { StorageService } from '../../common/storage/storage.service';
import { pdfToPageImages } from '../../common/utils/pdf-to-images.util';
import { CurationSession } from './entities/curation-session.entity';
import {
  CurationAttachment,
  CurationMessage,
  ProposedChange,
} from './entities/curation-message.entity';
import { SyncRun } from './entities/sync-run.entity';
import { SyncChange } from './entities/sync-change.entity';
import { SourcePage } from './entities/source-page.entity';
import { SiteFetchService } from './site-fetch.service';

/** Per-attachment text budget, so one huge PDF can't crowd out the instruction. */
const PER_SOURCE_CHARS = 18_000;
const TOTAL_SOURCE_CHARS = 40_000;

/**
 * Fields the curator is allowed to propose. Anything the model names outside
 * this list is discarded — without it, a single confused reply could propose
 * edits to ids, provenance columns or `data_confidence` and quietly launder
 * unverified data into the verified catalogue.
 */
const EDITABLE_FIELDS: Record<string, string[]> = {
  university: ['city', 'website', 'world_rank', 'institution_type', 'student_capacity', 'address'],
  course: [
    'entry.min_english_band',
    'entry.min_gpa',
    'entry.work_experience_months',
    'entry.prerequisites',
    'tuition_fee',
    'duration_months',
    'intakes',
    'next_intake_date',
    'application_deadline',
    'career_outcomes',
  ],
  admission_policy: ['academics', 'sponsors', 'income_thresholds', 'scholarships', 'gs_notes', 'other_notes'],
};

const SYSTEM = `You help a study-abroad consultancy keep its Australian course catalogue accurate.

You are given: the CURRENT stored values for one record, and SOURCE MATERIAL the user supplied (web pages and/or uploaded documents), plus their instruction.

Propose changes to the stored record so it matches the source material. Return ONLY a JSON object:
{
  "reply": string,
  "proposals": [
    { "field": string, "after": <value>, "quote": string, "cited": string, "confidence": number }
  ]
}

RULES:
1. Propose a field ONLY if the source material states it. Never use your own knowledge of the institution. If the material doesn't cover a field, leave it out.
2. "quote" must be copied verbatim from the source material. If you cannot quote it, do not propose it.
3. "cited" must be the exact label of the source it came from, as listed in SOURCE MATERIAL.
4. Use the exact field names from the EDITABLE FIELDS list. Do not invent fields.
5. If the stored value already matches the source, do not propose it.
6. You CANNOT change any data. You only propose; a human reviews and applies. Never write "I have updated", "I have set" or "done" — say what you are PROPOSING. Describe each proposal in terms of the exact field names below.
7. "reply" is a short plain-language summary for the counsellor: what the material says, what you are proposing, and anything it was unclear about. Say explicitly if the material did not support a change they asked for.
8. If the material supports no change at all, return "proposals": [] and say so in "reply".
9. IELTS overall scores are 4.0-9.0; PTE 10-90. A number outside a test's range is a misread — leave it out.
10. entry.min_english_band is a SINGLE NUMBER: the IELTS overall score (e.g. 7.0). It is the catalogue's canonical English bar. Do not put an object, a string, or a per-test breakdown in it — propose the IELTS overall number alone.
11. entry.min_gpa is a single number on a 0-100 scale. entry.prerequisites and career_outcomes are arrays of short strings. intakes is an array like ["Feb","Jul"].`;

@Injectable()
export class CurationService {
  private readonly log = new Logger(CurationService.name);

  constructor(
    @InjectRepository(CurationSession) private readonly sessions: Repository<CurationSession>,
    @InjectRepository(CurationMessage) private readonly messages: Repository<CurationMessage>,
    @InjectRepository(SyncRun) private readonly runs: Repository<SyncRun>,
    @InjectRepository(SyncChange) private readonly changes: Repository<SyncChange>,
    @InjectRepository(SourcePage) private readonly sources: Repository<SourcePage>,
    @InjectRepository(University) private readonly universities: Repository<University>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(AdmissionPolicyEntity)
    private readonly policies: Repository<AdmissionPolicyEntity>,
    private readonly openrouter: OpenRouterService,
    private readonly ingestion: IngestionService,
    private readonly storage: StorageService,
    private readonly fetcher: SiteFetchService,
  ) {}

  async createSession(
    body: { entity_type?: CurationSession['entity_type']; entity_id?: string; title?: string },
    userId: string | null,
  ): Promise<CurationSession> {
    if (body.entity_type && !body.entity_id) {
      throw new BadRequestException('entity_id is required when entity_type is given');
    }
    const title = body.title || (await this.deriveTitle(body.entity_type ?? null, body.entity_id ?? null));
    return this.sessions.save(
      this.sessions.create({
        title,
        entity_type: body.entity_type ?? null,
        entity_id: body.entity_id ?? null,
        created_by: userId,
      }),
    );
  }

  async listSessions(entityId?: string): Promise<CurationSession[]> {
    return this.sessions.find({
      where: entityId ? { entity_id: entityId } : {},
      order: { updated_at: 'DESC' },
      take: 50,
    });
  }

  async getSession(id: string) {
    const session = await this.sessions.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Curation session not found');
    const messages = await this.messages.find({
      where: { session_id: id },
      order: { created_at: 'ASC' },
    });
    return { session, messages, subject: await this.loadSubject(session) };
  }

  /**
   * One conversational turn: read whatever the user supplied, ask the model for a
   * patch against the record's current values, and stage what survives
   * validation.
   *
   * Deliberately a single structured call rather than an agent loop.
   * `orchestrator.service.ts` documents that the configured chat model is
   * unreliable at tool-calling, so the tool use here is the app's: it resolves
   * URLs and files itself and hands the model text. Nothing is applied — every
   * surviving proposal becomes a `sync_change` the user accepts or rejects.
   */
  async sendMessage(
    sessionId: string,
    input: { content: string; urls?: string[]; files?: Express.Multer.File[] },
    userId: string | null,
  ) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Curation session not found');
    if (session.status === 'closed') throw new BadRequestException('This session is closed');

    const { attachments, material } = await this.gather(session, input.urls ?? [], input.files ?? []);

    const userMessage = await this.messages.save(
      this.messages.create({
        session_id: sessionId,
        role: 'user',
        content: input.content ?? '',
        attachments,
        proposals: [],
      }),
    );

    if (!material.length && !input.content?.trim()) {
      throw new BadRequestException('Nothing to work from — add an instruction, a URL or a file');
    }

    const subject = await this.loadSubject(session);
    const history = await this.messages.find({
      where: { session_id: sessionId },
      order: { created_at: 'ASC' },
      take: 12,
    });

    const { reply, proposals, dropped } = await this.ask(session, subject, material, input.content, history);
    const staged = proposals.length ? await this.stage(session, proposals, userId) : [];

    const assistantMessage = await this.messages.save(
      this.messages.create({
        session_id: sessionId,
        role: 'assistant',
        // The model has been seen to claim "I have updated the requirements"
        // when nothing was staged at all. What was actually staged is a fact the
        // app knows and the model doesn't, so the app states it — and says why
        // anything was rejected, rather than leaving a false claim standing.
        content: `${reply}\n\n${this.outcomeLine(staged.length, dropped)}`,
        attachments: [],
        proposals: staged,
      }),
    );

    await this.sessions.update(sessionId, { updated_at: new Date() } as QueryDeepPartialEntity<CurationSession>);
    return { user_message: userMessage, assistant_message: assistantMessage };
  }

  /** The authoritative account of what this turn did, written by the app. */
  private outcomeLine(stagedCount: number, dropped: string[]): string {
    const lines: string[] = [];
    lines.push(
      stagedCount > 0
        ? `— Staged ${stagedCount} proposed change${stagedCount === 1 ? '' : 's'} for your review. Nothing has been written to the catalogue yet.`
        : `— No changes were staged. Nothing in the catalogue has been modified.`,
    );
    if (dropped.length) {
      lines.push(`Rejected before staging: ${dropped.slice(0, 6).join('; ')}.`);
    }
    return lines.join('\n');
  }

  /**
   * Resolves URLs and files into plain text. A user pasting a URL is the
   * authorisation to fetch it, but the SSRF guard and robots.txt check in
   * SiteFetchService still apply, and the domain's trust tier is recorded so an
   * aggregator is never mistaken for an official source.
   */
  private async gather(
    session: CurationSession,
    urls: string[],
    files: Express.Multer.File[],
  ): Promise<{ attachments: CurationAttachment[]; material: { label: string; text: string }[] }> {
    const attachments: CurationAttachment[] = [];
    const material: { label: string; text: string }[] = [];
    let budget = TOTAL_SOURCE_CHARS;

    for (const raw of urls.slice(0, 5)) {
      const page = await this.fetcher.fetch(raw);
      if (!page.ok) {
        attachments.push({ kind: 'url', label: raw, url: raw, status: 'failed', reason: page.reason });
        continue;
      }
      const text = page.text.slice(0, Math.min(PER_SOURCE_CHARS, budget));
      budget -= text.length;
      const source = await this.recordSource(session, page.finalUrl, page.title, page.contentHash, page.status);

      attachments.push({
        kind: 'url',
        label: page.finalUrl,
        url: page.finalUrl,
        status: 'read',
        chars: text.length,
        source_page_id: source.id,
      });
      material.push({ label: page.finalUrl, text });

      // Also into the RAG corpus, so the AI can cite this page in student-facing
      // answers later rather than only using it for this one edit.
      await this.ingestion.ingestText(page.finalUrl, page.text, {
        title: page.title || page.finalUrl,
        doc_type: 'entry_requirement',
        country: 'AU',
        institution: session.entity_type === 'university' ? (await this.loadSubject(session))?.name ?? null : null,
        publisher: new URL(page.finalUrl).hostname,
        effective_date: new Date().toISOString().slice(0, 10),
      });
    }

    for (const file of files.slice(0, 5)) {
      try {
        const text = await this.readFile(file);
        if (!text.trim()) throw new Error('no text could be extracted');
        const clipped = text.slice(0, Math.min(PER_SOURCE_CHARS, budget));
        budget -= clipped.length;
        // Keep the original, so a bad extraction can be revisited rather than
        // silently standing as the only record of what was uploaded.
        const key = `curation/${session.id}/${Date.now()}-${file.originalname}`;
        await this.storage.put(key, file.buffer, file.mimetype || 'application/octet-stream');

        attachments.push({
          kind: 'file',
          label: file.originalname,
          file: { key, name: file.originalname, mime: file.mimetype, size: file.size } as any,
          status: 'read',
          chars: clipped.length,
        });
        material.push({ label: file.originalname, text: clipped });
      } catch (e) {
        attachments.push({
          kind: 'file',
          label: file.originalname,
          status: 'failed',
          reason: (e as Error).message,
        });
      }
    }

    return { attachments, material };
  }

  /** PDFs go through the same vision OCR path as uploaded university documents. */
  private async readFile(file: Express.Multer.File): Promise<string> {
    const mime = file.mimetype ?? '';
    if (mime === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      const pages = await pdfToPageImages(file.buffer);
      if (!pages.length) throw new Error('PDF produced no pages');
      return this.openrouter.visionExtractText(
        pages,
        'Transcribe this document as plain text. Preserve tables row by row, including every number and its column heading.',
      );
    }
    if (mime.startsWith('image/')) {
      return this.openrouter.visionExtractText(
        [{ mime, base64: file.buffer.toString('base64') } as any],
        'Transcribe this image as plain text, preserving any table structure and all numbers.',
      );
    }
    // csv / txt / md / html and anything else textual
    return file.buffer.toString('utf8');
  }

  private async recordSource(
    session: CurationSession,
    url: string,
    title: string,
    hash: string,
    status: number,
  ): Promise<SourcePage> {
    const existing = await this.sources.findOne({ where: { url } });
    return this.sources.save({
      ...(existing ?? {}),
      url,
      domain: new URL(url).hostname,
      trust_tier: this.fetcher.trustTierFor(url),
      data_kinds: existing?.data_kinds?.length ? existing.data_kinds : ['other'],
      description: existing?.description || title || '',
      entity_type: session.entity_type,
      entity_id: session.entity_id,
      last_fetched_at: new Date(),
      last_changed_at: existing?.content_hash === hash ? existing.last_changed_at : new Date(),
      content_hash: hash,
      http_status: status,
      fetch_status: 'ok' as const,
      robots_allowed: true,
      // A human deliberately supplied this URL, which is a stronger signal than
      // anything discovery infers.
      verified_at: new Date(),
      verified_by: session.created_by,
    });
  }

  private async ask(
    session: CurationSession,
    subject: any,
    material: { label: string; text: string }[],
    instruction: string,
    history: CurationMessage[],
  ): Promise<{ reply: string; proposals: ProposedChange[]; dropped: string[] }> {
    const kind = session.entity_type ?? 'university';
    const fields = EDITABLE_FIELDS[kind] ?? [];

    const materialBlock = material.length
      ? material.map((m) => `--- SOURCE: ${m.label} ---\n${m.text}`).join('\n\n')
      : '(no new source material supplied this turn)';

    const priorTurns = history
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'Counsellor' : 'You'}: ${m.content}`)
      .join('\n');

    let raw: string;
    try {
      raw = await this.openrouter.chat(
        [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content:
              `RECORD TYPE: ${kind}\n` +
              `EDITABLE FIELDS: ${fields.join(', ')}\n\n` +
              `CURRENT STORED VALUES:\n${JSON.stringify(this.summariseSubject(kind, subject), null, 2)}\n\n` +
              `SOURCE MATERIAL:\n${materialBlock}\n\n` +
              (priorTurns ? `CONVERSATION SO FAR:\n${priorTurns}\n\n` : '') +
              `COUNSELLOR'S INSTRUCTION: ${instruction || '(none — use the material)'}`,
          },
        ],
        { temperature: 0, maxTokens: 1800 },
      );
    } catch (e) {
      return {
        reply: `I could not complete that: ${(e as Error).message}`,
        proposals: [],
        dropped: [],
      };
    }

    const parsed = this.parseJson(raw);
    if (!parsed) {
      // Don't invent a patch from unparseable output; show the prose instead.
      return { reply: raw.slice(0, 2000), proposals: [], dropped: [] };
    }
    const { kept, dropped } = this.validate(parsed.proposals, kind, subject, material);
    return {
      reply: typeof parsed.reply === 'string' ? parsed.reply : 'Here is what I found.',
      proposals: kept,
      dropped,
    };
  }

  /**
   * Keeps only proposals the supplied material actually supports: a known field,
   * a quote that really appears in the material, a citation naming a real
   * attachment, and a value that differs from what's stored.
   */
  private validate(
    rawProposals: unknown,
    kind: string,
    subject: any,
    material: { label: string; text: string }[],
  ): { kept: ProposedChange[]; dropped: string[] } {
    const dropped: string[] = [];
    if (!Array.isArray(rawProposals)) return { kept: [], dropped };
    const allowed = new Set(EDITABLE_FIELDS[kind] ?? []);
    const haystacks = new Map(material.map((m) => [m.label, this.normalise(m.text)]));
    const all = [...haystacks.values()].join(' ');
    const out: ProposedChange[] = [];

    for (const p of rawProposals.slice(0, 25)) {
      const field = typeof p?.field === 'string' ? p.field.trim() : '';
      if (!allowed.has(field)) {
        dropped.push(`"${field || '(unnamed)'}" is not an editable field on this record`);
        continue;
      }

      const quote = typeof p?.quote === 'string' ? p.quote.trim() : '';
      if (!quote || !this.quoteAppears(quote, all)) {
        dropped.push(`${field}: its supporting quote is not in the supplied material`);
        continue;
      }

      const after = p?.after;
      if (after === undefined) {
        dropped.push(`${field}: no value given`);
        continue;
      }
      if (!this.valueSane(field, after)) {
        dropped.push(`${field}: ${JSON.stringify(after)} is not a valid value for this field`);
        continue;
      }

      const before = this.currentValue(subject, field);
      if (JSON.stringify(before) === JSON.stringify(after)) {
        dropped.push(`${field}: already stored as ${JSON.stringify(before)}`);
        continue;
      }

      const cited =
        typeof p?.cited === 'string' && haystacks.has(p.cited)
          ? p.cited
          : (material.find((m) => haystacks.get(m.label)!.includes(this.normalise(quote)))?.label ??
            material[0]?.label ??
            'supplied material');

      out.push({
        entity_type: kind as ProposedChange['entity_type'],
        entity_id: subject?.id ?? subject?.key ?? null,
        label: subject?.name ?? subject?.title ?? subject?.institution ?? 'record',
        field,
        before,
        after,
        quote: quote.slice(0, 400),
        cited,
        confidence:
          typeof p?.confidence === 'number' && p.confidence >= 0 && p.confidence <= 1
            ? p.confidence
            : 0.5,
      });
    }
    return { kept: out, dropped };
  }

  /** Range checks for the fields where a misread has real consequences. */
  private valueSane(field: string, value: unknown): boolean {
    if (field === 'entry.min_english_band') {
      return typeof value === 'number' && value >= 4 && value <= 9;
    }
    if (field === 'entry.min_gpa') {
      return typeof value === 'number' && value >= 0 && value <= 100;
    }
    if (field === 'tuition_fee') {
      return typeof value === 'number' && value >= 1000 && value <= 200_000;
    }
    if (field === 'duration_months') {
      return typeof value === 'number' && value >= 1 && value <= 120;
    }
    if (field === 'world_rank') {
      return typeof value === 'number' && value >= 1 && value <= 2000;
    }
    return value !== null || field.startsWith('entry.');
  }

  private async stage(
    session: CurationSession,
    proposals: ProposedChange[],
    userId: string | null,
  ): Promise<ProposedChange[]> {
    // One run per session, created lazily so an exploratory chat that proposes
    // nothing doesn't litter the run history.
    let runId = session.sync_run_id;
    if (!runId) {
      const run = await this.runs.save(
        this.runs.create({
          kind: 'ai_curation',
          status: 'awaiting_review',
          params: { curation_session_id: session.id, title: session.title },
          created_by: userId,
          started_at: new Date(),
        }),
      );
      runId = run.id;
      await this.sessions.update(session.id, { sync_run_id: runId });
      session.sync_run_id = runId;
    }

    const out: ProposedChange[] = [];
    for (const p of proposals) {
      const row: Partial<SyncChange> = {
        sync_run_id: runId,
        entity_type: p.entity_type,
        entity_id: p.entity_id,
        natural_key: null,
        label: `${p.label} — ${p.field}`,
        change_type: p.entity_id ? 'update' : 'create',
        field_diffs: [{ field: p.field, before: p.before, after: p.after }],
        payload: {
          kind: 'curation_patch',
          field: p.field,
          value: p.after,
          quote: p.quote,
          cited: p.cited,
          curation_session_id: session.id,
        },
        auto_applied: false,
        decision: 'pending',
        confidence: p.confidence,
      };
      const saved = await this.changes.save(row as QueryDeepPartialEntity<SyncChange> as SyncChange);
      out.push({ ...p, sync_change_id: (saved as SyncChange).id });
    }

    const pending = await this.changes.count({ where: { sync_run_id: runId, decision: 'pending' } });
    await this.runs.update(runId, {
      status: 'awaiting_review',
      totals: { step: 'awaiting review', created: pending },
    });
    return out;
  }

  private async loadSubject(session: CurationSession): Promise<any> {
    if (!session.entity_type || !session.entity_id) return null;
    if (session.entity_type === 'university') {
      return this.universities.findOne({ where: { id: session.entity_id } });
    }
    if (session.entity_type === 'course') {
      return this.courses.findOne({ where: { id: session.entity_id } });
    }
    return this.policies.findOne({ where: { key: session.entity_id } });
  }

  /** Only the fields the model may edit, so it isn't tempted by ids or provenance. */
  private summariseSubject(kind: string, subject: any): Record<string, unknown> {
    if (!subject) return {};
    const out: Record<string, unknown> = {};
    if (kind === 'university') out.name = subject.name;
    if (kind === 'course') {
      out.title = subject.title;
      out.university_name = subject.university_name;
      out.degree_level = subject.degree_level;
    }
    if (kind === 'admission_policy') out.institution = subject.institution;
    for (const field of EDITABLE_FIELDS[kind] ?? []) {
      out[field] = this.currentValue(subject, field);
    }
    return out;
  }

  private currentValue(subject: any, field: string): unknown {
    if (!subject) return null;
    // admission_policy keeps everything inside its `data` jsonb blob.
    const root = subject.data && !('entry' in subject) ? subject.data : subject;
    return field.split('.').reduce((acc: any, key) => (acc == null ? undefined : acc[key]), root) ?? null;
  }

  private async deriveTitle(
    entityType: CurationSession['entity_type'],
    entityId: string | null,
  ): Promise<string> {
    if (!entityType || !entityId) return 'Data curation';
    const subject = await this.loadSubject({ entity_type: entityType, entity_id: entityId } as CurationSession);
    return subject?.name ?? subject?.title ?? subject?.institution ?? 'Data curation';
  }

  private parseJson(raw: string): Record<string, any> | null {
    const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      const obj = JSON.parse(cleaned.slice(start, end + 1));
      return obj && typeof obj === 'object' ? obj : null;
    } catch {
      return null;
    }
  }

  private normalise(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private quoteAppears(quote: string, haystack: string): boolean {
    const q = this.normalise(quote);
    if (q.length < 8) return false;
    if (haystack.includes(q)) return true;
    const numbers = q.match(/\d+(?:\.\d+)?/g) ?? [];
    if (!numbers.length) return false;
    return numbers.every((n) => haystack.includes(n));
  }
}
