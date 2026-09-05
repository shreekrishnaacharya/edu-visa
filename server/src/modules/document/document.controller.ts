import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentService } from './document.service';
import { PageDto } from '../../common/dto/page.dto';
import { DocumentSearchDto } from './dto/document-search.dto';
import { AuthUser } from '../auth/auth-user.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

@Controller('documents')
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Get()
  async list(@Query() page: PageDto, @Query() search: DocumentSearchDto) {
    const result = await this.documents.list(page, search);
    const elements = await Promise.all(result.elements.map((d) => this.documents.withUrl(d)));
    return { ...result, elements };
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('student_id') studentId: string,
    @Body('doc_type') docType: string,
    @Body('remark') remark: string,
    @AuthUser() user: AuthUserPayload,
  ) {
    const doc = await this.documents.upload(studentId, file, docType, remark ?? '', user.email);
    return this.documents.withUrl(doc);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documents.removeAndPurge(id);
  }
}
