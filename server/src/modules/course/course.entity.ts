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
import { CourseCampus } from './course-campus.entity';
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

  /** The campuses that actually teach this course (register-sourced). */
  @OneToMany(() => CourseCampus, (cc) => cc.course)
  campuses: CourseCampus[];

  /**
   * The cities from `campuses`, denormalised for matching and filtering — the
   * same trade already made for `university_name`/`city`/`world_rank`. Reading
   * the join on every match run cost ~55% more latency, and filtering through it
   * needed a 3,393-element id list for Melbourne alone. Empty means the register
   * lists no teaching location for this course, which matching treats as "the
   * provider's primary city only", never "everywhere it operates".
   */
  @Column({ type: 'text', array: true, default: '{}' })
  campus_cities: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  career_outcomes: string[];

  /** AU: CRICOS course code (required for the Australia release). */
  @Column({ type: 'varchar', nullable: true })
  cricos: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  verified_at: Date | null;

  /** Last automated read from upstream — see University.last_fetched_at. */
  @Column({ type: 'timestamptz', nullable: true })
  last_fetched_at: Date | null;

  /** sha256 of the upstream register fields, so an unchanged row is cheap to skip. */
  @Column({ type: 'varchar', nullable: true })
  content_hash: string | null;

  /**
   * 'verified' = the CRICOS-import / human-verified Tier-1 catalogue this
   * system was built to treat as ground truth. 'unverified_aggregator' =
   * sourced from third-party aggregators (Mastersportal, Shiksha,
   * Collegedunia, ...) because the institution's own site blocked automated
   * fetches — figures may be stale or conflict with the real current price.
   * Read by OrchestratorService to pick the citation tag/wording so the AI
   * never states an unverified fee with the same confidence as a real one.
   */
  @Column({ type: 'varchar', default: 'verified' })
  data_confidence: 'verified' | 'unverified_aggregator';

  /** Where an 'unverified_aggregator' figure actually came from — shown to the counsellor, not the student. */
  @Column({ type: 'text', default: '' })
  source_note: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
