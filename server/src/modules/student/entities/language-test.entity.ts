import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EnglishTest } from '../../../common/enums';
import { numericTransformer } from '../../../common/database/numeric.transformer';
import { Student } from './student.entity';

@Entity('language_test')
export class LanguageTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  student_id: string;

  @ManyToOne(() => Student, (s) => s.language_tests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar' })
  test: EnglishTest;

  @Column({ type: 'numeric', transformer: numericTransformer })
  overall: number;

  @Column({ type: 'numeric', nullable: true, transformer: numericTransformer })
  listening: number | null;

  @Column({ type: 'numeric', nullable: true, transformer: numericTransformer })
  reading: number | null;

  @Column({ type: 'numeric', nullable: true, transformer: numericTransformer })
  writing: number | null;

  @Column({ type: 'numeric', nullable: true, transformer: numericTransformer })
  speaking: number | null;

  @Column({ type: 'date', nullable: true })
  test_date: string | null;
}
