// ---------------------------------------------------------------------------
// A Nepali applicant is bound by two governments, and the assistant has to be
// able to reach both bodies of rules.
//
// Two things stopped it, and neither was visible from the corpus alone — the
// Nepal documents indexed fine and simply never came back:
//
// 1. Retrieval was pinned to `country: 'AU'`, so a document about Nepal's own
//    requirements could be ingested, chunked and embedded and then never be
//    retrieved by anything.
//
// 2. The keyword router had no notion of an origin-country rule. Asked "do I
//    need permission from the Nepal government, and can my bank send my
//    tuition?", it matched only /bank/ and ran the cost_of_living pass alone —
//    so the answer was "no information in the provided sources" for a question
//    the corpus could answer.
// ---------------------------------------------------------------------------

import { OrchestratorService } from '../src/modules/assistant/orchestrator.service';

// choosePasses() and retrievalCountries() are pure string logic and touch none
// of the injected services, so a bare instance is enough to pin them.
const svc = new OrchestratorService(
  null as any, null as any, null as any, null as any,
  null as any, null as any, null as any, null as any, null as any,
);
const passes = (m: string): string[] => (svc as any).choosePasses(m);
const countries = (n?: string): string[] => (svc as any).retrievalCountries(n ? { nationality: n } : null);

describe('origin-country questions reach the origin-country corpus', () => {
  it('routes the question that used to fail to visa guidance', () => {
    const m = 'Do I need permission from the Nepal government before I go to Australia to study, and can my bank send my tuition without it?';
    expect(passes(m)).toContain('visa_guidance');
  });

  it.each([
    'Do I need a No Objection Certificate?',
    'Is NOC required for my course?',
    'How do I get approval from the Ministry of Education?',
    'Can I remit tuition fees from Nepal?',
    'How do I transfer money to my university?',
    'What are the foreign exchange rules for students?',
  ])('routes %j to visa guidance', (m) => {
    expect(passes(m)).toContain('visa_guidance');
  });

  it('still sends a genuine cost question to cost of living', () => {
    // The origin-country rule must widen routing, not hijack it.
    const p = passes('How much does it cost to live in Melbourne per week?');
    expect(p).toContain('cost_of_living');
  });

  it('asks both jurisdictions for a question that spans them', () => {
    const p = passes('Can my bank send my tuition, and how much are living costs?');
    expect(p).toContain('visa_guidance');
    expect(p).toContain('cost_of_living');
  });
});

describe('retrieval spans destination and origin', () => {
  it('searches Australian and Nepali material for a Nepali applicant', () => {
    expect(countries('Nepal')).toEqual(['AU', 'NP']);
  });

  it('uses the applicant’s own country, not the configured market', () => {
    expect(countries('India')).toEqual(['AU', 'IN']);
  });

  it('falls back to the configured market when no nationality is on file', () => {
    // Default HOME_MARKET is Nepal, so an unknown applicant still gets the
    // origin-country rules this consultancy's applicants are subject to.
    expect(countries()).toEqual(['AU', 'NP']);
  });

  it('never narrows the search for an unrecognised nationality', () => {
    // Australia only, rather than an ISO code we would be guessing at.
    expect(countries('Ruritania')).toEqual(['AU']);
  });
});
