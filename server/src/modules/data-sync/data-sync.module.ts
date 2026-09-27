import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { University } from '../university/university.entity';
import { Course } from '../course/course.entity';
import { AdmissionPolicyEntity } from '../admission/admission-policy.entity';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SyncRun } from './entities/sync-run.entity';
import { SyncChange } from './entities/sync-change.entity';
import { SourcePage } from './entities/source-page.entity';
import { CricosRegistryService } from './cricos-registry.service';
import { DiffService } from './diff.service';
import { SyncService, SYNC_QUEUE } from './sync.service';
import { SyncProcessor } from './sync.processor';
import { SyncController } from './sync.controller';
import { SiteFetchService } from './site-fetch.service';
import { PageDiscoveryService } from './page-discovery.service';
import { RequirementExtractionService } from './requirement-extraction.service';
import { SiteScrapeService } from './site-scrape.service';
import { CurationService } from './curation.service';
import { ConsistencyService } from './consistency.service';
import { AdmissionModule } from '../admission/admission.module';
import { CurationController } from './curation.controller';
import { CurationSession } from './entities/curation-session.entity';
import { CurationMessage } from './entities/curation-message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SyncRun,
      SyncChange,
      SourcePage,
      University,
      Course,
      AdmissionPolicyEntity,
      CurationSession,
      CurationMessage,
    ]),
    BullModule.registerQueue({ name: SYNC_QUEUE }),
    // For IngestionService/OpenRouterService: a scraped requirements page also
    // enters the RAG corpus so the AI can quote its wording with a real URL.
    KnowledgeModule,
    // AdmissionEligibilityService: consistency checks resolve a course's policy
    // band through the matcher's own rules rather than reimplementing them.
    AdmissionModule,
  ],
  controllers: [SyncController, CurationController],
  providers: [
    CricosRegistryService,
    DiffService,
    SyncService,
    SyncProcessor,
    SiteFetchService,
    PageDiscoveryService,
    RequirementExtractionService,
    SiteScrapeService,
    CurationService,
    ConsistencyService,
  ],
  exports: [SyncService, CricosRegistryService, DiffService, SiteFetchService, CurationService, ConsistencyService],
})
export class DataSyncModule {}
