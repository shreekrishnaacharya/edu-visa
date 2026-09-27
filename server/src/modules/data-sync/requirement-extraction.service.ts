import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../knowledge/openrouter.service';
import { ProgramLevel } from '../admission/admission-policy.types';

/** One English requirement the page actually states. */
export interface ExtractedBand {
  level: ProgramLevel;
  /** The quote listed several different scores, so which one applies is unclear. */
  ambiguous?: boolean;
  /** The programs this band applies to, as the page words it. "" = the general/default band. */
  label: string;
  min_ielts_overall: number | null;
  min_ielts_band: number | null;
  min_pte_overall: number | null;
  min_pte_band: number | null;
  min_toefl_overall: number | null;
  /** Verbatim sentence/row the numbers came from — the evidence a reviewer checks. */
  quote: string;
}

export interface ExtractionResult {
  /** True when the page genuinely states English requirements. */
  has_requirements: boolean;
  bands: ExtractedBand[];
  /** One sentence on what this page holds — becomes source_page.description. */
  page_description: string;
  /** 0-1, the model's own confidence. Never used to auto-apply, only to sort review. */
  confidence: number;
  notes: string[];
}

const EMPTY: ExtractionResult = {
  has_requirements: false,
  bands: [],
  page_description: '',
  confidence: 0,
  notes: [],
};

/** IELTS 0-9 in 0.5 steps; PTE 10-90; TOEFL iBT 0-120. Anything outside is a misread. */
const RANGES = {
  min_ielts_overall: [4, 9],
  min_ielts_band: [4, 9],
  min_pte_overall: [10, 90],
  min_pte_band: [10, 90],
  min_toefl_overall: [30, 120],
} as const;

const LEVELS: ProgramLevel[] = ['UG', 'PG', 'PG_RESEARCH', 'PATHWAY'];

const SYSTEM = `You extract English-language admission requirements from Australian university web pages.

Return ONLY a JSON object, no prose, no markdown fence, matching exactly:
{
  "has_requirements": boolean,
  "page_description": string,
  "confidence": number,
  "notes": string[],
  "bands": [
    {
      "level": "UG" | "PG" | "PG_RESEARCH" | "PATHWAY",
      "label": string,
      "min_ielts_overall": number | null,
      "min_ielts_band": number | null,
      "min_pte_overall": number | null,
      "min_pte_band": number | null,
      "min_toefl_overall": number | null,
      "quote": string
    }
  ]
}

RULES — these matter more than completeness:
1. Copy numbers ONLY if they appear literally on the page. Never infer, average, convert between tests, or recall a figure from your own knowledge. If the page does not state a number, use null.
2. "quote" must be text copied verbatim from the page containing those numbers. If you cannot quote it, do not report it.
3. "min_ielts_band" is the per-section floor ("no band less than 6.0"), NOT the overall. If only one number is given, it is the overall and the band is null.
4. "label" is the program scope the page states, e.g. "Law", "Nursing", "Master of Teaching". Use "" for the general/default requirement that applies unless stated otherwise.
5. level: UG = bachelor/undergraduate; PG = masters/postgraduate coursework; PG_RESEARCH = PhD/MPhil/research; PATHWAY = foundation/diploma/ELICOS.
6. If the page states no English requirement at all, return has_requirements=false and bands=[].
7. "page_description" is one factual sentence describing what this page contains.
8. confidence: 0.9+ only for a clear table of numbers; below 0.5 if the page is ambiguous.`;

/**
 * Turns a cleaned requirements page into structured English bands.
 *
 * The output is always a PROPOSAL. Nothing here writes to the catalogue: the
 * caller stages it for human review, because the register publishes no entry
 * requirements and an extraction error would otherwise become an entry bar the
 * matching engine gates real students on.
 */
@Injectable()
export class RequirementExtractionService {
  private readonly log = new Logger(RequirementExtractionService.name);

  constructor(private readonly openrouter: OpenRouterService) {}

  async extract(page: { url: string; title: string; text: string }): Promise<ExtractionResult> {
    // Cheap pre-filter: no test named, nothing to extract, no LLM call.
    if (!/\b(ielts|pte|toefl|english language)\b/i.test(page.text)) {
      return { ...EMPTY, notes: ['page names no English test — skipped without an LLM call'] };
    }

    const excerpt = this.focus(page.text);
    let raw: string;
    try {
      raw = await this.openrouter.chat(
        [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `URL: ${page.url}\nTITLE: ${page.title}\n\nPAGE TEXT:\n${excerpt}`,
          },
        ],
        { temperature: 0, maxTokens: 1500 },
      );
    } catch (e) {
      return { ...EMPTY, notes: [`extraction call failed: ${(e as Error).message}`] };
    }

