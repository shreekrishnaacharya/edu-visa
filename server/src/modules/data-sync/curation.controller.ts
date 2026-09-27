import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurationService } from './curation.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../auth/auth-user.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';
import { CreateCurationSessionDto } from './dto/curation.dto';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // matches the university-document limit
const MAX_FILES = 5;

/**
 * Conversational data curation: hand the AI a URL, a file or an instruction and
 * it proposes updates to a university, course or admission policy.
 *
 * Proposals are staged as ordinary `sync_change` rows, so they are accepted and
 * applied through the same review endpoints as a CRICOS sync — this controller
 * never writes to the catalogue itself.
 */
@Controller('data-sync/curation')
@Roles(Role.SuperAdmin, Role.BranchAdmin)
export class CurationController {
  constructor(private readonly curation: CurationService) {}

  @Post('sessions')
  create(@Body() dto: CreateCurationSessionDto, @AuthUser() user: AuthUserPayload) {
    return this.curation.createSession(dto, user?.sub ?? null);
  }

  @Get('sessions')
  list(@Query('entity_id') entityId?: string) {
    return this.curation.listSessions(entityId);
  }

  @Get('sessions/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.curation.getSession(id);
  }

  /**
   * One turn. Multipart so an instruction, pasted URLs and file uploads can
   * arrive together: `content` (text), `urls` (repeated field or JSON array),
   * `files` (up to 5).
   */
  @Post('sessions/:id/messages')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES, { limits: { fileSize: MAX_FILE_SIZE } }))
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('content') content: string,
    @Body('urls') urls: string | string[] | undefined,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @AuthUser() user: AuthUserPayload,
  ) {
    return this.curation.sendMessage(
      id,
      { content: content ?? '', urls: this.parseUrls(urls), files: files ?? [] },
      user?.sub ?? null,
    );
  }

  /** `urls` may arrive as a JSON array, a repeated field, or one string. */
  private parseUrls(raw: string | string[] | undefined): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter((u) => typeof u === 'string');
      } catch {
        /* fall through to newline/comma splitting */
      }
    }
    return trimmed
      .split(/[\s,]+/)
      .map((u) => u.trim())
      .filter(Boolean);
  }
}
