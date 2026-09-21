import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { University } from './university.entity';
import { UniversityDocument } from './university-document.entity';
import { UniversityService } from './university.service';
import { UniversityDocumentService } from './university-document.service';
import { UniversityController } from './university.controller';
import { UniversityDocumentController } from './university-document.controller';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [TypeOrmModule.forFeature([University, UniversityDocument]), KnowledgeModule],
  providers: [UniversityService, UniversityDocumentService],
  controllers: [UniversityController, UniversityDocumentController],
  exports: [UniversityService, UniversityDocumentService],
})
export class UniversityModule {}
