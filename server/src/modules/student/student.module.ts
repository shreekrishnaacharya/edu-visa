import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from './entities/student.entity';
import { AcademicRecord } from './entities/academic-record.entity';
import { LanguageTest } from './entities/language-test.entity';
import { WorkExperience } from './entities/work-experience.entity';
import { CareerGoal } from './entities/career-goal.entity';
import { IncomeSource } from './entities/income-source.entity';
import { Asset } from './entities/asset.entity';
import { Liability } from './entities/liability.entity';
import { Sponsor } from './entities/sponsor.entity';
import { VisaHistory } from './entities/visa-history.entity';
import { Dependant } from './entities/dependant.entity';
import { Preferences } from './entities/preferences.entity';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
import { ProfileModule } from '../profile/profile.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Student,
      AcademicRecord,
      LanguageTest,
      WorkExperience,
      CareerGoal,
      IncomeSource,
      Asset,
      Liability,
      Sponsor,
      VisaHistory,
      Dependant,
      Preferences,
    ]),
    ProfileModule,
    AuditModule,
  ],
  providers: [StudentService],
  controllers: [StudentController],
  exports: [StudentService],
})
export class StudentModule {}
