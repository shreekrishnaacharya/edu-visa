import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CurationMessage } from './curation-message.entity';
import { SyncEntityType } from './sync-change.entity';

/**
 * A conversation in which a counsellor hands the AI material — a URL, a file, an
 * instruction — and it proposes updates to a university, course or admission
 * policy.
 *
 * Exists because roughly half the largest providers block automated scraping, so
 * the fallback can't be "type it all in by hand". The session is bound to the
 * entity being curated so the model sees that entity's current values and can
 * propose a diff against them rather than inventing a record.
 *
 * Every proposal it makes lands as a `sync_change` on this session's
 * `sync_run`, which is why the accept/apply/audit machinery from the CRICOS
 * wizard applies unchanged here.
 */
@Entity('curation_session')
@Index(['entity_type', 'entity_id'])
export class CurationSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', default: '' })
  title: string;

  /** Null for a session not tied to one record (e.g. general visa-rule research). */
  @Column({ type: 'varchar', nullable: true })
  entity_type: SyncEntityType | null;

  @Column({ type: 'uuid', nullable: true })
  entity_id: string | null;

  /**
   * The single `sync_run` (kind `ai_curation`) that holds this session's staged
   * proposals. Created on the first proposal, not on session open.
   */
  @Column({ type: 'uuid', nullable: true })
  sync_run_id: string | null;

  @Column({ type: 'varchar', default: 'open' })
  status: 'open' | 'closed';

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @OneToMany(() => CurationMessage, (m) => m.session)
  messages: CurationMessage[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
