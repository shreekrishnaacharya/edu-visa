import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommonService } from '../../common/services/common.service';
import { Course } from './course.entity';
import { PageDto } from '../../common/dto/page.dto';
import { CourseSearchDto } from './dto/course-search.dto';
import { CourseWriteDto } from './dto/course-write.dto';

@Injectable()
export class CourseService extends CommonService<Course> {
  constructor(@InjectRepository(Course) repo: Repository<Course>) {
    super(repo);
  }

  list(page: PageDto, search: CourseSearchDto) {
    // The catalogue grid reads only denormalised columns on `course`
    // (university_name / city / world_rank / country), so no relation join is
    // needed here.  (`is_relational` in a customQuery is not honoured by the
    // search library anyway — it falls through to a LIKE on the FK.)
    return super.list(page, search, []);
  }

  getOneWithRelations(id: string) {
    return this.getOne(id, { university: true, scholarships: true, course_intakes: true });
  }

  createFromDto(dto: CourseWriteDto) {
    return super.create(dto as any);
  }

  updateFromDto(id: string, dto: Partial<CourseWriteDto>) {
    return super.update(id, dto as any);
  }

  /**
   * Free-text catalogue lookup for the AI assistant (plan appendix — a
   * structured-data tool, not RAG: with 3,500+ real courses in the DB, an
   * exact query beats chunking prose about them). `keywords` are OR-matched
   * (each against title / field / university_name) rather than treated as one
   * substring — a whole question mangled into a single ILIKE phrase matches
   * nothing; a handful of extracted keywords reliably does.
   */
  async searchForAssistant(
    keywords: string[],
    opts: { degree_level?: string; country?: string; limit?: number } = {},
  ): Promise<Course[]> {
    const terms = keywords.filter((k) => k.length >= 3).slice(0, 5);
    if (!terms.length) return [];

    const build = (mode: 'AND' | 'OR') => {
      const qb = this.repo.createQueryBuilder('course').leftJoinAndSelect('course.scholarships', 'scholarships');
      const perTerm = terms.map(
        (_, i) => `(course.title ILIKE :k${i} OR course.field ILIKE :k${i} OR course.university_name ILIKE :k${i})`,
      );
      const params = Object.fromEntries(terms.map((t, i) => [`k${i}`, `%${t}%`]));
      qb.where(`(${perTerm.join(` ${mode} `)})`, params);
      if (opts.degree_level) qb.andWhere('course.degree_level = :level', { level: opts.degree_level });
      if (opts.country) qb.andWhere('course.country = :country', { country: opts.country });
      return qb.orderBy('course.world_rank', 'ASC').take(opts.limit ?? 8).getMany();
    };

    // "RMIT courses in cybersecurity" means BOTH must match — try that first;
    // fall back to OR (broader net) only if the strict match finds nothing.
    const strict = terms.length > 1 ? await build('AND') : [];
    return strict.length ? strict : build('OR');
  }
}
