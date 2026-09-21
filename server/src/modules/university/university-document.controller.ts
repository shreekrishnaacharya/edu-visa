import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UniversityDocumentService } from './university-document.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../auth/auth-user.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

/**
 * Admin-only: upload / re-upload / re-vision / re-ingest a university's
 * source documents (admission checklists, entry-requirement PDFs, ...) —
 * upload -> vision extract -> save extracted text -> ingest to the RAG KB.
 * `admission-policy.data.ts` stays the hand-typed structured layer this
 * feeds narrative RAG coverage alongside, same split as the rest of the
 * knowledge base (see admission-policy.types.ts header).
 */
@Controller('universities/:universityId/documents')
@Roles(Role.SuperAdmin)
export class UniversityDocumentController {
  constructor(private readonly documents: UniversityDocumentService) {}

  @Get()
  async list(@Param('universityId') universityId: string) {
    const rows = await this.documents.listForUniversity(universityId);
    return Promise.all(rows.map((d) => this.documents.withUrl(d)));
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async upload(
    @Param('universityId') universityId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Body('doc_type') docType: string,
    @AuthUser() user: AuthUserPayload,
  ) {
    const doc = await this.documents.upload(universityId, file, title ?? '', docType ?? '', user.email);
    return this.documents.withUrl(doc);
  }

  /** Re-upload: replaces the file (new row) and reruns vision + ingest from scratch. */
  @Post(':id/reupload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async reupload(
    @Param('universityId') universityId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @AuthUser() user: AuthUserPayload,
  ) {
    const previous = await this.documents.getOne(id);
    await this.documents.removeAndPurge(id);
    const doc = await this.documents.upload(
      universityId,
      file,
      previous.title,
      previous.doc_type,
      user.email,
    );
    return this.documents.withUrl(doc);
  }

  /** Re-run vision + re-ingest from the already-stored file (e.g. extraction failed). */
  @Post(':id/reprocess')
  async reprocess(@Param('id') id: string) {
    const doc = await this.documents.reprocess(id);
    return this.documents.withUrl(doc);
  }

  /** Re-run only the RAG ingest from the already-saved extracted text — no vision call. */
  @Post(':id/reingest')
  async reingest(@Param('id') id: string) {
    const doc = await this.documents.reingest(id);
    return this.documents.withUrl(doc);
  }

  /** Correct vision-OCR mistakes before (re-)ingesting. */
  @Patch(':id')
  async updateText(@Param('id') id: string, @Body('extracted_text') text: string) {
    const doc = await this.documents.updateExtractedText(id, text);
    return this.documents.withUrl(doc);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documents.removeAndPurge(id);
  }
}
