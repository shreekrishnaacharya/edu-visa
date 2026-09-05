import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { FollowUpService } from './follow-up.service';
import { PageDto } from '../../common/dto/page.dto';
import { FollowUpSearchDto } from './dto/follow-up-search.dto';
import { FollowUp } from './follow-up.entity';
import { AuthUser } from '../auth/auth-user.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';

@Controller('follow-ups')
export class FollowUpController {
  constructor(private readonly followUps: FollowUpService) {}

  @Get()
  list(@Query() page: PageDto, @Query() search: FollowUpSearchDto) {
    return this.followUps.list(page, search);
  }

  @Post()
  create(@Body() dto: Partial<FollowUp>, @AuthUser() user: AuthUserPayload) {
    return this.followUps.create({ ...dto, author: dto.author ?? user.email });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.followUps.remove(id);
  }
}
