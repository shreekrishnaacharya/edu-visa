import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommonService } from '../../common/services/common.service';
import { University } from './university.entity';

@Injectable()
export class UniversityService extends CommonService<University> {
  constructor(@InjectRepository(University) repo: Repository<University>) {
    super(repo);
  }
}
