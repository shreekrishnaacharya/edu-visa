import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AcademicLevel, PassportStatus } from '../../../common/enums';
import { Student } from './student.entity';

@Entity('dependant')
export class Dependant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  student_id: string;

  @ManyToOne(() => Student, (s) => s.dependants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar', default: 'other' })
  relationship: 'spouse' | 'child' | 'parent' | 'other';

  @Column({ default: '' })
  full_name: string;

  @Column({ type: 'date', nullable: true })
  date_of_birth: string | null;

  /** Travelling with the student — adds to the visa financial-capacity requirement. */
  @Column({ default: false })
  accompanying: boolean;

  @Column({ type: 'varchar', default: 'none' })
  passport_status: PassportStatus;

  /**
   * Spouse-only in practice (relationship === 'spouse'), but not enforced at
   * the column level. Several real admission policies gate on marriage
   * duration ("minimum 12 months for postgraduate") — see
   * `admission/admission-eligibility.service.ts` `maritalChecks`.
   */
  @Column({ type: 'date', nullable: true })
  marriage_date: string | null;

  /** Spouse's own academic level — several policies require it match/exceed the applicant's ("equal qualification"). */
  @Column({ type: 'varchar', nullable: true })
  qualification_level: AcademicLevel | null;
}
