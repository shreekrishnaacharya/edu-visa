import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchRun } from './match-run.entity';
import { Course } from '../course/course.entity';
import { University } from '../university/university.entity';
import { StudentService } from '../student/student.service';
import { toEngineStudent } from '../student/student.mapper';
import { ProfileService } from '../profile/profile.service';
import { ReferenceService } from '../reference/reference.service';
import { rankCourses } from './engine/run';
import { DEFAULT_WEIGHTS, ENGINE_VERSION, normalizeWeights } from './engine/weights';
import { EngineCourse, EngineUniversity } from './engine/types';
import { MatchWeights } from '../../common/enums';

export interface RunMatchOptions {
  weights?: MatchWeights;
  limit?: number;
  createdBy?: string;
  persist?: boolean;
  conversationId?: string | null;
}

@Injectable()
export class MatchService {
  constructor(
    @InjectRepository(MatchRun) private readonly runs: Repository<MatchRun>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(University) private readonly universities: Repository<University>,
    private readonly students: StudentService,
    private readonly profiles: ProfileService,
    private readonly reference: ReferenceService,
  ) {}

  async run(studentId: string, opts: RunMatchOptions = {}): Promise<MatchRun> {
    const student = await this.students.getEntityWithRelations(studentId);
    if (!student) throw new NotFoundException(`student ${studentId} not found`);

    // Uses the CURRENT persisted profile — profile versions are bumped only by
    // StudentService on Side A writes, never by running/previewing a match.
    const profileRow = await this.profiles.latestOrThrow(studentId);
    const engineStudent = toEngineStudent(student);

    const [courseRows, uniRows] = await Promise.all([
      this.courses.find({ relations: { scholarships: true } }),
      this.universities.find(),
    ]);

    const engineCourses: EngineCourse[] = courseRows.map((c) => ({
      id: c.id,
      university_id: c.university_id,
      title: c.title,
      degree_level: c.degree_level,
      field: c.field,
      duration_months: c.duration_months,
      tuition_fee: c.tuition_fee,
      application_deadline: c.application_deadline,
      next_intake_date: c.next_intake_date,
      intakes: c.intakes,
      entry: c.entry,
      scholarships: c.scholarships?.map((s) => ({ name: s.name, pct: s.pct, min_gpa: s.min_gpa })) ?? [],
      career_outcomes: c.career_outcomes,
    }));
    const universitiesById = new Map<string, EngineUniversity>(
      uniRows.map((u) => [
        u.id,
        { id: u.id, name: u.name, country: u.country, city: u.city, world_rank: u.world_rank },
      ]),
    );

    const weights = normalizeWeights(opts.weights ?? DEFAULT_WEIGHTS);
    const results = rankCourses({
      profile: profileRow,
      student: engineStudent,
      courses: engineCourses,
      universitiesById,
      weights,
      limit: opts.limit ?? 8,
      fxRates: this.reference.fxTable(),
    });

    const run = this.runs.create({
      student_id: studentId,
      profile_version: profileRow.version,
      engine_version: ENGINE_VERSION,
      weights,
      results,
      profile: profileRow,
      created_by: opts.createdBy ?? student.counsellor,
      conversation_id: opts.conversationId ?? null,
    });

    if (opts.persist === false) return run; // computed, not saved — powers "preview"
    return this.runs.save(run);
  }

  async latestForStudent(studentId: string): Promise<MatchRun | null> {
    return this.runs.findOne({
      where: { student_id: studentId },
      order: { created_at: 'DESC' },
    });
  }

  async getOne(id: string): Promise<MatchRun> {
    const row = await this.runs.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`match run ${id} not found`);
    return row;
  }
}
