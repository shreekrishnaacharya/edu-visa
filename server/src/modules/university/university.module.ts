import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { University } from './university.entity';
import { UniversityService } from './university.service';
import { UniversityController } from './university.controller';

@Module({
  imports: [TypeOrmModule.forFeature([University])],
  providers: [UniversityService],
  controllers: [UniversityController],
  exports: [UniversityService],
})
export class UniversityModule {}
