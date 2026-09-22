import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { CommonService } from '../../common/services/common.service';
import { StorageService } from '../../common/storage/storage.service';
import { pdfToPageImages } from '../../common/utils/pdf-to-images.util';
import { OpenRouterService } from '../knowledge/openrouter.service';
import { IngestionService } from '../knowledge/ingestion.service';
import { DocType } from '../knowledge/doc.entity';
import { AdmissionEligibilityService } from '../admission/admission-eligibility.service';
import { AdmissionPolicy, ScholarshipTier } from '../admission/admission-policy.types';
import { University } from './university.entity';
import { UniversityDocument } from './university-document.entity';
import { Course } from '../course/course.entity';
import { Scholarship } from '../course/scholarship.entity';

const VISION_PROMPT = `Extract all text from these document pages exactly as written, in reading order. Preserve headings, bullet points and tables as plain text (render tables as rows of "column: value" or simple aligned text). Do not summarise, paraphrase, or add commentary. Mark each page boundary with a line "--- Page N ---".`;

const DOC_TYPES: DocType[] = [
  'entry_requirement',
  'visa_guidance',
  'scholarship_terms',
  'cost_of_living',
  'institution_policy',
  'registry',
  'visa_statistics',
];

const CLASSIFY_PROMPT = `Classify this document into exactly one category: ${DOC_TYPES.join(', ')}.
"entry_requirement" = admission/Genuine Student criteria, academic/English score thresholds, sponsor/financial rules for ADMISSION (not visa) — most institution admission checklists belong here.
"visa_guidance" = visa application rules, conditions, work rights, grant periods.
"scholarship_terms" = scholarship eligibility, amounts, deadlines.
"cost_of_living" = living-cost estimates.
"institution_policy" = other institution policy (credit transfer, deferral, progression) not fitting the above.
"registry" = CRICOS/official registry listings.
"visa_statistics" = grant/refusal-rate data.
Output ONLY the category name from the list above, nothing else — no punctuation, no explanation.`;

// Reuses admission-policy.types.ts's own field-level semantics almost
// verbatim as instructions — they were written specifically to prevent the
// exact misreadings (the floor/ceiling sponsor-rule conflation bug found and
// fixed earlier this session is a real example) an LLM is just as likely to
// make as a human skimming the same document.
const POLICY_SCHEMA_PROMPT = `You are extracting a structured admission-eligibility policy from a real institution document. Output ONLY valid JSON matching this exact shape — no markdown, no commentary:

{
  "scope": string — who this document covers, e.g. "Nepalese applicants",
  "academics": [ { "level": "UG"|"PG"|"PG_RESEARCH"|"PATHWAY", "label": string (name the band/program — e.g. "Undergraduate (general)" or a named course), "min_canonical_score": number|null, "source_expression": string (how the source ACTUALLY phrased it, e.g. "3 CGPA (/4.0) or 75%"), "min_ielts_overall": number|null, "min_ielts_band": number|null, "min_pte_overall": number|null, "min_pte_band": number|null } ],
  "age_limit": { "ug_max": number, "pg_max": number, "research_max_low": number, "research_max_high": number, "note": string } or omit entirely if not stated,
  "study_gap_rules": string[] (narrative gap rules),
  "max_study_gap_months": [ { "level": "UG"|"PG"|"PG_RESEARCH"|"PATHWAY", "months": number, "note": string } ] — ONLY if the source gives an actual number, never inferred,
  "marriage_rules": string[] (narrative — e.g. "not accepted for undergraduate"),
  "min_marriage_months": number|null — ONLY if the source states an actual minimum marriage duration,
  "spouse_qualification_rule": { "required_equal": boolean, "min_level": "High School"|"Bachelor"|"PG Diploma"|"Master"|"PhD"|null, "note": string } or omit if not stated,
  "max_backlogs": [ { "level": "UG"|"PG"|"PG_RESEARCH"|"PATHWAY", "count": number, "note": string } ] — ONLY if the source gives an actual number,
  "double_masters_policy": string|null,
  "visa_refusal_policy": string|null,
  "sponsors": [ { "relation": string, "max_percent": number|null, "min_percent": number|null, "status": "accepted"|"recommended"|"conditional"|"not_accepted", "note": string } ],
  "max_sponsors": number|null,
  "scholarship_tiers": [ { "level": "UG"|"PG"|"PG_RESEARCH"|"PATHWAY", "label": string (how the source expressed the band, e.g. "GPA 2.8-3.19" or "70-74.99%"), "min_canonical_score": number (0-100 canonical, the LOWER bound of this band — same conversion rule as academics[].min_canonical_score), "pct": number (% of tuition), "note": string } ],
  "income_thresholds": [ { "scenario": string (e.g. "single applicant", "married applicant", "with dependant" — keep scenarios SEPARATE, never collapse into one number), "min_annual_npr_lakh": number|null, "min_annual_aud": number|null } ],
  "fund_seasoning_months": number|null,
  "excluded_banks": string[],
  "income_source_notes": string[],
  "scholarships": string[],
  "excluded_regions": string[],
  "gs_notes": string[],
  "document_checklist": string[],
  "campus_programs": [ { "campus": string, "programs": string[] } ] — ONLY if the source names a specific campus and which programs are offered there,
  "processing_turnaround": { "offer": string|null, "gs": string|null, "coe": string|null, "note": string } — ONLY if the source states indicative processing times, e.g. "Offer: 3-4 days",
  "contact_emails": [ { "label": string, "email": string } ] — real named contact points the source gives (e.g. separate Admissions/GS/Recruitment addresses),
  "country_tier_notes": string[] — narrative only: different entry pathways/rules by applicant home-country risk tier, if the source describes one (e.g. an "Assessment Level 1/2/3" system),
  "other_notes": string[]
}

CRITICAL — sponsors[].max_percent vs min_percent: "max_percent" is a CEILING (this relation may contribute AT MOST this %, e.g. "uncle/aunt capped at 20%"). "min_percent" is a FLOOR (AT LEAST this % must come from this relation, e.g. "minimum 70% from parents"). Putting a floor number into max_percent is backwards and makes a 100%-from-parents student incorrectly FAIL a "minimum 70%" rule — re-read this section carefully before answering.

CRITICAL — academics[].min_canonical_score is on a 0-100 canonical scale: a CGPA on a /4.0 scale converts as (cgpa/4)*100 (e.g. 3.0 CGPA -> 75); a raw percentage is already canonical; leave null if the source gives no academic figure for that band. scholarship_tiers[].min_canonical_score uses the SAME conversion.

CRITICAL — scholarship_tiers is ONLY for bands with an explicit numeric GPA/percentage cutoff tied to a specific %. A flat scholarship with no threshold (e.g. "25% to all applicants who meet entry requirements") is NOT a tier — put that in the narrative "scholarships" list instead, never invent a threshold for it.

Other rules: extract ONLY what the document actually states — never invent a number, never guess a figure that isn't written down. Omit a field (or use null/[]) rather than fabricate. If this document is NOT actually an admission/GS/sponsor-criteria document, return exactly {"scope": "not an admission-requirements document", "academics": [], "sponsors": [], "income_thresholds": [], "other_notes": []}.`;

