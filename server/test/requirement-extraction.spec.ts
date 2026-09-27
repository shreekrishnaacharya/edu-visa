// ---------------------------------------------------------------------------
// The extraction guardrails. This is the highest-risk code in the sourcing
// pipeline: anything that survives validation becomes an entry bar the matching
// engine gates real students on, so a hallucinated band is worse than no band.
//
// The LLM call itself is stubbed — what's under test is the validator that
// decides which of the model's claims are allowed through.
// ---------------------------------------------------------------------------

import { RequirementExtractionService } from '../src/modules/data-sync/requirement-extraction.service';

/** Stands in for OpenRouterService, returning whatever the test wants. */
function makeService(reply: string) {
  const openrouter = { chat: jest.fn().mockResolvedValue(reply) };
  return new RequirementExtractionService(openrouter as any);
}

const PAGE_TEXT = `
English language requirements
Arts, Design & Architecture | 6.5 overall (min. 6.0 in each subtest)
Law & Justice | 7.0 overall (min 6.0 in each subtest)
Master of Teaching (Primary & Secondary): 7.5 overall (min 7.0 in writing & reading)
`;

const page = { url: 'https://example.edu.au/english', title: 'English requirements', text: PAGE_TEXT };

const band = (over: Record<string, unknown> = {}) => ({
  level: 'UG',
  label: 'Law & Justice',
  min_ielts_overall: 7.0,
  min_ielts_band: 6.0,
  min_pte_overall: null,
  min_pte_band: null,
  min_toefl_overall: null,
  quote: 'Law & Justice | 7.0 overall (min 6.0 in each subtest)',
  ...over,
});

const reply = (bands: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    has_requirements: true,
    page_description: 'English requirements by faculty.',
    confidence: 0.9,
    notes: [],
    bands,
    ...extra,
  });

describe('requirement extraction guardrails', () => {
  it('keeps a band whose quote is really on the page', async () => {
    const svc = makeService(reply([band()]));
    const out = await svc.extract(page);
    expect(out.has_requirements).toBe(true);
    expect(out.bands).toHaveLength(1);
    expect(out.bands[0].min_ielts_overall).toBe(7.0);
  });

  it('drops a band whose quote is NOT on the page', async () => {
    // The failure that matters: a confidently formatted band the source never stated.
    const svc = makeService(
      reply([band({ label: 'Dentistry', quote: 'Dentistry requires 8.0 overall with no band below 7.5' })]),
    );
    const out = await svc.extract(page);
    expect(out.bands).toHaveLength(0);
    expect(out.has_requirements).toBe(false);
    expect(out.notes.join(' ')).toMatch(/not on the page/i);
  });

  it('drops scores outside the test’s real range', async () => {
    const svc = makeService(reply([band({ min_ielts_overall: 65 })]));
    const out = await svc.extract(page);
    // 65 is a PTE score misread as IELTS; the in-range band floor survives.
    expect(out.bands[0]?.min_ielts_overall ?? null).toBeNull();
    expect(out.notes.join(' ')).toMatch(/out-of-range/i);
  });

  it('discards a band with no numeric score at all', async () => {
    const svc = makeService(
      reply([band({ min_ielts_overall: null, min_ielts_band: null, quote: 'Law & Justice' })]),
    );
    expect((await svc.extract(page)).bands).toHaveLength(0);
  });

  it('flags a band read off a row listing several different scores', async () => {
    const svc = makeService(
      reply([
        band({
          label: 'Business',
          quote: 'Business | 6.5 overall (min 6.0 in each subtest) | 7.0 overall (min 6.0 in each subtest)',
        }),
      ]),
    );
    const out = await svc.extract(page);
    // Observed for real on UNSW: the same row flipped between 6.5 and 7.0
    // across runs, so it must reach the reviewer marked, not at 0.9.
    expect(out.bands[0].ambiguous).toBe(true);
    expect(out.confidence).toBeLessThanOrEqual(0.6);
  });

  it('does not flag a row that repeats the same score', async () => {
    const svc = makeService(
      reply([band({ quote: 'Law & Justice | 7.0 overall (min 6.0 in each subtest)' })]),
    );
    expect((await svc.extract(page)).bands[0].ambiguous).toBe(false);
  });

  it('returns nothing when the model emits unusable JSON', async () => {
    const svc = makeService('I could not find any requirements on this page.');
    const out = await svc.extract(page);
    expect(out.has_requirements).toBe(false);
    expect(out.confidence).toBe(0);
  });

  it('tolerates a markdown-fenced reply', async () => {
    const svc = makeService('```json\n' + reply([band()]) + '\n```');
    expect((await svc.extract(page)).bands).toHaveLength(1);
  });

  it('makes no LLM call when the page names no English test', async () => {
    const openrouter = { chat: jest.fn() };
    const svc = new RequirementExtractionService(openrouter as any);
    const out = await svc.extract({
      url: 'https://example.edu.au/about',
      title: 'About us',
      text: 'We are a university in Sydney with a long history of research excellence.',
    });
    expect(openrouter.chat).not.toHaveBeenCalled();
    expect(out.has_requirements).toBe(false);
  });

  it('zeroes confidence when every claim was dropped', async () => {
    const svc = makeService(reply([band({ quote: 'entirely invented sentence about scores 9.0' })]));
    expect((await svc.extract(page)).confidence).toBe(0);
  });
});
