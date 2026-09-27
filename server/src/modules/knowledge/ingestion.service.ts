import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as pgvector from 'pgvector';
import { Doc, DocType } from './doc.entity';
import { DocChunk } from './doc-chunk.entity';
import { OpenRouterService } from './openrouter.service';

const USER_AGENT = 'EduVisaKnowledgeBot/1.0 (+internal research tool; respects robots.txt)';
const CHUNK_CHARS = 3000; // ~700-800 tokens
const CHUNK_OVERLAP = 450; // ~15%
/**
 * Sentinel written by whichever cleaner produced the text, so `chunkText` can
 * find DOM-real headings. Exported because `data-sync/site-fetch.service.ts`
 * cleans scraped pages itself and feeds them to `ingestText`, bypassing
 * `clean()` here — both must mark headings the same way or the chunker sees none.
 */
export const HEADING_MARK = '§ ';

export interface IngestMeta {
  title: string;
  doc_type: DocType;
  country: string;
  institution?: string | null;
  publisher: string;
  effective_date?: string | null;
  review_by?: string | null;
}

export interface IngestOutcome {
  url: string;
  ok: boolean;
  reason?: string;
  chunks?: number;
  docId?: string;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly robotsCache = new Map<string, string[]>(); // origin -> disallowed prefixes

  constructor(
    @InjectRepository(Doc) private readonly docs: Repository<Doc>,
    @InjectRepository(DocChunk) private readonly chunks: Repository<DocChunk>,
    private readonly openrouter: OpenRouterService,
  ) {}

  private async allowedByRobots(url: string): Promise<boolean> {
    const u = new URL(url);
    const origin = u.origin;
    if (!this.robotsCache.has(origin)) {
      let disallow: string[] = [];
      try {
        const { data } = await axios.get(`${origin}/robots.txt`, {
          timeout: 8000,
          headers: { 'User-Agent': USER_AGENT },
          validateStatus: () => true,
        });
        if (typeof data === 'string') {
          let applies = false;
          for (const line of data.split('\n')) {
            const l = line.trim();
            if (/^user-agent:\s*\*/i.test(l)) applies = true;
            else if (/^user-agent:/i.test(l)) applies = false;
            else if (applies && /^disallow:/i.test(l)) {
              const path = l.split(':').slice(1).join(':').trim();
              if (path) disallow.push(path);
            }
          }
        }
      } catch {
        // no robots.txt / unreachable -> treat as unrestricted
      }
      this.robotsCache.set(origin, disallow);
    }
    const disallowed = this.robotsCache.get(origin)!;
    return !disallowed.some((p) => u.pathname.startsWith(p));
  }

