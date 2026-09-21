import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
import { bandUrgency, daysLeft, Urgency } from './deadline-urgency';

export interface DeadlineRow {
  student_id: string;
  student_name?: string;
  course_id: string;
  course_title: string;
  university_name: string;
  intake_term: string;
  application_deadline: string;
  days_left: number;
  urgency: Urgency;
}

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

  /** Deadlines derived from a student's latest MatchRun — see deadline-urgency.ts. */
  async deadlinesForStudent(studentId: string): Promise<DeadlineRow[]> {
    const run = await this.latestForStudent(studentId);
    if (!run) return [];
    const courseIds = run.results.filter((r) => !r.knockout).map((r) => r.course_id);
    if (!courseIds.length) return [];
    const courses = await this.courses.find({ where: { id: In(courseIds) } });
    return this.expandDeadlines(courses, () => studentId).sort((a, b) => a.days_left - b.days_left);
  }

  /**
   * Counsellor-wide view: every student's LATEST MatchRun, flattened to one
   * row per (student, course intake), banded by urgency. `filter` narrows to
   * 'urgent' (OVERDUE/CRITICAL/HIGH), 'week' (due within 7 days), or
   * 'overdue'; omitted/other returns everything.
   */
  async deadlinesAcrossStudents(filter?: string): Promise<DeadlineRow[]> {
    // One DISTINCT ON query for "latest run per student" — same raw-SQL
    // style already used for derived views elsewhere (RetrievalService).
    const latestRuns: { student_id: string; results: MatchRun['results']; full_name: string }[] =
      await this.runs.query(`
        SELECT DISTINCT ON (mr.student_id) mr.student_id, mr.results, s.full_name
        FROM match_run mr
        JOIN student s ON s.id = mr.student_id::uuid
        ORDER BY mr.student_id, mr.created_at DESC
      `);
    if (!latestRuns.length) return [];

    const courseIds = [...new Set(latestRuns.flatMap((r) => r.results.filter((x) => !x.knockout).map((x) => x.course_id)))];
    if (!courseIds.length) return [];
    const courses = await this.courses.find({ where: { id: In(courseIds) } });
    const coursesById = new Map(courses.map((c) => [c.id, c]));

    let rows: DeadlineRow[] = [];
    for (const run of latestRuns) {
      const studentCourses = run.results
        .filter((r) => !r.knockout)
        .map((r) => coursesById.get(r.course_id))
        .filter((c): c is Course => !!c);
      rows.push(...this.expandDeadlines(studentCourses, () => run.student_id, run.full_name));
    }

    if (filter === 'urgent') rows = rows.filter((r) => ['OVERDUE', 'CRITICAL', 'HIGH'].includes(r.urgency));
    else if (filter === 'week') rows = rows.filter((r) => r.days_left >= 0 && r.days_left <= 7);
    else if (filter === 'overdue') rows = rows.filter((r) => r.urgency === 'OVERDUE');

    return rows.sort((a, b) => a.days_left - b.days_left);
  }

  /**
   * One row per (course, intake). `course_intake` child rows exist in the
   * schema but aren't populated by seeding — every catalogue course carries
   * its own `application_deadline`/`next_intake_date` directly (what
   * engine/run.ts's knockout already reads), so that's the primary source;
   * any real `course_intakes` rows are used in addition where present.
   */
  private expandDeadlines(courses: Course[], studentId: (c: Course) => string, studentName?: string): DeadlineRow[] {
    const now = new Date();
    const rows: DeadlineRow[] = [];
    for (const course of courses) {
      if (course.course_intakes?.length) {
        for (const intake of course.course_intakes) {
          const dl = daysLeft(intake.application_deadline, now);
          rows.push({
            student_id: studentId(course),
            student_name: studentName,
            course_id: course.id,
            course_title: course.title,
            university_name: course.university_name,
            intake_term: intake.term,
            application_deadline: intake.application_deadline,
            days_left: dl,
            urgency: bandUrgency(dl),
          });
        }
      } else if (course.application_deadline) {
        const dl = daysLeft(course.application_deadline, now);
        rows.push({
          student_id: studentId(course),
          student_name: studentName,
          course_id: course.id,
          course_title: course.title,
          university_name: course.university_name,
          intake_term: course.intakes?.[0] ?? '',
          application_deadline: course.application_deadline,
          days_left: dl,
          urgency: bandUrgency(dl),
        });
      }
    }
    return rows;
  }
}