    let parsed = this.parseJson(raw);
    if (!parsed) {
      // The configured chat model drops out of JSON on long pages (seen on
      // Swinburne's entry-requirements page). One retry on a tighter excerpt is
      // cheaper than losing the institution entirely.
      try {
        const retry = await this.openrouter.chat(
          [
            { role: 'system', content: SYSTEM },
            {
              role: 'user',
              content: `Return ONLY the JSON object. URL: ${page.url}\n\nPAGE TEXT:\n${excerpt.slice(0, 6000)}`,
            },
          ],
          { temperature: 0, maxTokens: 1200 },
        );
        parsed = this.parseJson(retry);
      } catch {
        /* fall through to the no-JSON result below */
      }
    }
    if (!parsed) return { ...EMPTY, notes: ['model did not return usable JSON'] };
    return this.validate(parsed, page.text);
  }

  /**
   * Keeps the parts of a long page that actually mention a test, with
   * surrounding context. A university's requirements page can run past the
   * model's context; sending the whole thing truncates the table away.
   */
  private focus(text: string): string {
    const MAX = 14_000;
    if (text.length <= MAX) return text;
    const lines = text.split('\n');
    const keep = new Set<number>();
    lines.forEach((line, i) => {
      if (/\b(ielts|pte|toefl|english|band|overall|minimum)\b/i.test(line)) {
        for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) keep.add(j);
      }
    });
    const focused = [...keep]
      .sort((a, b) => a - b)
      .map((i) => lines[i])
      .join('\n');
    return (focused.length > 200 ? focused : text).slice(0, MAX);
  }

  private parseJson(raw: string): Record<string, any> | null {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    // Models sometimes prepend a sentence; take the outermost JSON object.
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

  /**
   * Drops anything the page doesn't support. The model is instructed to quote
   * its evidence, so a band whose quote isn't on the page, or whose scores are
   * outside the test's real range, is discarded rather than trusted — that is
   * the difference between sourcing a requirement and inventing one.
   */
  private validate(obj: Record<string, any>, pageText: string): ExtractionResult {
    const notes: string[] = Array.isArray(obj.notes)
      ? obj.notes.filter((n: unknown) => typeof n === 'string').slice(0, 6)
      : [];
    const haystack = this.normalise(pageText);
    const bands: ExtractedBand[] = [];

    for (const b of Array.isArray(obj.bands) ? obj.bands : []) {
      const level: ProgramLevel = LEVELS.includes(b?.level) ? b.level : 'PG';
      const quote = typeof b?.quote === 'string' ? b.quote.trim() : '';

      const scores: Record<string, number | null> = {};
      let anyScore = false;
      let outOfRange = false;
      for (const [field, [lo, hi]] of Object.entries(RANGES)) {
        const v = b?.[field];
        if (typeof v === 'number' && Number.isFinite(v)) {
          if (v < lo || v > hi) {
            outOfRange = true;
            scores[field] = null;
          } else {
            scores[field] = v;
            anyScore = true;
          }
        } else {
          scores[field] = null;
        }
      }
      if (outOfRange) notes.push(`dropped an out-of-range score for "${b?.label ?? level}"`);
      if (!anyScore) continue;

      // The quote must really be on the page. Guards the failure mode that
      // matters: a confidently formatted band the source never stated.
      if (!quote || !this.quoteAppears(quote, haystack)) {
        notes.push(`dropped "${b?.label || level}" — its quote is not on the page`);
        continue;
      }

      // A quote holding several different overall scores means the page's row
      // covered several programs ("Business | 6.5 overall | 7.0 overall | 7.0
      // overall") and the model picked one — observed flipping between 6.5 and
      // 7.0 for the same UNSW row across runs. Keep it, because the figure is
      // real, but mark it so the reviewer looks instead of rubber-stamping.
      const ambiguous = this.hasMultipleOveralls(quote);
      if (ambiguous) {
        notes.push(
          `"${b?.label || level}" came from a row listing several different scores — confirm which program it applies to`,
        );
      }

      bands.push({
        level,
        ambiguous,
        label: typeof b?.label === 'string' ? b.label.trim().slice(0, 160) : '',
        min_ielts_overall: scores.min_ielts_overall,
        min_ielts_band: scores.min_ielts_band,
        min_pte_overall: scores.min_pte_overall,
        min_pte_band: scores.min_pte_band,
        min_toefl_overall: scores.min_toefl_overall,
        quote: quote.slice(0, 400),
      });
    }

    const confidence =
      typeof obj.confidence === 'number' && obj.confidence >= 0 && obj.confidence <= 1
        ? obj.confidence
        : 0.5;

    // Don't report high confidence overall when some bands are ambiguous.
    const capped = bands.some((b) => b.ambiguous) ? Math.min(confidence, 0.6) : confidence;

    return {
      has_requirements: bands.length > 0,
      bands,
      page_description:
        typeof obj.page_description === 'string' ? obj.page_description.trim().slice(0, 400) : '',
      // A claim we dropped shouldn't leave the model's original confidence intact.
      confidence: bands.length ? capped : 0,
      notes,
    };
  }

  /**
   * True when a quote contains two or more distinct IELTS-shaped overall scores
   * (a table row spanning several programs).
   */
  private hasMultipleOveralls(quote: string): boolean {
    const overalls = new Set(
      [...quote.matchAll(/(\d(?:\.\d)?)\s*(?=overall)/gi)].map((m) => m[1]),
    );
    return overalls.size > 1;
  }

  private normalise(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Whitespace/punctuation-insensitive containment. A strict match fails
   * constantly because the model re-spaces table cells it quotes; falling back
   * to "are the quote's numbers all present" keeps real bands without
   * accepting a fabricated one.
   */
  private quoteAppears(quote: string, haystack: string): boolean {
    const q = this.normalise(quote);
    if (q.length < 8) return false;
    if (haystack.includes(q)) return true;
    const numbers = q.match(/\d+(?:\.\d+)?/g) ?? [];
    if (!numbers.length) return false;
    return numbers.every((n) => haystack.includes(n));
  }
}
