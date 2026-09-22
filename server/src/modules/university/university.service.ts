import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, Repository } from 'typeorm';
import { IPageSearch, Page } from '@sksharma72000/nestjs-search-page';
import { CommonService } from '../../common/services/common.service';
import { PageDto } from '../../common/dto/page.dto';
import { University } from './university.entity';
import { Course } from '../course/course.entity';

export interface UniversityCourseStats {
  total: number;
  with_scholarships: number;
  with_cricos: number;
  unverified_fee: number;
}

export type UniversityWithStats = University & { course_stats: UniversityCourseStats };

const EMPTY_STATS: UniversityCourseStats = { total: 0, with_scholarships: 0, with_cricos: 0, unverified_fee: 0 };

/**
 * Extends the plain CRUD wrapper with a computed, non-persisted
 * `course_stats` field on every returned row (PRODUCT_PLAN phase 9) — how
 * many of this university's courses have scholarship data, a CRICOS code,
 * or an unverified fee, so the frontend can render a data-completeness
 * indicator without an extra fetch per row. One batched aggregate query per
 * list page / single getOne, never N+1.
 */
@Injectable()
export class UniversityService extends CommonService<University> {
  constructor(
    @InjectRepository(University) repo: Repository<University>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
  ) {
    super(repo);
  }

  async list(page: PageDto, queryDto: object, customQuery: IPageSearch[] = []): Promise<Page<UniversityWithStats>> {
    const result = await super.list(page, queryDto, customQuery);
    const stats = await this.courseStatsFor(result.elements.map((u) => u.id));
    return {
      ...result,
      elements: result.elements.map((u) => ({ ...u, course_stats: stats.get(u.id) ?? EMPTY_STATS })),
    };
  }

  async getOne(id: string, relations?: FindOptionsRelations<University>, customQuery: IPageSearch[] = []): Promise<UniversityWithStats> {
    const uni = await super.getOne(id, relations, customQuery);
    const stats = await this.courseStatsFor([uni.id]);
    return { ...uni, course_stats: stats.get(uni.id) ?? EMPTY_STATS };
  }

  private async courseStatsFor(universityIds: string[]): Promise<Map<string, UniversityCourseStats>> {
    if (!universityIds.length) return new Map();
    const rows = await this.courses
      .createQueryBuilder('c')
      .leftJoin('c.scholarships', 's')
      .select('c.university_id', 'university_id')
      .addSelect('COUNT(DISTINCT c.id)', 'total')
      .addSelect('COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN c.id END)', 'with_scholarships')
      .addSelect('COUNT(DISTINCT CASE WHEN c.cricos IS NOT NULL THEN c.id END)', 'with_cricos')
      .addSelect("COUNT(DISTINCT CASE WHEN c.data_confidence = 'unverified_aggregator' THEN c.id END)", 'unverified_fee')
      .where('c.university_id IN (:...ids)', { ids: universityIds })
      .groupBy('c.university_id')
      .getRawMany<{ university_id: string; total: string; with_scholarships: string; with_cricos: string; unverified_fee: string }>();
    return new Map(
      rows.map((r) => [
        r.university_id,
        {
          total: Number(r.total),
          with_scholarships: Number(r.with_scholarships),
          with_cricos: Number(r.with_cricos),
          unverified_fee: Number(r.unverified_fee),
        },
      ]),
    );
  }
}
