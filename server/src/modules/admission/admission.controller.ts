import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { AdmissionEligibilityService } from './admission-eligibility.service';
import { CheckEligibilityDto } from './dto/check-eligibility.dto';
import { StudentService } from '../student/student.service';
import { ProfileService } from '../profile/profile.service';

@Controller('admission')
export class AdmissionController {
  constructor(
    private readonly eligibility: AdmissionEligibilityService,
    private readonly students: StudentService,
    private readonly profiles: ProfileService,
  ) {}

  /** The 9 real institution admission-policy briefings this was built from — see admission-policy.data.ts header. */
  @Get('institutions')
  list() {
    return this.eligibility.listPolicies();
  }

  @Get('institutions/:key')
  getPolicy(@Param('key') key: string) {
    return this.eligibility.getPolicy(key);
  }

  /**
   * The actual "is this student eligible for admission here" check — real
   * institution rules (academic score, English score, age, marriage/
   * dependant, sponsor income, visa-refusal history) evaluated against the
   * student's real derived profile. Distinct from `/match/*`, which scores
   * catalogue *courses* for fit; this checks a specific *institution's*
   * admission gate, prior to and separate from any visa question.
   */
  @Post('check-eligibility')
  async check(@Body() dto: CheckEligibilityDto) {
    const student = await this.students.getEntityWithRelations(dto.student_id);
    if (!student) throw new NotFoundException(`student ${dto.student_id} not found`);
    const profile = await this.profiles.latest(dto.student_id);
    return this.eligibility.evaluate(dto.policy_key, student, profile, {
      level: dto.level,
      courseLabel: dto.course_label,
    });
  }
}