/**
 * Upload -> vision -> save extracted text -> classify -> ingest to RAG, per
 * university document. `doc_type` is never asked of the uploader — it's
 * classified from the actual extracted text (a cheap classification call,
 * same pattern as OrchestratorService.route()), since asking a human to
 * pre-guess a taxonomy category before the system has even read the
 * document is backwards. Each step is independently re-runnable (re-upload
 * replaces the file and reruns everything; `reprocess` reruns vision +
 * classify + ingest from the stored file; `reingest` reruns only the RAG
 * ingest from the already-saved extracted text and classification) — see
 * UniversityDocument's class comment.
 */
@Injectable()
export class UniversityDocumentService extends CommonService<UniversityDocument> {
  private readonly logger = new Logger(UniversityDocumentService.name);

  constructor(
    @InjectRepository(UniversityDocument) repo: Repository<UniversityDocument>,
    @InjectRepository(University) private readonly universities: Repository<University>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(Scholarship) private readonly scholarshipRepo: Repository<Scholarship>,
    private readonly storage: StorageService,
    private readonly openrouter: OpenRouterService,
    private readonly ingestion: IngestionService,
    private readonly admission: AdmissionEligibilityService,
  ) {
    super(repo);
  }

  async listForUniversity(universityId: string): Promise<UniversityDocument[]> {
    return this.repo.find({ where: { university_id: universityId }, order: { created_at: 'DESC' } });
  }

  async withUrl(doc: UniversityDocument) {
    return { ...doc, url: await this.storage.presignedGetUrl(doc.file.storage_key) };
  }

  /** upload -> vision -> save extracted text -> classify -> ingest, in one pass. No doc_type input — see class comment. */
  async upload(
    universityId: string,
    file: Express.Multer.File,
    title: string,
    uploadedBy: string,
  ): Promise<UniversityDocument> {
    const university = await this.getUniversity(universityId);

    const key = this.storage.newKey('universities', universityId, file.originalname);
    await this.storage.put(key, file.buffer, file.mimetype);

    const row = await this.create({
      university_id: universityId,
      title: title || file.originalname,
      // Placeholder until classifyDocType() runs post-extraction below —
      // never shown as final since extraction_status stays 'pending'/'extracting'
      // until it's overwritten.
      doc_type: 'entry_requirement',
      uploaded_by: uploadedBy,
      extraction_status: 'pending',
      file: { name: file.originalname, type: file.mimetype, size: file.size, storage_key: key },
    } as Partial<UniversityDocument>);

    return this.runExtractionAndIngest(row.id, file.buffer, university);
  }

