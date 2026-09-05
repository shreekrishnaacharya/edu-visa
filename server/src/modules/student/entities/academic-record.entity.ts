import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AcademicLevel, GpaScale } from '../../../common/enums';
import { numericTransformer } from '../../../common/database/numeric.transformer';
import { Student } from './student.entity';

@Entity('academic_record')
export class AcademicRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  student_id: string;

  @ManyToOne(() => Student, (s) => s.academic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar' })
  level: AcademicLevel;

  @Column()
  course: string;

  @Column({ default: '' })
  institution: string;

  @Column({ default: '' })
  country: string;

  @Column({ type: 'int', default: 0 })
  start_year: number;

  @Column({ type: 'int', default: 0 })
  end_year: number;

  @Column({ type: 'numeric', default: 0, transformer: numericTransformer })
  gpa_value: number;

  @Column({ type: 'varchar', default: '4.0' })
  gpa_scale: GpaScale;

  @Column({ type: 'int', default: 0 })
  gap_months: number;
}
