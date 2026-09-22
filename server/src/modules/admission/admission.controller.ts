import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { AdmissionEligibilityService } from './admission-eligibility.service';
import { CheckEligibilityDto } from './dto/check-eligibility.dto';
import { StudentService } from '../student/student.service';
import { ProfileService } from '../profile/profile.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../common/enums';
import { AdmissionPolicy } from './admission-policy.types';

@Controller('admission')
export class AdmissionController {
  constructor(
    private readonly eligibility: AdmissionEligibilityService,
    private readonly students: StudentService,
    private readonly profiles: ProfileService,
  ) {}

  /** DB-backed real institution admission-policy briefings — the 9 originally hand-typed ones, plus any drafted since via university-document upload (PRODUCT_PLAN phase 7). */
  @Get('institutions')
  list() {
    return this.eligibility.listPolicies();
  }

  @Get('institutions/:key')
  getPolicy(@Param('key') key: string) {
    return this.eligibility.getPolicy(key);
  }

  /**
   * Admin correction of a policy — the ONLY way a policy's `review_status`
   * moves from `ai_drafted` (populated automatically by the upload
   * pipeline's structuring pass, live immediately, never gated) to
   * `reviewed`. Saving here always marks it reviewed, even if nothing
   * actually changed — the point is a human looked at it.
   */
  @Roles(Role.SuperAdmin)
  @Patch('institutions/:key')
  async updatePolicy(@Param('key') key: string, @Body() data: AdmissionPolicy) {
    const existing = await this.eligibility.getPolicy(key);
    return this.eligibility.upsertPolicy(key, data.institution || existing.institution, { ...existing, ...data }, { reviewStatus: 'reviewed' });
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