  /** Re-run vision + re-ingest from the stored file (extraction failed, or a manual fix needs redoing from scratch). */
  async reprocess(id: string): Promise<UniversityDocument> {
    const row = await this.getOne(id);
    const university = await this.getUniversity(row.university_id);
    const buffer = await this.storage.getBuffer(row.file.storage_key);
    return this.runExtractionAndIngest(id, buffer, university);
  }

  /** Re-run ONLY the RAG ingestion step from the already-saved extracted text — no vision call. */
  async reingest(id: string): Promise<UniversityDocument> {
    const row = await this.getOne(id);
    if (!row.extracted_text) {
      throw new NotFoundException(`document ${id} has no extracted text yet — reprocess it first`);
    }
    const university = await this.getUniversity(row.university_id);
    return this.ingestOnly(row, university.name);
  }

  /** Lets an admin correct vision-OCR mistakes before (re-)ingesting. Does not itself ingest. */
  async updateExtractedText(id: string, text: string): Promise<UniversityDocument> {
    return this.update(id, { extracted_text: text } as Partial<UniversityDocument>);
  }

  async removeAndPurge(id: string) {
    const row = await this.getOne(id);
    await this.storage.remove(row.file.storage_key);
    if (row.doc_id) await this.ingestion.deleteDoc(row.doc_id);
    return this.remove(id);
  }

  private async getUniversity(id: string): Promise<University> {
    const university = await this.universities.findOne({ where: { id } });
    if (!university) throw new NotFoundException(`university ${id} not found`);
    return university;
  }

  private async runExtractionAndIngest(
    id: string,
    pdfBuffer: Buffer,
    university: University,
  ): Promise<UniversityDocument> {
    await this.update(id, { extraction_status: 'extracting', extraction_error: null } as Partial<UniversityDocument>);
    let text: string;
    try {
      const pages = await pdfToPageImages(pdfBuffer);
      if (!pages.length) throw new Error('PDF produced no pages');
      text = await this.openrouter.visionExtractText(pages, VISION_PROMPT);
    } catch (e) {
      const message = (e as Error).message;
      this.logger.error(`Vision extraction failed for document ${id}: ${message}`);
      return this.update(id, {
        extraction_status: 'failed',
        extraction_error: message,
      } as Partial<UniversityDocument>);
    }
    const docType = await this.classifyDocType(text);
    let row = await this.update(id, {
      extraction_status: 'extracted',
      extracted_text: text,
      extraction_error: null,
      doc_type: docType,
    } as Partial<UniversityDocument>);
    row = await this.ingestOnly(row, university.name);
    return this.draftPolicy(row, text, university);
  }

  /**
   * When the document classifies as `entry_requirement`, draft a full
   * structured `AdmissionPolicy` from it (strong model — real reasoning over
   * a long document, not classification) and make it live for
   * AdmissionEligibilityService IMMEDIATELY, marked `ai_drafted` until an
   * admin edits it via `PATCH /admission/institutions/:key`. Any other
   * doc_type never attempts this — a cost-of-living or scholarship doc has
   * no business drafting admission rules. On any failure, the university's
   * existing policy (if any) is left untouched — never a partial overwrite.
   */
  private async draftPolicy(row: UniversityDocument, text: string, university: University): Promise<UniversityDocument> {
    if (row.doc_type !== 'entry_requirement') {
      return this.update(row.id, { policy_draft_status: 'not_applicable' } as Partial<UniversityDocument>);
    }
    await this.update(row.id, { policy_draft_status: 'drafting' } as Partial<UniversityDocument>);
    try {
      const policy = await this.structurePolicy(text, university.name);
      const key = university.policy_key || (await this.deriveKeyFor(university.name));
      await this.admission.upsertPolicy(key, university.name, { ...policy, key, institution: university.name }, {
        sourceDocumentId: row.id,
        reviewStatus: 'ai_drafted',
      });
      if (!university.policy_key) {
        await this.universities.update(university.id, { policy_key: key });
      }
      await this.syncScholarshipsFromPolicy(university.id, policy.scholarship_tiers ?? []);
      return this.update(row.id, {
        policy_draft_status: 'drafted',
        drafted_policy_key: key,
      } as Partial<UniversityDocument>);
    } catch (e) {
      const message = (e as Error).message;
      this.logger.error(`Policy drafting failed for document ${row.id}: ${message}`);
      return this.update(row.id, { policy_draft_status: 'failed' } as Partial<UniversityDocument>);
    }
  }

