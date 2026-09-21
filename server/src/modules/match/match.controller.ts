import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { MatchService } from './match.service';
import { RunMatchDto } from './dto/run-match.dto';
import { AuthUser } from '../auth/auth-user.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';
import { MatchWeights } from '../../common/enums';

@Controller()
export class MatchController {
  constructor(private readonly match: MatchService) {}

  @Post('match/runs')
  run(@Body() dto: RunMatchDto, @AuthUser() user: AuthUserPayload) {
    return this.match.run(dto.student_id, {
      weights: dto.weights as MatchWeights | undefined,
      limit: dto.limit,
      createdBy: user.email,
      persist: true,
    });
  }

  /** Compute-only, no persist — powers the live weight-slider re-rank. */
  @Post('match/preview')
  preview(@Body() dto: RunMatchDto, @AuthUser() user: AuthUserPayload) {
    return this.match.run(dto.student_id, {
      weights: dto.weights as MatchWeights | undefined,
      limit: dto.limit,
      createdBy: user.email,
      persist: false,
    });
  }

  @Get('match-runs/:id')
  async getOne(@Param('id') id: string) {
    return this.match.getOne(id);
  }

  @Get('students/:id/match-runs/latest')
  async latest(@Param('id') id: string) {
    const run = await this.match.latestForStudent(id);
    if (!run) throw new NotFoundException(`no match run yet for student ${id}`);
    return run;
  }

  /** Deadlines derived from this student's latest MatchRun, urgency-banded. */
  @Get('students/:id/deadlines')
  deadlinesForStudent(@Param('id') id: string) {
    return this.match.deadlinesForStudent(id);
  }

  /** Counsellor-wide deadline view across all students' latest MatchRuns. */
  @Get('deadlines')
  deadlinesAcrossStudents(@Query('filter') filter?: string) {
    return this.match.deadlinesAcrossStudents(filter);
  }
}
