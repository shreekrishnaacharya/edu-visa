import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SyncRun } from './sync-run.entity';

export type SyncEntityType = 'university' | 'course' | 'admission_policy';

/**
 * `disappeared` = present in our catalogue but no longer in the upstream
 * register (deregistered, expired, or renamed). Never auto-deleted: a provider
 * dropping out of one monthly export is not proof the row should go, and a
 * deletion would cascade to its courses.
 */
export type ChangeType = 'create' | 'update' | 'unchanged' | 'disappeared';

export type ChangeDecision = 'pending' | 'accepted' | 'rejected' | 'applied';

/** Per-field before → after, so the review UI can show exactly what moved. */
export interface FieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

/**
 * One staged change awaiting (or recording) a decision. Everything a sync would
 * write lands here first — including the changes that auto-apply, so the
 * auto-applied set stays auditable after the fact rather than being invisible.
 */
@Entity('sync_change')
@Index(['sync_run_id', 'entity_type', 'change_type'])
@Index(['sync_run_id', 'decision'])
export class SyncChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  sync_run_id: string;

  @ManyToOne(() => SyncRun, (r) => r.changes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sync_run_id' })
  sync_run: SyncRun;

  @Column({ type: 'varchar' })
  entity_type: SyncEntityType;

  /** Null for a `create` — there is no row yet. */
  @Column({ type: 'uuid', nullable: true })
  entity_id: string | null;

  /** CRICOS provider code / course code: how upstream identifies this record. */
  @Column({ type: 'varchar', nullable: true })
  natural_key: string | null;

  /** Human label for the review grid, so it needn't join to the entity. */
  @Column({ type: 'text', default: '' })
  label: string;

  @Column({ type: 'varchar' })
  change_type: ChangeType;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  field_diffs: FieldDiff[];

  /** The full upstream record, so an accepted `create` can be applied later. */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  payload: Record<string, any>;

  /**
   * True when the tiered policy applied this without asking: government
   * register facts only. AI-extracted values are never auto-applied.
   */
  @Column({ type: 'boolean', default: false })
  auto_applied: boolean;

  @Column({ type: 'varchar', default: 'pending' })
  decision: ChangeDecision;

  /** Which page this change was read off, when it came from a scrape. */
  @Column({ type: 'uuid', nullable: true })
  source_page_id: string | null;

  /** 0-1, only meaningful for AI extraction. Null for register data, which is exact. */
  @Column({ type: 'real', nullable: true })
  confidence: number | null;

  @Column({ type: 'uuid', nullable: true })
  decided_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decided_at: Date | null;

  @Column({ type: 'text', nullable: true })
  apply_error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