  /**
   * Keeps block structure instead of flattening the page to one line.
   *
   * Collapsing all whitespace destroyed two things that matter downstream:
   * headings (so `chunkText` can say which section a chunk came from) and table
   * cell boundaries (so "IELTS 6.5" doesn't become "IELTS6.5" or run into the
   * next cell). Requirements pages are almost entirely tables, so this is the
   * difference between a retrievable figure and an unreadable one.
   */
  private clean(html: string): { title: string; text: string } {
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, form, iframe').remove();
    const title = $('title').first().text().trim() || $('h1').first().text().trim();
    $('td, th').each((_, el) => {
      $(el).append(' | ');
    });
    // Mark real headings from the DOM with a sentinel. Guessing from the text
    // alone cannot work: a table row label ("Bachelor of Social Work") looks
    // exactly like a heading once the tags are gone, so the chunker would carry
    // a row label instead of the section it needs ("Cambridge English").
    $('h1, h2, h3, h4, h5, caption, legend, th[scope="col"]').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t) $(el).replaceWith(`\n${HEADING_MARK}${t}\n`);
    });
    $('tr, p, li, br, div').each((_, el) => {
      $(el).append('\n');
    });
    $('nav, header, footer').remove();
    const text = $('body')
      .text()
      .replace(/[ \t\u00a0]+/g, ' ')
      .replace(/ *\n+ */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/(\s\.){2,}/g, '')
      .trim();
    return { title, text };
  }

  /**
   * Whether this line is a heading the DOM actually marked as one.
   */
  private isHeading(line: string): boolean {
    return line.trimStart().startsWith(HEADING_MARK);
  }

  private headingText(line: string): string {
    return line.trim().slice(HEADING_MARK.length).trim();
  }

  /**
   * Splits on line boundaries and prefixes every chunk after the first with the
   * heading it falls under.
   *
   * A blind character split loses which section a chunk came from, and that is
   * not cosmetic. UNSW's English-requirements page publishes ONE TABLE PER TEST
   * — IELTS, TOEFL, PTE, Cambridge — each with the same faculty rows. Split
   * blindly, the Cambridge table's chunk reads "Law & Justice | 180 overall"
   * with nothing saying it is Cambridge, and the assistant answered an IELTS
   * question with "185 overall" (a Cambridge score; IELTS only goes to 9).
   * Carrying the heading is what makes the retrieved text self-describing.
   */
  private chunkText(text: string): string[] {
    if (!text) return [];
    if (text.length <= CHUNK_CHARS) return [text];

    const lines = text.split('\n');
    const out: string[] = [];
    let buf: string[] = [];
    let bufLen = 0;
    let heading = '';
    let headingForBuf = '';

    const flush = () => {
      if (!buf.length) return;
      const body = buf.join('\n');
      // Don't repeat the heading if the chunk already opens with it.
      const prefix =
        headingForBuf && !body.trimStart().startsWith(headingForBuf) ? `[${headingForBuf}]\n` : '';
      out.push(prefix + body);
      // Overlap: carry the tail of this chunk into the next so a row split
      // across the boundary is still retrievable from one of them.
      const tail = body.slice(-CHUNK_OVERLAP);
      buf = tail ? [tail] : [];
      bufLen = tail.length;
      headingForBuf = heading;
    };

    for (const line of lines) {
      if (this.isHeading(line)) {
        heading = this.headingText(line);
        if (!buf.length) headingForBuf = heading;
      }
      if (!headingForBuf) headingForBuf = heading;

      // A single line longer than a chunk (a whole flattened table) still has to
      // be broken up, but at least it keeps its heading prefix.
      if (line.length > CHUNK_CHARS) {
        flush();
        for (let i = 0; i < line.length; i += CHUNK_CHARS - CHUNK_OVERLAP) {
          const piece = line.slice(i, i + CHUNK_CHARS);
          out.push(headingForBuf ? `[${headingForBuf}]\n${piece}` : piece);
        }
        continue;
      }

      if (bufLen + line.length + 1 > CHUNK_CHARS) flush();
      buf.push(line);
      bufLen += line.length + 1;
    }
    flush();
    return out.filter((c) => c.trim().length > 0);
  }

  /** Fetch, clean, chunk, embed, and upsert one URL. Idempotent (re-ingest replaces). */
  async ingestUrl(url: string, meta: IngestMeta): Promise<IngestOutcome> {
    try {
      if (!(await this.allowedByRobots(url))) {
        return { url, ok: false, reason: 'disallowed by robots.txt' };
      }

      const res = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        validateStatus: () => true,
      });
      if (res.status >= 400) {
        return { url, ok: false, reason: `HTTP ${res.status}${res.status === 403 ? ' (blocked by anti-bot protection — not bypassed)' : ''}` };
      }

      const { title, text } = this.clean(String(res.data));
      if (text.length < 200) {
        return { url, ok: false, reason: 'page had too little extractable text (likely JS-rendered)' };
      }
      return this.ingestText(url, text, { ...meta, title: meta.title || title });
    } catch (e) {
      return { url, ok: false, reason: (e as Error).message };
    }
  }

  /**
   * Same embed-and-store pipeline as `ingestUrl`, for content that's real but
   * wasn't fetched as an HTML page — e.g. a summary computed from an official
   * structured dataset (a government XLSX export). `sourceUrl` still points
   * at the real dataset so every claim stays traceable.
   */
  async ingestText(sourceUrl: string, text: string, meta: IngestMeta): Promise<IngestOutcome> {
    try {
      const pieces = this.chunkText(text);
      if (!pieces.length) return { url: sourceUrl, ok: false, reason: 'no chunks produced' };

      const embeddings = await this.openrouter.embed(pieces);

      // Documents with no public URL (internal PIs, agent-only briefings) all
      // share an empty `source_url` — deduping on that literally would make
      // every such ingest silently delete the PREVIOUS no-URL doc instead of
      // just replacing its own earlier version (found for real: 9 institution
      // briefings ingested in one run left only the last one standing).
      // Dedupe by title instead whenever there's no URL to key on.
      const existing = sourceUrl
        ? await this.docs.findOne({ where: { source_url: sourceUrl } })
        : await this.docs.findOne({ where: { source_url: '', title: meta.title } });
      if (existing) await this.docs.remove(existing);

      const doc = await this.docs.save(
        this.docs.create({
          source_url: sourceUrl,
          title: meta.title,
          doc_type: meta.doc_type,
          country: meta.country,
          institution: meta.institution ?? null,
          publisher: meta.publisher,
          effective_date: meta.effective_date ?? null,
          review_by: meta.review_by ?? null,
        }),
      );

      const rows = pieces.map((p, i) =>
        this.chunks.create({
          doc_id: doc.id,
          chunk_index: i,
          text: p,
          embedding: pgvector.toSql(embeddings[i]),
          country: meta.country,
          doc_type: meta.doc_type,
          institution: meta.institution ?? null,
          effective_date: meta.effective_date ?? null,
          source_url: sourceUrl,
        }),
      );
      await this.chunks.save(rows);

      this.logger.log(`Ingested ${sourceUrl} -> ${rows.length} chunks`);
      return { url: sourceUrl, ok: true, chunks: rows.length, docId: doc.id };
    } catch (e) {
      return { url: sourceUrl, ok: false, reason: (e as Error).message };
    }
  }

  /** Removes a `doc` row; `doc_chunk` rows cascade at the DB FK. */
  async deleteDoc(docId: string): Promise<void> {
    await this.docs.delete(docId);
  }

  async ingestMany(items: { url: string; meta: IngestMeta }[]): Promise<IngestOutcome[]> {
    const out: IngestOutcome[] = [];
    for (const { url, meta } of items) {
      out.push(await this.ingestUrl(url, meta));
      // be a polite, low-rate crawler
      await new Promise((r) => setTimeout(r, 800));
    }
    return out;
  }

  async stats() {
    const docCount = await this.docs.count();
    const chunkCount = await this.chunks.count();
    return { docs: docCount, chunks: chunkCount };
  }
}
