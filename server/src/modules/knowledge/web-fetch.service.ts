import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT = 'EduVisaKnowledgeBot/1.0 (+internal research tool; respects robots.txt)';

/** Domains this tool is willing to fetch — official / institutional only. */
const ALLOWED_SUFFIXES = ['.gov.au', '.edu.au', 'cricos.education.gov.au', 'studyaustralia.gov.au'];

/**
 * The "live web" freshness fallback (plan appendix B) — deliberately a
 * fetch-a-known-URL tool, not open-ended search (no search-engine API key is
 * configured, and a fixed allowlist keeps an unattended agent from wandering
 * off official sources).
 */
@Injectable()
export class WebFetchService {
  private readonly logger = new Logger(WebFetchService.name);

  isAllowed(url: string): boolean {
    try {
      const host = new URL(url).hostname;
      return ALLOWED_SUFFIXES.some((s) => host === s.replace(/^\./, '') || host.endsWith(s));
    } catch {
      return false;
    }
  }

  async fetchText(url: string): Promise<{ ok: true; text: string; title: string } | { ok: false; reason: string }> {
    if (!this.isAllowed(url)) return { ok: false, reason: 'domain not on the official-source allowlist' };
    try {
      const res = await axios.get(url, {
        timeout: 12000,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        validateStatus: () => true,
      });
      if (res.status >= 400) return { ok: false, reason: `HTTP ${res.status}` };
      const $ = cheerio.load(String(res.data));
      $('script, style, nav, header, footer, noscript').remove();
      const title = $('title').first().text().trim();
      const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 4000);
      return { ok: true, text, title };
    } catch (e) {
      this.logger.warn(`fetchText(${url}) failed: ${(e as Error).message}`);
      return { ok: false, reason: (e as Error).message };
    }
  }
}
