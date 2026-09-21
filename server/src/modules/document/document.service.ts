import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommonService } from '../../common/services/common.service';
import { StorageService } from '../../common/storage/storage.service';
import { pdfToPageImages, PageImage } from '../../common/utils/pdf-to-images.util';
import { OpenRouterService } from '../knowledge/openrouter.service';
import { StudentDocument } from './student-document.entity';
import { DOCUMENT_EXTRACTION_SCHEMAS } from './document-extraction-schemas';

@Injectable()
export class DocumentService extends CommonService<StudentDocument> {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectRepository(StudentDocument) repo: Repository<StudentDocument>,
    private readonly storage: StorageService,
    private readonly openrouter: OpenRouterService,
  ) {
    super(repo);
  }

  async upload(
    studentId: string,
    file: Express.Multer.File,
    docType: string,
    remark: string,
    uploadedBy: string,
  ): Promise<StudentDocument> {
    const key = this.storage.newKey('students', studentId, file.originalname);
    await this.storage.put(key, file.buffer, file.mimetype);
    return this.create({
      student_id: studentId,
      doc_type: docType,
      remark,
      uploaded_by: uploadedBy,
      file: {
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        storage_key: key,
      },
    } as Partial<StudentDocument>);
  }

  async withUrl(doc: StudentDocument) {
    return { ...doc, url: await this.storage.presignedGetUrl(doc.file.storage_key) };
  }

  async removeAndPurge(id: string) {
    const doc = await this.getOne(id);
    await this.storage.remove(doc.file.storage_key);
    return this.remove(id);
  }

  /**
   * Vision-extracts structured fields from an already-uploaded document into
   * `extracted_data` — reuses the same pipeline built for university
   * documents (pdfToPageImages + OpenRouterService.visionExtractText).
   * Deliberately does NOT write into academic_record/language_test/sponsor:
   * which row to update is a counsellor judgment call, applied manually
   * through the existing student PATCH endpoints.
   */
  async extract(id: string, schemaKey: string): Promise<StudentDocument> {
    const schema = DOCUMENT_EXTRACTION_SCHEMAS[schemaKey];
    if (!schema) {
      throw new BadRequestException(
        `Unknown extraction schema "${schemaKey}". Supported: ${Object.keys(DOCUMENT_EXTRACTION_SCHEMAS).join(', ')}`,
      );
    }

    const doc = await this.getOne(id);
    await this.update(id, { extraction_status: 'extracting', extraction_error: null } as Partial<StudentDocument>);

    try {
      const buffer = await this.storage.getBuffer(doc.file.storage_key);
      const pages: PageImage[] = doc.file.type === 'application/pdf'
        ? await pdfToPageImages(buffer)
        : [{ base64: buffer.toString('base64'), mime: doc.file.type }];
      if (!pages.length) throw new Error('document produced no pages to read');

      const raw = await this.openrouter.visionExtractText(pages, schema.prompt);
      const cleaned = raw.replace(/```json\s*|```/g, '').trim();
      let extracted: Record<string, string>;
      try {
        extracted = JSON.parse(cleaned);
      } catch {
        extracted = { raw_text: cleaned };
      }

      return this.update(id, {
        extracted_data: extracted,
        extraction_status: 'extracted',
        extraction_error: null,
      } as Partial<StudentDocument>);
    } catch (e) {
      const message = (e as Error).message;
      this.logger.error(`Extraction failed for document ${id}: ${message}`);
      return this.update(id, {
        extraction_status: 'failed',
        extraction_error: message,
      } as Partial<StudentDocument>);
    }
  }
}