  /** Strong-model structured extraction — see POLICY_SCHEMA_PROMPT for the full field-level guardrails. */
  private async structurePolicy(text: string, universityName: string): Promise<AdmissionPolicy> {
    const raw = await this.openrouter.chat(
      [
        { role: 'system', content: POLICY_SCHEMA_PROMPT },
        { role: 'user', content: `Institution: ${universityName}\n\n${text.slice(0, 12000)}` },
      ],
      { maxTokens: 5000, temperature: 0 },
    );
    const jsonText = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(jsonText);
    return {
      source: `Uploaded document — ${universityName}`,
      academics: [],
      sponsors: [],
      income_thresholds: [],
      other_notes: [],
      scholarship_tiers: [],
      ...parsed,
    } as AdmissionPolicy;
  }

  /**
   * Auto-derived scholarship marker, tagged into `Scholarship.name` so a
   * redraft/reprocess can replace only its OWN previously-derived rows and
   * never touch anything an admin added or edited manually through the
   * catalogue CRUD UI.
   */
  private static readonly POLICY_SCHOLARSHIP_PREFIX = '[From admission policy] ';

  /**
   * Applies a policy's GPA-tiered scholarships to every existing course at
   * this university whose degree level matches a tier's level — this is
   * what actually makes them count in the match engine's existing
   * `scholarshipScore()` (server/src/modules/match/engine/score.ts), which
   * already reads `Course.scholarships` and compares a student's GPA
   * against `min_gpa` correctly; the gap was never the scoring logic, only
   * that nothing populated real per-institution scholarship rows before.
   * Always runs (even with an empty `tiers` array) so a redraft that drops
   * a previously-stated tier also clears the stale auto-derived row.
   */
  private async syncScholarshipsFromPolicy(universityId: string, tiers: ScholarshipTier[]): Promise<void> {
    const courses = await this.courses.find({ where: { university_id: universityId } });
    for (const course of courses) {
      const level = this.admission.programLevelFor(course.degree_level);
      await this.scholarshipRepo.delete({
        course_id: course.id,
        name: Like(`${UniversityDocumentService.POLICY_SCHOLARSHIP_PREFIX}%`),
      });
      const matching = tiers.filter((t) => t.level === level);
      if (!matching.length) continue;
      const rows = matching.map((t) =>
        this.scholarshipRepo.create({
          course_id: course.id,
          name: `${UniversityDocumentService.POLICY_SCHOLARSHIP_PREFIX}${t.label}`,
          pct: t.pct,
          min_gpa: t.min_canonical_score,
          criteria: t.note || `From the institution's admission-policy document (${t.label}).`,
        }),
      );
      await this.scholarshipRepo.save(rows);
    }
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /** Slugified from the name, deduped against existing policy keys so two similarly-named institutions never silently collide/overwrite. */
  private async deriveKeyFor(universityName: string): Promise<string> {
    const base = this.slugify(universityName);
    const existing = new Set((await this.admission.listPolicies()).map((p) => p.key));
    if (!existing.has(base)) return base;
    let n = 2;
    while (existing.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }

  /**
   * Reads the ACTUAL extracted text to pick a doc_type — a cheap
   * classification call (same cost/model class as OrchestratorService's
   * route()), not a guess made before the document was even read. Falls
   * back to 'entry_requirement' (the most common real case for these
   * uploads) on any failure rather than blocking the whole pipeline on a
   * classification hiccup.
   */
  private async classifyDocType(text: string): Promise<DocType> {
    try {
      const raw = await this.openrouter.chat(
        [
          { role: 'system', content: CLASSIFY_PROMPT },
          { role: 'user', content: text.slice(0, 3000) },
        ],
        { model: OpenRouterService.ROUTER_MODEL, maxTokens: 20, temperature: 0 },
      );
      const cleaned = raw.trim().toLowerCase().replace(/[^a-z_]/g, '');
      return DOC_TYPES.find((t) => t === cleaned) ?? 'entry_requirement';
    } catch (e) {
      this.logger.warn(`doc-type classification failed, defaulting to entry_requirement: ${(e as Error).message}`);
      return 'entry_requirement';
    }
  }

  private async ingestOnly(row: UniversityDocument, universityName: string): Promise<UniversityDocument> {
    const outcome = await this.ingestion.ingestText('', row.extracted_text!, {
      title: `${universityName} — ${row.title}`,
      doc_type: row.doc_type,
      country: 'AU',
      institution: universityName,
      publisher: universityName,
    });
    if (!outcome.ok) {
      return this.update(row.id, {
        extraction_error: `ingestion failed: ${outcome.reason}`,
      } as Partial<UniversityDocument>);
    }
    return this.update(row.id, {
      doc_id: outcome.docId ?? null,
      last_ingested_at: new Date(),
      extraction_error: null,
    } as Partial<UniversityDocument>);
  }
}
