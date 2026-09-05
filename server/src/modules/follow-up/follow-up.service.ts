import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommonService } from '../../common/services/common.service';
import { FollowUp } from './follow-up.entity';

@Injectable()
export class FollowUpService extends CommonService<FollowUp> {
  constructor(@InjectRepository(FollowUp) repo: Repository<FollowUp>) {
    super(repo);
  }
}
