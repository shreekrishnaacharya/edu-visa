import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IPageSearch } from '@sksharma72000/nestjs-search-page';
import { CommonService } from '../../common/services/common.service';
import { Student } from './entities/student.entity';
import { PageDto } from '../../common/dto/page.dto';
import { StudentSearchDto } from './dto/student-search.dto';
import { StudentAggregate } from './student.types';
import { applyAggregate, toAggregate } from './student.mapper';
import { ProfileService } from '../profile/profile.service';

const RELATIONS = {
  academic: true,
  language_tests: true,
  work: true,
  career_goal: true,
  income_sources: true,
  assets: true,
  liabilities: true,
  sponsors: true,
  visa_history: true,
  dependants: true,
  preferences: true,
};

@Injectable()
export class StudentService extends CommonService<Student> {
  constructor(
    @InjectRepository(Student) repo: Repository<Student>,
    private readonly profiles: ProfileService,
  ) {
    super(repo);
  }

  async list(
    page: PageDto,
    search: StudentSearchDto,
    customQuery: IPageSearch[] = [],
  ) {
    const cq = [...customQuery];

    // Array-containment country filter — resolved to an id pre-filter rather
    // than a @PageSearch field (the search library's operators don't cover
    // Postgres array containment cleanly).
    const country = search['preferences.preferred_countries_like'];
    if (country) {
      const rows = await this.repo
        .createQueryBuilder('s')
        .select('s.id', 'id')
        .innerJoin('preferences', 'p', 'p.student_id = s.id')
        .where('p.preferred_countries @> ARRAY[:country]::text[]', { country })
        .getRawMany<{ id: string }>();
      const ids = rows.map((r) => r.id);
      // No match → force an empty result set.
      cq.push({
        column: 'id',
        operation: 'in',
        operator: 'and',
        value: ids.length ? ids : ['00000000-0000-0000-0000-000000000000'],
      });
    }

    return super.list(page, search, cq);
  }

  async getAggregate(id: string): Promise<StudentAggregate> {
    const student = await this.repo.findOne({ where: { id }, relations: RELATIONS });
    if (!student) throw new NotFoundException(`student ${id} not found`);
    return toAggregate(student);
  }

  async createFromAggregate(agg: StudentAggregate): Promise<StudentAggregate> {
    const student = this.repo.create();
    applyAggregate(student, agg);
    const saved = await this.repo.save(student);
    const full = await this.repo.findOneOrFail({ where: { id: saved.id }, relations: RELATIONS });
    await this.profiles.deriveAndSave(full);
    return toAggregate(full);
  }

  async updateFromAggregate(id: string, agg: Partial<StudentAggregate>): Promise<StudentAggregate> {
    const student = await this.repo.findOne({ where: { id }, relations: RELATIONS });
    if (!student) throw new NotFoundException(`student ${id} not found`);
    applyAggregate(student, agg);
    await this.repo.save(student);
    const full = await this.repo.findOneOrFail({ where: { id }, relations: RELATIONS });
    await this.profiles.deriveAndSave(full);
    return toAggregate(full);
  }

  getEntityWithRelations(id: string) {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }
}
