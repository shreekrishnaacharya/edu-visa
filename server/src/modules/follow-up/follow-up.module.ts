import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FollowUp } from './follow-up.entity';
import { FollowUpService } from './follow-up.service';
import { FollowUpController } from './follow-up.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FollowUp])],
  providers: [FollowUpService],
  controllers: [FollowUpController],
})
export class FollowUpModule {}
