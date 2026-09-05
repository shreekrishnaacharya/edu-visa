import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AcademicLevel, PrIntent } from '../../common/enums';
import { numericTransformer } from '../../common/database/numeric.transformer';

/**
 * Computed + versioned derivation of a student's Side A file (PRODUCT_PLAN §3).
 * One row per (student, version); the newest version is the current profile.
 * Never written on the intake path — recomputed by ProfileService on any Side A
 * change.  Financial fields are aggregates in AUD, not raw balances.
 */
@Entity('student_profile')
@Index(['student_id', 'version'], { unique: true })
export class StudentProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  student_id: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'numeric', default: 0, transformer: numericTransformer })
  canonical_gpa: number;

  @Column({ type: 'numeric', nullable: true, transformer: numericTransformer })
  english_band: number | null;

  @Column({ default: 'no test on file' })
  english_source: string;

  @Column({ type: 'int', default: 0 })
  relevant_experience_months: number;

  @Column({ type: 'numeric', default: 0, transformer: numericTransformer })
  annual_household_income_aud: number;

  @Column({ type: 'numeric', default: 0, transformer: numericTransformer })
  available_funds_aud: number;

  @Column({ type: 'numeric', default: 0, transformer: numericTransformer })
  affordability_score: number;

  @Column({ type: 'varchar', default: 'low' })
  pr_intent: PrIntent;

  @Column({ type: 'varchar', nullable: true })
  highest_level: AcademicLevel | null;

  @Column({ default: '' })
  field_of_study: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
