import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchRun } from './match-run.entity';
import { Course } from '../course/course.entity';
import { University } from '../university/university.entity';
import { MatchService } from './match.service';
import { MatchController } from './match.controller';
import { StudentModule } from '../student/student.module';
import { ProfileModule } from '../profile/profile.module';
import { ReferenceModule } from '../reference/reference.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MatchRun, Course, University]),
    StudentModule,
    ProfileModule,
    ReferenceModule,
  ],
  providers: [MatchService],
  controllers: [MatchController],
  exports: [MatchService],
})
export class MatchModule {}
