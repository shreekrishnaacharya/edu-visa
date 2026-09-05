import { Body, Controller, Get, Post } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { RetrievalService } from './retrieval.service';
import { IngestDto, IngestTextDto, SearchDto } from './dto/ingest.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../common/enums';
import { DocType } from './doc.entity';

@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly ingestion: IngestionService,
    private readonly retrieval: RetrievalService,
  ) {}

  @Roles(Role.SuperAdmin)
  @Post('ingest')
  async ingest(@Body() dto: IngestDto) {
    const results = await this.ingestion.ingestMany(
      dto.items.map((i) => ({
        url: i.url,
        meta: { ...i.meta, doc_type: i.meta.doc_type as DocType, country: i.meta.country ?? 'AU' },
      })),
    );
    return { results, stats: await this.ingestion.stats() };
  }

  @Roles(Role.SuperAdmin)
  @Post('ingest-text')
  async ingestText(@Body() dto: IngestTextDto) {
    const results = await Promise.all(
      dto.items.map((i) =>
        this.ingestion.ingestText(i.source_url, i.text, {
          ...i.meta,
          doc_type: i.meta.doc_type as DocType,
          country: i.meta.country ?? 'AU',
        }),
      ),
    );
    return { results, stats: await this.ingestion.stats() };
  }

  @Get('stats')
  stats() {
    return this.ingestion.stats();
  }

  @Post('search')
  search(@Body() dto: SearchDto) {
    return this.retrieval.retrieve(dto.query, {
      country: dto.country,
      doc_type: dto.doc_type as DocType | undefined,
      institution: dto.institution,
    });
  }
}
