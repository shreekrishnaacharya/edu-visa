import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './course.entity';
import { Scholarship } from './scholarship.entity';
import { CourseIntake } from './course-intake.entity';
import { University } from '../university/university.entity';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { CourseImportService } from './course-import.service';
import { CourseImportController } from './course-import.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Course, Scholarship, CourseIntake, University])],
  providers: [CourseService, CourseImportService],
  controllers: [CourseController, CourseImportController],
  exports: [CourseService],
})
export class CourseModule {}
