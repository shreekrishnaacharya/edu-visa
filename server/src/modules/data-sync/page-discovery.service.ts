import { Injectable, Logger } from '@nestjs/common';
import { SiteFetchService } from './site-fetch.service';
import { DataKind } from './entities/source-page.entity';

export interface Candidate {
  url: string;
  /** Why this page was picked — shown to the reviewer, not just used internally. */
  matched: string;
  score: number;
  data_kinds: DataKind[];
}

/**
 * Signals that a page states entry requirements. Ordered by how specific they
 * are: a URL containing "english-language-requirements" is a far stronger
 * signal than one merely mentioning "international".
 */
const PATTERNS: { re: RegExp; score: number; kinds: DataKind[]; label: string }[] = [
  {
    re: /english[-_ ]?(language[-_ ]?)?(requirement|proficiency|entry)/i,
    score: 100,
    kinds: ['english_requirements'],
    label: 'English language requirements',
  },
  {
    re: /(entry|admission|academic)[-_ ]?requirement/i,
    score: 90,
    kinds: ['entry_requirements'],
    label: 'entry requirements',
  },
  {
    re: /minimum[-_ ]?(entry|academic|english)/i,
    score: 85,
    kinds: ['entry_requirements'],
    label: 'minimum entry criteria',
  },
  {
    re: /how[-_ ]?to[-_ ]?apply/i,
    score: 60,
    kinds: ['entry_requirements'],
    label: 'how to apply',
  },
  {
    re: /(country|entry)[-_ ]?equivalen/i,
    score: 70,
    kinds: ['entry_requirements'],
    label: 'country equivalency',
  },
  {
    re: /admission|admissions/i,
    score: 45,
    kinds: ['entry_requirements'],
    label: 'admissions',
  },
  {
    re: /ielts|pte|toefl/i,
    score: 80,
    kinds: ['english_requirements'],
    label: 'named English test',
  },
  {
    re: /international[-_ ]?student/i,
    score: 30,
    kinds: ['entry_requirements'],
    label: 'international students',
  },
];

/** Obvious dead ends — cheap to exclude, expensive to crawl. */
const REJECT = /\.(pdf|docx?|xlsx?|zip|jpe?g|png|gif|mp4)$|\/(news|events|blog|alumni|library|research|staff|contact|privacy|login|search)(\/|$)/i;

@Injectable()
export class PageDiscoveryService {
  private readonly log = new Logger(PageDiscoveryService.name);

  constructor(private readonly fetcher: SiteFetchService) {}

  /**
   * Finds the pages on an institution's own site most likely to state entry and
   * English requirements. Two hops at most: the homepage's links, then the links
   * on the best of those (requirement tables are often one level below an
   * "international students" hub). Falls back to sitemap.xml when the homepage
   * yields nothing — common for JS-rendered sites whose nav isn't in the HTML.
   */
  async discover(website: string, maxPages: number): Promise<{ candidates: Candidate[]; notes: string[] }> {
    const notes: string[] = [];
    const root = this.fetcher.normaliseUrl(website);
    if (!root) return { candidates: [], notes: ['institution has no usable website in the register'] };
    const rootHost = new URL(root).hostname;

    const home = await this.fetcher.fetch(root);
    const found = new Map<string, Candidate>();

    if (!home.ok) {
      notes.push(`homepage: ${home.reason}`);
    } else {
      for (const c of this.rank(home.links, rootHost)) {
        if (!found.has(c.url)) found.set(c.url, c);
      }
      notes.push(`homepage yielded ${found.size} candidate page(s)`);
    }

    // Second hop from the single strongest hub, to reach tables one level down.
    const hub = [...found.values()].sort((a, b) => b.score - a.score)[0];
    if (hub && found.size < maxPages) {
      const hubPage = await this.fetcher.fetch(hub.url);
      if (hubPage.ok) {
        let added = 0;
        for (const c of this.rank(hubPage.links, rootHost)) {
          if (!found.has(c.url) && found.size < maxPages * 3) {
            found.set(c.url, c);
            added++;
          }
        }
        if (added) notes.push(`followed "${hub.matched}" and found ${added} more`);
      }
    }

    if (found.size === 0) {
      const fromSitemap = await this.fromSitemap(root, rootHost);
      for (const c of fromSitemap) found.set(c.url, c);
      notes.push(
        fromSitemap.length
          ? `homepage had no usable links; sitemap.xml yielded ${fromSitemap.length}`
          : 'no candidates from homepage or sitemap.xml',
      );
    }

    const candidates = [...found.values()].sort((a, b) => b.score - a.score).slice(0, maxPages);
    return { candidates, notes };
  }

  private rank(links: { href: string; text: string }[], rootHost: string): Candidate[] {
    const out: Candidate[] = [];
    for (const { href, text } of links) {
      if (!this.fetcher.isSameSite(href, rootHost)) continue;
      const url = href.split('#')[0];
      if (REJECT.test(url)) continue;

      // Match on the link text and the path — a nav item reading "English
      // requirements" may point at an opaque CMS path, and vice versa.
      const haystack = `${text} ${decodeURIComponent(new URL(url).pathname)}`;
      let best: { score: number; label: string; kinds: DataKind[] } | null = null;
      for (const p of PATTERNS) {
        if (!p.re.test(haystack)) continue;
        if (!best || p.score > best.score) best = { score: p.score, label: p.label, kinds: p.kinds };
      }
      if (!best) continue;

      // Australian universities publish separate domestic and international
      // admission pages, and only the international one carries an IELTS table.
      // Observed for real: a 20-institution run read Curtin's and Murdoch's
      // English-requirements pages and extracted nothing, because discovery had
      // picked the domestic variant.
      let score = best.score;
      const path = decodeURIComponent(new URL(url).pathname).toLowerCase();
      if (/international|overseas/.test(`${path} ${text.toLowerCase()}`)) score += 25;
      if (/domestic|indigenous|atar|year-?12|school-?leaver|\bstat\b/.test(path)) score -= 45;

      out.push({ url, matched: best.label, score, data_kinds: best.kinds });
    }
    return out;
  }

  private async fromSitemap(root: string, rootHost: string): Promise<Candidate[]> {
    const res = await this.fetcher.fetch(new URL('/sitemap.xml', root).toString());
    if (!res.ok) return [];
    // Read <loc> entries out of the raw XML rather than the cleaned text.
    const locs = [...res.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
    return this.rank(
      locs.map((href) => ({ href, text: '' })),
      rootHost,
    );
  }
}
