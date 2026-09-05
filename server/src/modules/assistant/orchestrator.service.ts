import { Injectable, Logger } from '@nestjs/common';
import { RetrievalService, RetrievedChunk } from '../knowledge/retrieval.service';
import { OpenRouterService } from '../knowledge/openrouter.service';
import { WebFetchService } from '../knowledge/web-fetch.service';
import { StudentService } from '../student/student.service';
import { ProfileService } from '../profile/profile.service';
import { MatchService } from '../match/match.service';
import { CourseService } from '../course/course.service';
import { DocType } from '../knowledge/doc.entity';

export interface OrchestratorResult {
  answer: string;
  cites: { chunk_id: string; source_url: string; title: string }[];
  confidence: number;
  passes_run: string[];
  degraded: boolean;
}

export interface RouteDecision {
  passes: DocType[];
  wants_catalogue: boolean;
  catalogue_keywords: string[];
}

const DISCLAIMER =
  'This is advice, not a guarantee of admission or a visa grant. Course, fee and visa details change — verify against the cited sources before acting.';

/**
 * The AI consultant orchestrator (plan appendix B). Deliberately NOT a
 * model-driven tool-calling loop: `google/gemma-4-26b-a4b-it:free` is a small
 * free model and tool-call reliability from it is not something to bet a
 * consultancy's advice on, so this Node code decides which retrieval passes a
 * question needs (mirrors the plan's "one pass per concern"), assembles the
 * grounded context itself, and makes ONE generation call to compose the
 * answer. The deterministic engine (MatchService) is always the source of the
 * ranking; this only explains/grounds it.
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly retrieval: RetrievalService,
    private readonly openrouter: OpenRouterService,
    private readonly webFetch: WebFetchService,
    private readonly students: StudentService,
    private readonly profiles: ProfileService,
    private readonly matches: MatchService,
    private readonly courses: CourseService,
  ) {}

  private static readonly VALID_PASSES: DocType[] = [
    'visa_guidance',
    'cost_of_living',
    'scholarship_terms',
    'entry_requirement',
    'visa_statistics',
  ];

  /**
   * Routes a question to KB passes + catalogue keywords using a small, cheap
   * model (Gemma 3 4B — a classification task, not a generation task, so it
   * doesn't need the 26B model) instead of hand-rolled regex/stopword rules.
   * The regex version below (`choosePasses`/`wantsCatalogueSearch`/
   * `extractCatalogueKeywords`) chased one edge case after another — an
   * abbreviation not in the alias map, "Cybersecurity" vs the real "Cyber
   * Security" spelling, a phrase boundary destroyed by stopword removal — the
   * exact class of problem a language model is actually good at and hand
   * rules aren't. Kept as the fallback if this call fails or is misconfigured
   * (network/budget-guard/malformed JSON), so the assistant degrades instead
   * of breaking.
   */
  private async route(message: string): Promise<RouteDecision> {
    const system = `Classify one question for an Australia-focused study/visa consultancy assistant. Output ONLY strict JSON, no prose: {"passes": string[], "wants_catalogue": boolean, "catalogue_keywords": string[]}.
"passes": choose zero or more from exactly ["visa_guidance","cost_of_living","scholarship_terms","entry_requirement","visa_statistics"] — whichever knowledge-base topics the question touches (visa_statistics = grant/approval-rate/success-chance questions specifically). Empty array is fine.
"wants_catalogue": true only if the question asks about specific real courses, subjects, fees, or universities that a database of actual Australian course listings could answer (not visa rules, not general advice).
"catalogue_keywords": if wants_catalogue, 1-4 short search terms to look up — use the FULL real name/spelling where you know it (RMIT -> "Royal Melbourne Institute of Technology", UQ -> "University of Queensland", USYD -> "University of Sydney", Cybersecurity -> "Cyber Security" since Australian course titles spell it as two words). Otherwise empty array.`;

    try {
      const text = await this.openrouter.chat(
        [
          { role: 'system', content: system },
          { role: 'user', content: message },
        ],
        { model: OpenRouterService.ROUTER_MODEL, maxTokens: 200, temperature: 0 },
      );
      const match = text.match(/\{[\s\S]*\}/);
      const json = match ? JSON.parse(match[0]) : {};
      const passes = Array.isArray(json.passes)
        ? json.passes.filter((p: unknown): p is DocType => OrchestratorService.VALID_PASSES.includes(p as DocType))
        : [];
      // The 4B router reliably gets the JUDGMENT right (is this a catalogue
      // question, what are the key entities) but not reliably the SPELLING —
      // a real test showed it extracting "RMIT"/"Cybersecurity" verbatim
      // despite being told to expand them. A tiny, fixed, known alias table
      // is more reliable than hoping a small model recalls it every time, so
      // it still runs as post-processing rather than trusting the prompt alone.
      const rawKeywords: string[] = Array.isArray(json.catalogue_keywords) ? json.catalogue_keywords.slice(0, 4) : [];
      const aliased = rawKeywords.map(
        (k) => OrchestratorService.COMPOUND_ALIASES[k.toLowerCase().replace(/\s+/g, '')] ?? k,
      );
      // The router still hands back generic filler alongside the good terms
      // (a real test: "Master", "Course Fees" — neither appears in any real
      // course/university name) — with these feeding an AND-across-terms
      // search, one non-matching filler term fails the whole AND and forces
      // a fall-through to OR, where "Master" alone floods the results with
      // every Master's-level course, drowning out the specific one asked
      // for. Same uselessness filter as the regex fallback, applied here too.
      const catalogue_keywords = OrchestratorService.filterUsefulKeywords(aliased);
      return {
        passes: passes.length ? passes : ['visa_guidance'],
        wants_catalogue: !!json.wants_catalogue,
        catalogue_keywords,
      };
    } catch (e) {
      this.logger.warn(`routing call failed, falling back to regex heuristics: ${(e as Error).message}`);
      return {
        passes: this.choosePasses(message),
        wants_catalogue: this.wantsCatalogueSearch(message),
        catalogue_keywords: this.extractCatalogueKeywords(message),
      };
    }
  }

  /** Fallback only — see `route()`. */
  private choosePasses(message: string): DocType[] {
    const m = message.toLowerCase();
    const passes = new Set<DocType>();
    if (/visa|refus|deport|breach|genuine student|gte|deadline|deportation/.test(m)) passes.add('visa_guidance');
    if (/grant rate|success rate|chance|approval|likely to (get|be granted)|statistic/.test(m)) passes.add('visa_statistics');
    if (/afford|fund|money|financ|cost|living|budget|expense|rent|saving|bank|income/.test(m)) passes.add('cost_of_living');
    if (/scholarship|discount|waiver/.test(m)) passes.add('scholarship_terms');
    if (/entry|requirement|prerequisite|gpa|ielts|pte|english test|apply|application/.test(m)) passes.add('entry_requirement');
    if (/work|job|post-study|485|employ/.test(m)) passes.add('visa_guidance');
    if (passes.size === 0) passes.add('visa_guidance'); // sensible default for an exploratory question
    return [...passes];
  }

  /**
   * With 3,500+ real courses in the DB, a question naming a course/subject/
   * university is answered far more accurately from a direct catalogue query
   * than from chunked prose — this is a structured-data lookup, not RAG.
   */
  private wantsCatalogueSearch(message: string): boolean {
    return /course|subject|program|degree|major|university|college|offer|study\s|curricul|specialisation|specialization/i.test(
      message,
    );
  }

  private static readonly STOPWORDS = new Set(
    ('a an the is are do does did what which who how much many where when why can could would should will i you he she they we my your our their ' +
      'this that these those and or but for with about into from does offer offers offering study studies course courses program programs degree degrees ' +
      'university college cost costs how ' +
      // Degree-level words are too broad as free-text ILIKE terms (nearly
      // every course title starts with "Master of..."/"Bachelor of...") and
      // are already handled by the structured degree_level filter when known.
      'master masters bachelor bachelors phd doctorate doctoral diploma certificate graduate postgraduate undergraduate ' +
      // Generic content-shaped words that will never appear in a course
      // title/field/university name — found via a real test failure: these
      // survived the filter above, then a downstream 5-keyword cap dropped
      // the one word ("Melbourne") that actually distinguished the query.
      'specific subjects subject curriculum structure information tell know want need looking find search list show me please could would available ' +
      'fee fees tuition price prices'
    ).split(' '),
  );

  /**
   * Drops a keyword if EVERY word in it is a stopword/degree-level/filler
   * term — i.e. it has no real chance of matching a course/field/university
   * name. Used on both the LLM router's output and the regex fallback's, so
   * neither path can feed an AND-search a term (like "Master" or "Course
   * Fees") that either matches nothing or matches everything.
   */
  private static filterUsefulKeywords(keywords: string[]): string[] {
    return keywords.filter((k) =>
      k
        .split(/\s+/)
        .some((w) => w.length >= 3 && !OrchestratorService.STOPWORDS.has(w.toLowerCase())),
    );
  }

  // Real CRICOS course titles spell these with a space; casual questions
  // often don't (found via a real test failure: "Cybersecurity" matched
  // nothing against RMIT's actual "Master of Cyber Security"). An ILIKE
  // substring match can't bridge that on its own, so expand known compounds
  // to both spellings rather than trying to be clever about tokenizing.
  private static readonly COMPOUND_ALIASES: Record<string, string> = {
    cybersecurity: 'cyber security',
    datascience: 'data science',
    bigdata: 'big data',
    machinelearning: 'machine learning',
    softwareengineering: 'software engineering',
    artificialintelligence: 'artificial intelligence',
    // Common university abbreviations that DON'T appear in the real CRICOS
    // "Institution Name" for these 3 (unlike UNSW/Deakin/UniMelb/UWA/Monash,
    // whose CRICOS names include the abbreviation in parentheses) — found via
    // a real test failure ("RMIT" matched nothing; the stored name is "Royal
    // Melbourne Institute of Technology").
    rmit: 'royal melbourne institute',
    uq: 'university of queensland',
    usyd: 'university of sydney',
  };

  /**
   * Pulls search keywords out of a free-text question — an ILIKE against one
   * mangled multi-word phrase matches nothing; a handful of real nouns
   * (subject, university name) reliably does. Deliberately simple (no LLM
   * call) so this stays fast and doesn't spend budget just to route a query.
   */
  private extractCatalogueKeywords(message: string, fallbackField?: string): string[] {
    const raw = message.replace(/[?.!,]/g, ' ').split(/\s+/).filter(Boolean);
    // Alias lookup runs on every raw token BEFORE anything else — "UQ" is 2
    // characters and would otherwise never survive the length filter below.
    // Replacement, not addition: these feed an AND-across-terms search, so
    // keeping both "rmit" and its expansion as separate required terms would
    // make the un-aliased original (which matches nothing literal) sink the
    // whole query.
    const normalised = raw.map((w) => OrchestratorService.COMPOUND_ALIASES[w.toLowerCase()] ?? w);

    // Proper-noun phrases (consecutive capitalised words bridged by small
    // joiners, e.g. "Data Science", "University of Melbourne") MUST be
    // detected on the raw token stream, before stopword removal — a real
    // test failure: filtering "University" and "at" out first left "Science"
    // and "Melbourne" looking adjacent, so they merged into one bogus
    // "Data Science Melbourne" phrase that matches nothing, instead of the
    // two real, separate, correct phrases "Data Science" and "University of
    // Melbourne". Words used inside a phrase are consumed and don't also
    // become loose keywords.
    const phrases: string[] = [];
    const used = new Set<number>();
    let current: number[] = [];
    const flush = () => {
      if (current.length > 1 || (current.length === 1 && /^[A-Z]/.test(normalised[current[0]]))) {
        phrases.push(current.map((i) => normalised[i]).join(' '));
        current.forEach((i) => used.add(i));
      }
      current = [];
    };
    normalised.forEach((w, i) => {
      const isCapitalised = /^[A-Z]/.test(w);
      const isJoiner = ['of', 'and', 'the', 'for'].includes(w.toLowerCase());
      if (isCapitalised || (current.length && isJoiner)) current.push(i);
      else flush();
    });
    flush();

    const looseWords = normalised.filter(
      (w, i) => !used.has(i) && w.length >= 3 && !OrchestratorService.STOPWORDS.has(w.toLowerCase()),
    );

    // Phrases first — a downstream cap on the number of search terms must
    // never drop a specific name in favour of a generic word that happened
    // to survive filtering.
    const keywords = [...new Set([...phrases, ...looseWords])];
    if (fallbackField) keywords.push(fallbackField);
    return keywords.length ? keywords : message.split(/\s+/).slice(0, 3);
  }

  /** Age, not DOB; affordability band, not balances — plan appendix B.3. */
  private piiMinimisedProfileSummary(profile: any, student: any): string {
    if (!profile) return 'No derived profile yet (intake incomplete).';
    const band =
      profile.affordability_score >= 80 ? 'strong' : profile.affordability_score >= 55 ? 'moderate' : 'tight';
    const age = student?.date_of_birth
      ? Math.floor((Date.now() - new Date(student.date_of_birth).getTime()) / 3.15576e10)
      : null;
    return [
      age != null ? `Age: ${age}` : null,
      `Canonical GPA: ${profile.canonical_gpa}/100`,
      `English: ${profile.english_band != null ? `IELTS-equivalent ${profile.english_band} (${profile.english_source})` : 'no test on file'}`,
      `Relevant work experience: ${profile.relevant_experience_months} months`,
      `Affordability band: ${band}`,
      `PR intent: ${profile.pr_intent}`,
      `Field of study: ${profile.field_of_study || 'unspecified'}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  async answer(message: string, studentId: string | null): Promise<OrchestratorResult> {
    const route = await this.route(message);
    const passes = route.passes;
    let student: any = null;
    let profile: any = null;
    let latestRun: any = null;

    if (studentId) {
      student = await this.students.getEntityWithRelations(studentId);
      profile = student ? await this.profiles.latest(studentId) : null;
      latestRun = studentId ? await this.matches.latestForStudent(studentId) : null;
    }

    // Build the retrieval query from structured signal where we have it, not
    // the raw chat text — plan appendix B.2.
    const structuredQuery = student
      ? `${message} — AU student visa context: field ${profile?.field_of_study ?? ''}, budget-sensitive: ${
          profile ? (profile.affordability_score < 55 ? 'yes' : 'no') : 'unknown'
        }`
      : message;

    const retrievedByPass = new Map<string, RetrievedChunk[]>();
    for (const pass of passes) {
      try {
        const chunks = await this.retrieval.retrieve(structuredQuery, { country: 'AU', doc_type: pass }, 4);
        if (chunks.length) retrievedByPass.set(pass, chunks);
      } catch (e) {
        this.logger.warn(`retrieval pass ${pass} failed: ${(e as Error).message}`);
      }
    }

    let degraded = false;
    // Freshness fallback: if a visa-guidance question found nothing in the KB,
    // try a direct fetch of the known official guide (allowlisted domain).
    if (passes.includes('visa_guidance') && !retrievedByPass.get('visa_guidance')?.length) {
      const fb = await this.webFetch.fetchText('https://www.studyaustralia.gov.au/en/plan-your-move/your-guide-to-visas');
      if (fb.ok) {
        retrievedByPass.set('visa_guidance', [
          {
            id: 'live-fetch',
            text: fb.text.slice(0, 2000),
            source_url: 'https://www.studyaustralia.gov.au/en/plan-your-move/your-guide-to-visas',
            title: 'Your guide to Australian student visas (live fetch, unverified)',
            effective_date: new Date().toISOString().slice(0, 10),
            doc_type: 'visa_guidance',
            institution: null,
            score: 0,
          },
        ]);
        degraded = true; // live, unverified — not the curated corpus
      }
    }

    // Structured catalogue lookup (not RAG) for course/subject/university questions.
    let catalogueChunks: RetrievedChunk[] = [];
    if (route.wants_catalogue && route.catalogue_keywords.length) {
      try {
        const rows = await this.courses.searchForAssistant(route.catalogue_keywords, {
          degree_level: student?.preferences?.degree_level,
          country: 'AU',
          limit: 6,
        });
        catalogueChunks = rows.map((c) => ({
          id: c.id,
          text: `${c.title} — ${c.university_name}, ${c.city}. ${c.degree_level}, ${c.field}. Duration ${c.duration_months} months. Tuition A$${c.tuition_fee.toLocaleString()}/yr. CRICOS ${c.cricos}. ${c.scholarships?.length ? `Scholarships: ${c.scholarships.map((s) => `${s.name} (${s.pct}%)`).join(', ')}.` : 'No scholarship on file.'}`,
          // Not a real link (no public course page on file) — a bare
          // `catalogue:` string isn't a browser-openable URL, so leave
          // source_url empty and let the title carry the citation instead.
          source_url: '',
          title: `${c.title} — ${c.university_name} (our course catalogue, CRICOS ${c.cricos})`,
          effective_date: c.verified_at ? new Date(c.verified_at).toISOString().slice(0, 10) : null,
          doc_type: 'entry_requirement',
          institution: c.university_name,
          score: 1,
        }));
      } catch (e) {
        this.logger.warn(`catalogue search failed: ${(e as Error).message}`);
      }
    }

    const allChunks = [...catalogueChunks, ...[...retrievedByPass.values()].flat()];
    const contextBlock = allChunks.length
      ? allChunks
          .map((c, i) => {
            const tag = c.source_url.startsWith('catalogue:')
              ? 'OUR CATALOGUE — authoritative for this course'
              : 'external source';
            return `[${i + 1}] (${tag}: ${c.source_url}, effective: ${c.effective_date ?? 'unknown'})\n${c.text.slice(0, 900)}`;
          })
          .join('\n\n')
      : 'No matching grounded sources were retrieved for this question.';

    const matchContext = latestRun
      ? `Latest MatchRun (${latestRun.created_at}): ${latestRun.results
          .slice(0, 3)
          .map((r: any) => `overall ${r.overall} for course ${r.course_id.slice(0, 8)}`)
          .join('; ')}`
      : 'No match run yet for this student.';

    const system = `You are a senior study/migration consultant assistant for an education consultancy (Australia-first). You explain and ground answers; you never invent a ranking or score — the deterministic matching engine already produced any scores mentioned above, you only narrate them. Sources tagged "OUR CATALOGUE" are live rows from our own database of 3,500+ real Australian courses (real titles, fees, CRICOS codes) — if any are listed below, you MUST use them directly to answer course/fee/university questions (name the actual courses and fees given); do not say you need a match run first, that only applies to personalised ranking, not listing what exists. Every other factual claim about a rule, requirement, fee, or right MUST be attributed to one of the numbered sources below using [n]; if you cannot support a claim with a source, say it is unconfirmed instead of stating it as fact — never invent a specific number (a fee, a grant rate, a deadline) that isn't in a numbered source. Keep visa-risk commentary clearly separate from any match score.

RESPONSE STYLE — be direct, not formulaic:
- Lead with the actual answer in the first sentence. No throat-clearing ("It's worth noting that...", "There are several factors to consider...", "Great question..."). If the honest answer is "no" or a specific number, say that first, then support it.
- Structure for scannability, not for its own sake: a numbered list for steps/a process, a bullet list for 3+ distinct items (documents, requirements, options), short paragraphs for everything else. A one-fact answer doesn't need a list.
- Bold the few things a reader must not miss — a dollar figure, a deadline, a document name, a yes/no verdict. A handful of bold spans per answer, not whole sentences, not every number.
- Markdown is rendered, so use real **bold** and - bullets / 1. numbered lists, not asterisked plain text.
- Cite sources inline as [n]. Aim for the shortest complete answer — most questions need 80-200 words; let a genuinely multi-item list run longer rather than cramming it into prose.

Always end with: "${DISCLAIMER}"`;

    const userPrompt = [
      student ? `Student profile summary:\n${this.piiMinimisedProfileSummary(profile, student)}` : 'No student context provided (exploratory question).',
      matchContext,
      `Grounded sources:\n${contextBlock}`,
      `Question: ${message}`,
    ].join('\n\n');

    let text: string;
    try {
      text = await this.openrouter.chat([
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ]);
    } catch (e) {
      this.logger.warn(`chat generation failed, falling back to templated answer: ${(e as Error).message}`);
      degraded = true;
      text = allChunks.length
        ? `Based on the retrieved guidance: ${allChunks[0].text.slice(0, 300)}... [1]\n\n${DISCLAIMER}`
        : `I could not generate a grounded answer right now (AI service unavailable). Please try again shortly.\n\n${DISCLAIMER}`;
    }

    // Handles both "[5]" and combined "[5, 8]" citation styles.
    const citedIndices = [...text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)]
      .flatMap((m) => m[1].split(',').map((s) => parseInt(s.trim(), 10)));
    const citedChunks = [...new Set(citedIndices)]
      .map((i) => allChunks[i - 1])
      .filter(Boolean);
    // Different chunks of the same source document are still the same
    // reference to a reader — dedupe (first occurrence wins) so the UI
    // doesn't show the same source as two or three separate chips. Key by
    // source_url when there is one (multiple chunks of the same page);
    // sources with no public URL (an internal doc, a catalogue row) have no
    // URL to key on, so fall back to title — which is still per-document/
    // per-course distinct, so different catalogue courses don't collapse
    // into each other just for sharing an empty source_url.
    const seen = new Set<string>();
    const cites = citedChunks
      .filter((c) => {
        const key = c.source_url || c.title || c.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((c) => ({ chunk_id: c.id, source_url: c.source_url, title: c.title }));

    return {
      answer: text,
      cites,
      confidence: allChunks.length ? (degraded ? 0.5 : 0.75) : 0.3,
      passes_run: passes,
      degraded,
    };
  }
}
