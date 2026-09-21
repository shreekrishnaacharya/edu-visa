import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MatchWeights } from '../../common/enums';
import { MatchResult } from './match.types';
import { StudentProfileSnapshot } from './match.types';

/**
 * A frozen recommendation (PRODUCT_PLAN §3): the profile version it ran against,
 * the engine version, the weights, and the full ranked results.  Stays
 * reproducible after the student's file or the catalogue changes.
 */
@Entity('match_run')
export class MatchRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  student_id: string;

  @Column({ type: 'int' })
  profile_version: number;

  @Column()
  engine_version: string;

  @Column({ type: 'jsonb' })
  weights: MatchWeights;

  /** Whether a real institution's not_eligible verdict was allowed to knock a course out of this run's ranked results (PRODUCT_PLAN phase 4) — a live, per-run toggle, defaulting on. */
  @Column({ type: 'boolean', default: true })
  enforce_admission_eligibility: boolean;

  /** "What-if" overrides applied on top of the real profile/preferences for this run (PRODUCT_PLAN phase 5) — null when none were used. `profile` below already reflects the EFFECTIVE (overridden) values; this is the record of what was deliberately changed. */
  @Column({ type: 'jsonb', nullable: true })
  profile_override: Record<string, unknown> | null;

  @Column({ type: 'jsonb', default: '[]' })
  results: MatchResult[];

  @Column({ type: 'jsonb' })
  profile: StudentProfileSnapshot;

  @Column({ default: '' })
  created_by: string;

  /** Opens the seam to the chat phase — a run triggered from a conversation. */
  @Column({ type: 'uuid', nullable: true })
  conversation_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
