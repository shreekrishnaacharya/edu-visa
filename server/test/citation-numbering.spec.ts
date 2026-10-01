// ---------------------------------------------------------------------------
// The [n] markers in an answer must mean the same thing as the citation list
// rendered under it.
//
// They did not. A real AI-analysis answer cited [1], [2], [10] and [11] and
// rendered four links labelled [1]-[4], so "[10]" pointed at nothing a reader
// could follow. Two causes, both invisible from either side alone:
//
//   * the model is given sources numbered 1..N and cites them by that number,
//     so [10] is a correct reference to the tenth source in the PROMPT;
//   * the UI renders the DEDUPED set of cited sources and relabels them from 1
//     by position (CiteChips uses `[i + 1]`), so the numbers no longer line up.
//
// Renumbering happens on the server, where the mapping between prompt index and
// rendered position is actually known.
// ---------------------------------------------------------------------------

import { OrchestratorService } from '../src/modules/assistant/orchestrator.service';
import type { RetrievedChunk } from '../src/modules/knowledge/retrieval.service';

const svc = new OrchestratorService(
  null as any, null as any, null as any, null as any,
  null as any, null as any, null as any, null as any, null as any,
);
const finalise = (text: string, chunks: RetrievedChunk[]) =>
  (svc as any).finaliseCitations(text, chunks) as { text: string; cites: { source_url: string; title: string }[] };

const chunk = (n: number, over: Partial<RetrievedChunk> = {}): RetrievedChunk => ({
  id: `c${n}`,
  text: `source ${n}`,
  source_url: `https://example.invalid/${n}`,
  title: `Source ${n}`,
  effective_date: null,
  doc_type: 'visa_guidance',
  institution: null,
  score: 0,
  ...over,
});

// 11 sources, as a real answer gets: match result, catalogue rows, the
// admission check, then several retrieved passes.
const eleven = Array.from({ length: 11 }, (_, i) => chunk(i + 1));

describe('citation numbering', () => {
  it('renumbers high indices to the positions actually rendered', () => {
    const { text, cites } = finalise(
      'Academic passes [1]. Age passes [1]. Financial capacity applies [10]. Condition 8202 applies [11].',
      eleven,
    );

    // Four markers referring to three distinct sources -> 1, 2, 3.
    expect(text).toBe('Academic passes [1]. Age passes [1]. Financial capacity applies [2]. Condition 8202 applies [3].');
    expect(cites).toHaveLength(3);
    expect(cites[1].title).toBe('Source 10');
    expect(cites[2].title).toBe('Source 11');
  });

  it('never leaves a marker higher than the number of links shown', () => {
    const { text, cites } = finalise('See [9] and [11] and [2].', eleven);
    const markers = [...text.matchAll(/\[(\d+)\]/g)].map((m) => parseInt(m[1], 10));

    expect(markers.length).toBeGreaterThan(0);
    for (const n of markers) expect(n).toBeLessThanOrEqual(cites.length);
  });

  it('collapses two chunks of one document onto its single link', () => {
    // Retrieval routinely returns several chunks of the same page; the UI shows
    // one chip for it, so both markers must point at that one chip.
    const dupes = [
      chunk(1),
      chunk(2, { id: 'c2b', source_url: 'https://example.invalid/1', title: 'Source 1' }),
      chunk(3),
    ];
    const { text, cites } = finalise('First [1], again [2], other [3].', dupes);

    expect(cites).toHaveLength(2);
    expect(text).toBe('First [1], again [1], other [2].');
  });

  it('renumbers a combined marker and collapses duplicates inside it', () => {
    const dupes = [
      chunk(1),
      chunk(2, { id: 'c2b', source_url: 'https://example.invalid/1', title: 'Source 1' }),
      chunk(3),
    ];
    expect(finalise('Both [1, 2] say so.', dupes).text).toBe('Both [1] say so.');
    expect(finalise('Two sources [1, 3].', dupes).text).toBe('Two sources [1, 2].');
  });

  it('removes a reference to a source that does not exist', () => {
    // The model occasionally cites past the end of the list. A dangling marker
    // is worse than none: the claim stays, the false pointer goes.
    const { text, cites } = finalise('Grounded [1]. Invented [47].', eleven);

    expect(text).toBe('Grounded [1]. Invented.');
    expect(cites).toHaveLength(1);
  });

  it('strips every marker when nothing resolved at all', () => {
    const { text, cites } = finalise('Claimed [3] and [4].', []);
    expect(cites).toHaveLength(0);
    expect(text).toBe('Claimed and.');
  });

  it('leaves an uncited answer untouched', () => {
    const body = 'No sources were available for this question.';
    expect(finalise(body, eleven).text).toBe(body);
  });

  it('does not leave a space before punctuation where a marker was removed', () => {
    expect(finalise('A claim [99] , and another [98] .', eleven).text).toBe('A claim, and another.');
  });
});
