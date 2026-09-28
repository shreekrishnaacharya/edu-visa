import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { ConsistencyService } from './consistency.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../auth/auth-user.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';
import {
  DecideChangesDto,
  ListChangesDto,
  ListSourcePagesDto,
  StartCricosRunDto,
  StartSiteScrapeDto,
  UpdateSourcePageDto,
} from './dto/sync.dto';
import { SyncKind } from './entities/sync-run.entity';

/**
 * Drives the catalogue data-sync wizard. Reads are open to counsellors so they
 * can see how fresh the catalogue is; anything that starts a run or writes to
 * the catalogue is super-admin only, matching the rest of the admin surface.
 */
@Controller('data-sync')
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly consistency: ConsistencyService,
  ) {}

  /**
   * Where the course-level English band disagrees with the institution policy
   * that governs it. The two hold the same fact for different consumers — the
   * matcher scores on the course row, the eligibility verdict reads the policy —
   * so a disagreement means one report can quote two different bars.
   */
  @Roles(Role.SuperAdmin, Role.BranchAdmin, Role.Counsellor)
  @Get('consistency')
  consistencyCheck() {
    return this.consistency.checkEntryConsistency();
  }

  /** Dry run by default; pass `?apply=true` to write. */
  @Roles(Role.SuperAdmin)
  @Post('consistency/reconcile')
  reconcile(@Query('apply') apply?: string) {
    return this.consistency.reconcileEntryFromPolicies(apply !== 'true');
  }

  @Roles(Role.SuperAdmin, Role.BranchAdmin, Role.Counsellor)
  @Get('sources/cricos/status')
  cricosStatus() {
    return this.sync.cricosStatus();
  }

  @Roles(Role.SuperAdmin)
  @Post('runs/cricos')
  startCricos(@Body() dto: StartCricosRunDto, @AuthUser() user: AuthUserPayload) {
    return this.sync.queueRun('cricos_register', { ...dto }, user?.sub ?? null);
  }

  @Roles(Role.SuperAdmin)
  @Post('runs/site-scrape')
  startSiteScrape(@Body() dto: StartSiteScrapeDto, @AuthUser() user: AuthUserPayload) {
    return this.sync.queueRun('site_scrape', { ...dto }, user?.sub ?? null);
  }

  /** Coverage of the per-institution requirement sourcing. */
  @Roles(Role.SuperAdmin, Role.BranchAdmin, Role.Counsellor)
  @Get('sources/status')
  sourcesStatus() {
    return this.sync.sourcesStatus();
  }

  /** Institutions the scraper has established it cannot read. */
  @Roles(Role.SuperAdmin, Role.BranchAdmin, Role.Counsellor)
  @Get('sources/blocked')
  blockedInstitutions(@Query() q: ListSourcePagesDto) {
    return this.sync.listBlockedInstitutions({ skip: q.skip, take: q.take });
  }

  @Roles(Role.SuperAdmin, Role.BranchAdmin, Role.Counsellor)
  @Get('sources')
  listSources(@Query() q: ListSourcePagesDto) {
    return this.sync.listSourcePages(q);
  }

  @Roles(Role.SuperAdmin, Role.BranchAdmin)
  @Patch('sources/:id')
  updateSource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSourcePageDto,
    @AuthUser() user: AuthUserPayload,
  ) {
    return this.sync.updateSourcePage(id, dto, user?.sub ?? null);
  }

  @Roles(Role.SuperAdmin, Role.BranchAdmin, Role.Counsellor)
  @Get('runs')
  listRuns(@Query('kind') kind?: SyncKind, @Query('limit') limit?: string) {
    return this.sync.listRuns(kind, limit ? parseInt(limit, 10) : 25);
  }

  @Roles(Role.SuperAdmin, Role.BranchAdmin, Role.Counsellor)
  @Get('runs/:id')
  getRun(@Param('id', ParseUUIDPipe) id: string) {
    return this.sync.getRun(id);
  }

  @Roles(Role.SuperAdmin, Role.BranchAdmin, Role.Counsellor)
  @Get('runs/:id/summary')
  summary(@Param('id', ParseUUIDPipe) id: string) {
    return this.sync.changeSummary(id);
  }

  @Roles(Role.SuperAdmin, Role.BranchAdmin, Role.Counsellor)
  @Get('runs/:id/changes')
  listChanges(@Param('id', ParseUUIDPipe) id: string, @Query() q: ListChangesDto) {
    return this.sync.listChanges(id, q);
  }

  @Roles(Role.SuperAdmin)
  @Patch('runs/:id/changes')
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideChangesDto,
    @AuthUser() user: AuthUserPayload,
  ) {
    const userId = user?.sub ?? null;
    if (dto.all) {
      return this.sync.decideAll(
        id,
        dto.decision,
        { entity_type: dto.entity_type, change_type: dto.change_type },
        userId,
      );
    }
    return this.sync.decide(id, dto.ids ?? [], dto.decision, userId);
  }

  @Roles(Role.SuperAdmin)
  @Post('runs/:id/apply')
  apply(@Param('id', ParseUUIDPipe) id: string) {
    return this.sync.applyRun(id);
  }

  @Roles(Role.SuperAdmin)
  @Delete('runs/:id')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.sync.cancelRun(id);
  }
}
