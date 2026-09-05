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

  private clean(html: string): { title: string; text: string } {
    const $ = cheerio.load(html);
    $('script, style, nav, header, footer, noscript, svg, form, iframe').remove();
    const title = $('title').first().text().trim() || $('h1').first().text().trim();
    const text = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .replace(/(\s\.){2,}/g, '')
      .trim();
    return { title, text };
  }

  private chunkText(text: string): string[] {
    if (text.length <= CHUNK_CHARS) return text ? [text] : [];
    const out: string[] = [];
    let i = 0;
    while (i < text.length) {
      out.push(text.slice(i, i + CHUNK_CHARS));
      i += CHUNK_CHARS - CHUNK_OVERLAP;
    }
    return out;
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

      const existing = await this.docs.findOne({ where: { source_url: sourceUrl } });
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
      return { url: sourceUrl, ok: true, chunks: rows.length };
    } catch (e) {
      return { url: sourceUrl, ok: false, reason: (e as Error).message };
    }
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
