import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentDocument } from './student-document.entity';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [TypeOrmModule.forFeature([StudentDocument]), KnowledgeModule],
  providers: [DocumentService],
  controllers: [DocumentController],
})
export class DocumentModule {}
