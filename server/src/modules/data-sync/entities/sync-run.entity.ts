import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SyncChange } from './sync-change.entity';

export type SyncKind = 'cricos_register' | 'site_scrape' | 'ai_curation';

/**
 * `awaiting_review` is the resting state that makes this a user-driven process:
 * the job has fetched and diffed everything and now waits for someone to accept
 * or reject the staged changes.
 */
export type SyncStatus =
  | 'queued'
  | 'running'
  | 'awaiting_review'
  | 'applying'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface SyncTotals {
  /** Coarse progress for the polling UI. */
  step?: string;
  processed?: number;
  total?: number;
  created?: number;
  updated?: number;
  unchanged?: number;
  disappeared?: number;
  auto_applied?: number;
  accepted?: number;
  rejected?: number;
  applied?: number;
  failed?: number;
}

export interface SyncLogEntry {
  at: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

/** One invocation of a sync — the unit the UI polls and the audit record. */
@Entity('sync_run')
@Index(['kind', 'status'])
@Index(['created_at'])
export class SyncRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  kind: SyncKind;

  @Column({ type: 'varchar', default: 'queued' })
  status: SyncStatus;

  /** What the user asked for: staleness window, level filters, target ids. */
  // `any` rather than `unknown`: TypeORM's DeepPartial cannot express an
  // `unknown`-valued record, so `unknown` makes every repository update on this
  // entity a type error. These are free-form jsonb blobs either way.
  @Column({ type: 'jsonb', default: () => `'{}'` })
  params: Record<string, any>;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  totals: SyncTotals;

  /**
   * Upstream's own version marker — for CRICOS, the CKAN resource id and its
   * `last_modified`. Lets a later run say "the source file has not changed
   * since your last sync" instead of re-diffing 12,749 rows to prove it.
   */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  source_meta: Record<string, any>;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  log: SyncLogEntry[];

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at: Date | null;

  @OneToMany(() => SyncChange, (c) => c.sync_run)
  changes: SyncChange[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
