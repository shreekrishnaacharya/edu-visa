import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { TrustTier } from './entities/source-page.entity';
import { HEADING_MARK } from '../knowledge/ingestion.service';

const USER_AGENT =
  'EduVisaKnowledgeBot/1.0 (+internal research tool; respects robots.txt)';

/** Cap on cleaned text kept per page — enough for a requirements table, bounded for the LLM. */
const MAX_TEXT = 60_000;

export interface FetchOk {
  ok: true;
  url: string;
  /** Final URL after redirects — what actually got read. */
  finalUrl: string;
  status: number;
  title: string;
  text: string;
  html: string;
  contentHash: string;
  links: { href: string; text: string }[];
}

export interface FetchFail {
  ok: false;
  url: string;
  status: number | null;
  reason: string;
  robotsBlocked?: boolean;
}

export type FetchResult = FetchOk | FetchFail;

/**
 * Fetches institution pages for requirement sourcing.
 *
 * Deliberately separate from `knowledge/web-fetch.service.ts`, which is the
 * orchestrator's live-answer fallback and is locked to a fixed government
 * allowlist on purpose. This one has a different job — reading a specific
 * provider's own site, whose domain comes from the government register — so it
 * takes the permitted host per call instead of a global allowlist, and adds the
 * SSRF guard and content hashing that a write-back pipeline needs.
 */
@Injectable()
export class SiteFetchService {
  private readonly log = new Logger(SiteFetchService.name);
  private readonly robotsCache = new Map<string, string[]>();
  private readonly lastHitByHost = new Map<string, number>();

  /** Normalises a register `Website` value, which is often bare ("www.mq.edu.au"). */
  normaliseUrl(raw: string | null | undefined): string | null {
    const s = String(raw ?? '').trim();
    if (!s) return null;
    const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    try {
      const u = new URL(withScheme);
      if (!['http:', 'https:'].includes(u.protocol)) return null;
      return u.toString();
    } catch {
      return null;
    }
  }

