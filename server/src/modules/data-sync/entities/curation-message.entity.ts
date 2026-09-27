import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CurationSession } from './curation-session.entity';
import { AttachmentRef } from '../../document/attachment-ref';

/** What the user attached to a turn, and what came of reading it. */
export interface CurationAttachment {
  kind: 'url' | 'file';
  /** For a url: the address. For a file: its original name. */
  label: string;
  url?: string;
  file?: AttachmentRef;
  /** Whether the content could actually be read, and why not if it couldn't. */
  status: 'read' | 'failed';
  reason?: string;
  /** Characters of text recovered — lets the UI show "read 12,400 characters". */
  chars?: number;
  /** The `source_page` row this URL was recorded as, so provenance survives. */
  source_page_id?: string;
}

/** A field the assistant proposes changing, with the evidence for it. */
export interface ProposedChange {
  entity_type: 'university' | 'course' | 'admission_policy';
  /** Null when the proposal creates a record rather than editing one. */
  entity_id: string | null;
  label: string;
  field: string;
  before: unknown;
  after: unknown;
  /** Verbatim supporting text from the supplied material. */
  quote: string;
  /** Which attachment (url or filename) the quote came from. */
  cited: string;
  confidence: number;
  /** The `sync_change` row staged for this proposal, once staged. */
  sync_change_id?: string;
}

@Entity('curation_message')
@Index(['session_id', 'created_at'])
export class CurationMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  session_id: string;

  @ManyToOne(() => CurationSession, (s) => s.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: CurationSession;

  @Column({ type: 'varchar' })
  role: 'user' | 'assistant';

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  attachments: CurationAttachment[];

  /**
   * Proposals made in this turn. Held on the message as well as staged as
   * `sync_change` rows so the chat can show what it suggested and what the user
   * decided, without re-querying the run.
   */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  proposals: ProposedChange[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
