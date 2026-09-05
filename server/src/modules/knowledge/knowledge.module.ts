import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doc } from './doc.entity';
import { DocChunk } from './doc-chunk.entity';
import { OpenRouterService } from './openrouter.service';
import { IngestionService } from './ingestion.service';
import { RetrievalService } from './retrieval.service';
import { WebFetchService } from './web-fetch.service';
import { KnowledgeController } from './knowledge.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Doc, DocChunk])],
  providers: [OpenRouterService, IngestionService, RetrievalService, WebFetchService],
  controllers: [KnowledgeController],
  exports: [OpenRouterService, IngestionService, RetrievalService, WebFetchService],
})
export class KnowledgeModule {}
