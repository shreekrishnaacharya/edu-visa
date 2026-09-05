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