  /** `sub.example.edu.au` counts as inside `example.edu.au`. */
  isSameSite(url: string, rootHost: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      const root = rootHost.toLowerCase().replace(/^www\./, '');
      return host === root || host.endsWith(`.${root}`);
    } catch {
      return false;
    }
  }

  trustTierFor(url: string): TrustTier {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.endsWith('.gov.au') || host.endsWith('.gov')) return 'authoritative';
      if (host.endsWith('.edu.au') || host.endsWith('.edu') || host.endsWith('.ac.uk')) {
        return 'reliable';
      }
      return 'unverified';
    } catch {
      return 'unverified';
    }
  }

  /**
   * Refuses anything that resolves to a non-public address. The scraper follows
   * links off pages we don't control, and Phase 3 lets a user paste any URL, so
   * without this the server could be pointed at cloud metadata endpoints or
   * internal services.
   */
  private async assertPublicHost(url: string): Promise<string | null> {
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return 'malformed URL';
    }
    const addresses: string[] = [];
    if (isIP(host)) {
      addresses.push(host);
    } else {
      try {
        const records = await lookup(host, { all: true });
        addresses.push(...records.map((r) => r.address));
      } catch {
        return 'DNS lookup failed';
      }
    }
    if (!addresses.length) return 'host did not resolve';
    for (const addr of addresses) {
      if (this.isPrivateAddress(addr)) return `host resolves to a non-public address (${addr})`;
    }
    return null;
  }

  private isPrivateAddress(addr: string): boolean {
    if (addr.includes(':')) {
      const v6 = addr.toLowerCase();
      // loopback, link-local, unique-local, unspecified
      if (v6 === '::1' || v6 === '::') return true;
      if (v6.startsWith('fe80') || v6.startsWith('fc') || v6.startsWith('fd')) return true;
      // IPv4-mapped (::ffff:10.0.0.1)
      const mapped = v6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
      if (mapped) return this.isPrivateAddress(mapped[1]);
      return false;
    }
    const p = addr.split('.').map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
    const [a, b] = p;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  async allowedByRobots(url: string): Promise<boolean> {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return false;
    }
    if (!this.robotsCache.has(u.origin)) {
      const disallow: string[] = [];
      try {
        const { data } = await axios.get(`${u.origin}/robots.txt`, {
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
        // No robots.txt, or unreachable — treat as unrestricted, same as
        // knowledge/ingestion.service.ts.
      }
      this.robotsCache.set(u.origin, disallow);
    }
    return !this.robotsCache.get(u.origin)!.some((p) => u.pathname.startsWith(p));
  }

  /** One request per host per `minGapMs`, so a 600-page crawl stays polite. */
  private async throttle(host: string, minGapMs = 1200): Promise<void> {
    const last = this.lastHitByHost.get(host) ?? 0;
    const wait = last + minGapMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastHitByHost.set(host, Date.now());
  }

  async fetch(url: string): Promise<FetchResult> {
    const normalised = this.normaliseUrl(url);
    if (!normalised) return { ok: false, url, status: null, reason: 'malformed or unsupported URL' };

    const unsafe = await this.assertPublicHost(normalised);
    if (unsafe) return { ok: false, url: normalised, status: null, reason: unsafe };

    if (!(await this.allowedByRobots(normalised))) {
      return {
        ok: false,
        url: normalised,
        status: null,
        reason: 'disallowed by robots.txt',
        robotsBlocked: true,
      };
    }

    try {
      await this.throttle(new URL(normalised).hostname);
      const res = await axios.get(normalised, {
        timeout: 20_000,
        maxRedirects: 5,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        validateStatus: () => true,
        responseType: 'text',
        maxContentLength: 8 * 1024 * 1024,
      });
      if (res.status >= 400) {
        return {
          ok: false,
          url: normalised,
          status: res.status,
          reason:
            res.status === 403
              ? 'HTTP 403 — blocked by anti-bot protection (not bypassed)'
              : `HTTP ${res.status}`,
        };
      }
      const html = String(res.data ?? '');
      const finalUrl = (res.request?.res?.responseUrl as string) || normalised;
      const { title, text, links } = this.clean(html, finalUrl);
      if (text.length < 200) {
        return {
          ok: false,
          url: normalised,
          status: res.status,
          reason: 'too little extractable text (likely JS-rendered)',
        };
      }
      return {
        ok: true,
        url: normalised,
        finalUrl,
        status: res.status,
        title,
        text: text.slice(0, MAX_TEXT),
        html,
        contentHash: createHash('sha256').update(text).digest('hex').slice(0, 32),
        links,
      };
    } catch (e) {
      return { ok: false, url: normalised, status: null, reason: (e as Error).message };
    }
  }

  /**
   * Strips chrome and flattens tables. Requirement pages are almost always
   * tables, and cheerio's `.text()` runs cells together ("IELTS6.5"), so cells
   * are joined with a separator before the whitespace collapse.
   */
  private clean(html: string, baseUrl: string): { title: string; text: string; links: { href: string; text: string }[] } {
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, iframe, form').remove();

    const links: { href: string; text: string }[] = [];
    $('a[href]').each((_, el) => {
      const raw = $(el).attr('href') ?? '';
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!raw || raw.startsWith('#') || /^(mailto|tel|javascript):/i.test(raw)) return;
      try {
        links.push({ href: new URL(raw, baseUrl).toString(), text });
      } catch {
        /* skip unparseable href */
      }
    });

    // Mark real headings before flattening. A requirements page usually shows
    // one table per test (IELTS, TOEFL, PTE, Cambridge) with identical faculty
    // rows, so a chunk that loses its heading becomes genuinely ambiguous —
    // that is how an IELTS question once got answered with a Cambridge score.
    $('h1, h2, h3, h4, h5, caption, legend, summary, strong, b').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      // Only short, label-like text — not a bolded sentence inside a paragraph.
      if (t && t.length <= 90) $(el).replaceWith(`\n${HEADING_MARK}${t}\n`);
    });
    $('td, th').each((_, el) => {
      $(el).append(' | ');
    });
    $('tr, p, li, br, div').each((_, el) => {
      $(el).append('\n');
    });

    $('nav, header, footer').remove();
    const title = $('title').first().text().trim() || $('h1').first().text().trim();
    const text = $('body')
      .text()
      .replace(/[ \t ]+/g, ' ')
      .replace(/ *\n+ */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { title, text, links };
  }
}
