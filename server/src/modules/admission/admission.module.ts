import { Module } from '@nestjs/common';
import { AdmissionEligibilityService } from './admission-eligibility.service';
import { AdmissionController } from './admission.controller';
import { StudentModule } from '../student/student.module';
import { ProfileModule } from '../profile/profile.module';
import { ReferenceModule } from '../reference/reference.module';

@Module({
  imports: [StudentModule, ProfileModule, ReferenceModule],
  providers: [AdmissionEligibilityService],
  controllers: [AdmissionController],
  exports: [AdmissionEligibilityService],
})
export class AdmissionModule {}
