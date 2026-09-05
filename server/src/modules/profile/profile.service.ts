import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentProfile } from './student-profile.entity';
import { Student } from '../student/entities/student.entity';
import { toEngineStudent } from '../student/student.mapper';
import { deriveProfile } from '../match/engine/derive';
import { ReferenceService } from '../reference/reference.service';
import { DerivedProfile } from '../match/engine/types';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(StudentProfile)
    private readonly repo: Repository<StudentProfile>,
    private readonly reference: ReferenceService,
  ) {}

  /**
   * Recompute + persist a new version of the student's profile (PRODUCT_PLAN
   * §3 — computed, versioned, out of the intake write path).  Called by
   * StudentService after any Side A write.
   */
  async deriveAndSave(student: Student): Promise<StudentProfile> {
    const priorCount = await this.repo.count({ where: { student_id: student.id } });
    const engineStudent = toEngineStudent(student);
    const derived: DerivedProfile = deriveProfile(
      engineStudent,
      priorCount + 1,
      this.reference.fxTable(),
    );
    const row = this.repo.create({ ...derived });
    return this.repo.save(row);
  }

  async latest(studentId: string): Promise<StudentProfile | null> {
    return this.repo.findOne({
      where: { student_id: studentId },
      order: { version: 'DESC' },
    });
  }

  async latestOrThrow(studentId: string): Promise<StudentProfile> {
    const p = await this.latest(studentId);
    if (!p) throw new NotFoundException(`No profile derived yet for student ${studentId}`);
    return p;
  }

  async latestForMany(studentIds: string[]): Promise<Map<string, StudentProfile>> {
    if (!studentIds.length) return new Map();
    const rows = await this.repo
      .createQueryBuilder('p')
      .distinctOn(['p.student_id'])
      .where('p.student_id IN (:...ids)', { ids: studentIds })
      .orderBy('p.student_id')
      .addOrderBy('p.version', 'DESC')
      .getMany();
    return new Map(rows.map((r) => [r.student_id, r]));
  }
}
