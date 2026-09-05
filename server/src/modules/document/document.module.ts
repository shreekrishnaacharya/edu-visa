import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentDocument } from './student-document.entity';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StudentDocument])],
  providers: [DocumentService],
  controllers: [DocumentController],
})
export class DocumentModule {}
