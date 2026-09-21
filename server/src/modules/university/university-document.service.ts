import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommonService } from '../../common/services/common.service';
import { StorageService } from '../../common/storage/storage.service';
import { pdfToPageImages } from '../../common/utils/pdf-to-images.util';
import { OpenRouterService } from '../knowledge/openrouter.service';
import { IngestionService } from '../knowledge/ingestion.service';
import { University } from './university.entity';
import { UniversityDocument } from './university-document.entity';

const VISION_PROMPT = `Extract all text from these document pages exactly as written, in reading order. Preserve headings, bullet points and tables as plain text (render tables as rows of "column: value" or simple aligned text). Do not summarise, paraphrase, or add commentary. Mark each page boundary with a line "--- Page N ---".`;

/**
 * Upload -> vision -> save extracted text -> ingest to RAG, per university
 * document. Each step is independently re-runnable (re-upload replaces the
 * file and reruns everything; `reprocess` reruns vision + ingest from the
 * stored file; `reingest` reruns only the RAG ingest from the already-saved
 * extracted text) — see UniversityDocument's class comment.
 */
@Injectable()
export class UniversityDocumentService extends CommonService<UniversityDocument> {
  private readonly logger = new Logger(UniversityDocumentService.name);

  constructor(
    @InjectRepository(UniversityDocument) repo: Repository<UniversityDocument>,
    @InjectRepository(University) private readonly universities: Repository<University>,
    private readonly storage: StorageService,
    private readonly openrouter: OpenRouterService,
    private readonly ingestion: IngestionService,
  ) {
    super(repo);
  }

  async listForUniversity(universityId: string): Promise<UniversityDocument[]> {
    return this.repo.find({ where: { university_id: universityId }, order: { created_at: 'DESC' } });
  }

  async withUrl(doc: UniversityDocument) {
    return { ...doc, url: await this.storage.presignedGetUrl(doc.file.storage_key) };
  }

  /** upload -> vision -> save extracted text -> ingest, in one pass. */
  async upload(
    universityId: string,
    file: Express.Multer.File,
    title: string,
    docType: string,
    uploadedBy: string,
  ): Promise<UniversityDocument> {
    const university = await this.getUniversity(universityId);

    const key = this.storage.newKey('universities', universityId, file.originalname);
    await this.storage.put(key, file.buffer, file.mimetype);

    const row = await this.create({
      university_id: universityId,
      title: title || file.originalname,
      doc_type: (docType || 'entry_requirement') as UniversityDocument['doc_type'],
      uploaded_by: uploadedBy,
      extraction_status: 'pending',
      file: { name: file.originalname, type: file.mimetype, size: file.size, storage_key: key },
    } as Partial<UniversityDocument>);

    return this.runExtractionAndIngest(row.id, file.buffer, university.name);
  }

  /** Re-run vision + re-ingest from the stored file (extraction failed, or a manual fix needs redoing from scratch). */
  async reprocess(id: string): Promise<UniversityDocument> {
    const row = await this.getOne(id);
    const university = await this.getUniversity(row.university_id);
    const buffer = await this.storage.getBuffer(row.file.storage_key);
    return this.runExtractionAndIngest(id, buffer, university.name);
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
    universityName: string,
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
    const row = await this.update(id, {
      extraction_status: 'extracted',
      extracted_text: text,
      extraction_error: null,
    } as Partial<UniversityDocument>);
    return this.ingestOnly(row, universityName);
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
