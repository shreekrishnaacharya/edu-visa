import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as pgvector from 'pgvector';
import { DocChunk } from './doc-chunk.entity';
import { DocType } from './doc.entity';
import { OpenRouterService } from './openrouter.service';

export interface RetrievalFilters {
  country?: string;
  doc_type?: DocType;
  institution?: string;
}

export interface RetrievedChunk {
  id: string;
  text: string;
  source_url: string;
  /** The parent doc's human-readable title — the citation label when `source_url` isn't a real link (e.g. an internal document with no public URL). */
  title: string;
  effective_date: string | null;
  doc_type: DocType;
  institution: string | null;
  score: number;
}

const STALE_MS = 1000 * 60 * 60 * 24 * 30 * 18; // 18 months

/**
 * Hybrid retrieval (vector cosine ∪ keyword), metadata pre-filtered — plan
 * appendix B, "Retrieval, in detail". One call = one "pass" (a single
 * concern); MatchAssistantService fires several passes per question.
 */
@Injectable()
export class RetrievalService {
  constructor(
    @InjectRepository(DocChunk) private readonly chunks: Repository<DocChunk>,
    private readonly openrouter: OpenRouterService,
  ) {}

  async retrieve(query: string, filters: RetrievalFilters, k = 5): Promise<RetrievedChunk[]> {
    const [embedding] = await this.openrouter.embed([query]);
    const vec = pgvector.toSql(embedding);

    const where: string[] = [];
    const params: unknown[] = [vec, query];
    if (filters.country) {
      params.push(filters.country);
      where.push(`dc.country = $${params.length}`);
    }
    if (filters.doc_type) {
      params.push(filters.doc_type);
      where.push(`dc.doc_type = $${params.length}`);
    }
    if (filters.institution) {
      params.push(filters.institution);
      where.push(`dc.institution = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Joined to `doc` for `title` — the citation label doc_chunk doesn't
    // carry itself, needed so a source with no public URL (source_url = '')
    // still has a human-readable name to show instead of a broken link.
    const rows: any[] = await this.chunks.query(
      `
      SELECT dc.id, dc.text, dc.source_url, dc.effective_date, dc.doc_type, dc.institution,
             d.title,
             1 - (dc.embedding <=> $1::vector) AS vscore,
             ts_rank(dc.tsv, plainto_tsquery('english', $2)) AS kscore
      FROM doc_chunk dc
      JOIN doc d ON d.id = dc.doc_id
      ${whereSql}
      ORDER BY dc.embedding <=> $1::vector ASC
      LIMIT 20
      `,
      params,
    );

    return rows
      .map((r) => ({
        id: r.id,
        text: r.text,
        source_url: r.source_url,
        title: r.title,
        effective_date: r.effective_date,
        doc_type: r.doc_type,
        institution: r.institution,
        score: Number(r.vscore) * 0.75 + Math.min(1, Number(r.kscore)) * 0.25,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /** True if the best chunk found is older than the freshness threshold (or none exist). */
  isStale(chunks: RetrievedChunk[]): boolean {
    const newest = chunks
      .map((c) => (c.effective_date ? new Date(c.effective_date).getTime() : 0))
      .sort((a, b) => b - a)[0];
    return !newest || Date.now() - newest > STALE_MS;
  }
}
