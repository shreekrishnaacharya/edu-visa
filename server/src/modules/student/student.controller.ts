import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { PageDto } from '../../common/dto/page.dto';
import { StudentSearchDto } from './dto/student-search.dto';
import { StudentAggregate } from './student.types';
import { AuthUser } from '../auth/auth-user.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';
import { Role } from '../../common/enums';
import { ProfileService } from '../profile/profile.service';
import { AuditService } from '../audit/audit.service';

const CAN_READ_VISA = new Set([
  Role.Counsellor,
  Role.BranchAdmin,
  Role.SuperAdmin,
]);

@Controller('students')
export class StudentController {
  constructor(
    private readonly students: StudentService,
    private readonly profiles: ProfileService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(
    @Query() page: PageDto,
    @Query() search: StudentSearchDto,
    @AuthUser() user: AuthUserPayload,
  ) {
    // Tenancy is forced server-side from the token — never trusted from the client.
    if (user.branch_id) search.branch_id = user.branch_id;
    if (user.role === Role.Counsellor) search.counsellor_id = user.sub;

    const result = await this.students.list(page, search);
    const ids = result.elements.map((s) => s.id);
    const profileByStudent = await this.profiles.latestForMany(ids);
    return {
      ...result,
      elements: result.elements.map((s) => ({
        ...s,
        profile: profileByStudent.get(s.id) ?? null,
      })),
    };
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @AuthUser() user: AuthUserPayload) {
    const agg = await this.students.getAggregate(id);
    if (!CAN_READ_VISA.has(user.role) && !user.permissions.includes('visa:read')) {
      agg.visa_history = [];
    } else if (agg.visa_history.length) {
      await this.audit.record(user, id, 'visa_history:read');
    }
    if (agg.finance) await this.audit.record(user, id, 'financial:read');
    // Embed the latest derived profile (mirrors the list endpoint).
    const profile = await this.profiles.latest(id);
    return { ...agg, profile };
  }

  @Get(':id/visa-history')
  async visaHistory(@Param('id') id: string, @AuthUser() user: AuthUserPayload) {
    if (!CAN_READ_VISA.has(user.role) && !user.permissions.includes('visa:read')) {
      throw new ForbiddenException('visa_history requires the visa:read permission');
    }
    const agg = await this.students.getAggregate(id);
    await this.audit.record(user, id, 'visa_history:read');
    return agg.visa_history;
  }

  @Get(':id/profile')
  async profile(@Param('id') id: string) {
    return this.profiles.latestOrThrow(id);
  }

  @Post()
  create(@Body() dto: StudentAggregate, @AuthUser() user: AuthUserPayload) {
    if (user.role === Role.Counsellor) {
      dto.counsellor = user.email;
    }
    return this.students.createFromAggregate(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<StudentAggregate>) {
    return this.students.updateFromAggregate(id, dto);
  }
}
