import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Country, Currency, DegreeLevel } from '../../common/enums';
import { numericTransformer } from '../../common/database/numeric.transformer';
import { University } from '../university/university.entity';
import { Scholarship } from './scholarship.entity';
import { CourseIntake } from './course-intake.entity';
import { EntryRequirement, EMPTY_ENTRY_REQUIREMENT } from './entry-requirement';

@Entity('course')
@Index(['country', 'degree_level', 'field'])
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  university_id: string;

  @ManyToOne(() => University, (u) => u.courses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'university_id' })
  university: University;

  /** Denormalised from the university for the catalogue grid + filtering. */
  @Column()
  university_name: string;

  @Column({ type: 'varchar', length: 2 })
  country: Country;

  @Column()
  city: string;

  @Column({ type: 'int', default: 999 })
  world_rank: number;

  @Column()
  title: string;

  @Column({ type: 'varchar' })
  degree_level: DegreeLevel;

  @Column()
  field: string;

  @Column({ type: 'int' })
  duration_months: number;

  /** per year. */
  @Column({ type: 'numeric', transformer: numericTransformer })
  tuition_fee: number;

  @Column({ type: 'varchar', length: 3, default: 'AUD' })
  currency: Currency;

  @Column({ type: 'text', array: true, default: '{}' })
  intakes: string[];

  @Column({ type: 'date' })
  next_intake_date: string;

  @Column({ type: 'date' })
  application_deadline: string;

  @Column({ type: 'jsonb', default: () => `'${JSON.stringify(EMPTY_ENTRY_REQUIREMENT)}'` })
  entry: EntryRequirement;

  @OneToMany(() => Scholarship, (s) => s.course, { cascade: true, eager: true })
  scholarships: Scholarship[];

  @OneToMany(() => CourseIntake, (i) => i.course, { cascade: true, eager: true })
  course_intakes: CourseIntake[];

  @Column({ type: 'text', array: true, default: '{}' })
  career_outcomes: string[];

  /** AU: CRICOS course code (required for the Australia release). */
  @Column({ type: 'varchar', nullable: true })
  cricos: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  verified_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
