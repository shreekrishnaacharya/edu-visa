import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** What kind of fact a page is the source for. Drives both re-pull scheduling
 *  and the context handed to the AI when it needs to find a given fact. */
export type DataKind =
  | 'cricos_register'
  | 'english_requirements'
  | 'entry_requirements'
  | 'fees'
  | 'scholarships'
  | 'intakes'
  | 'visa_rules'
  | 'cost_of_living'
  | 'other';

/**
 * How much a page's content can be trusted, per PLAN.md §Appendix-A's source
 * table. Recorded rather than inferred at read time so a fact keeps the tier it
 * was captured under even if the registry's rules later change.
 */
export type TrustTier = 'authoritative' | 'reliable' | 'unverified';

export type FetchStatus =
  | 'ok'
  | 'unchanged'
  | 'blocked_by_robots'
  | 'http_error'
  | 'fetch_error'
  | 'never_fetched';

/**
 * The known-source registry: every URL the system has successfully read a fact
 * from, what kind of data lives there, and when it was last checked.
 *
 * Serves two jobs at once. (1) Provenance — a course's English band can point
 * at the exact page it came from, so it can be re-pulled when stale instead of
 * silently ageing. (2) Retrieval context — the conversational curator reads
 * this table to learn where a given fact has been found before, so it looks in
 * known-good places rather than re-discovering a university's site every time.
 */
@Entity('source_page')
@Index(['entity_type', 'entity_id'])
@Index(['last_fetched_at'])
export class SourcePage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  url: string;

  /** Denormalised for per-domain rate limiting and trust-tier rules. */
  @Column({ type: 'varchar' })
  domain: string;

  @Column({ type: 'varchar', default: 'unverified' })
  trust_tier: TrustTier;

  @Column({ type: 'text', array: true, default: '{}' })
  data_kinds: DataKind[];

  /**
   * What this page actually holds, in a sentence — AI-drafted on first
   * successful extraction, editable by a counsellor. This is the field that
   * makes the registry useful as AI context rather than just a URL list.
   */
  @Column({ type: 'text', default: '' })
  description: string;

  /** Null for a global source (visa rules, cost of living). */
  @Column({ type: 'varchar', nullable: true })
  entity_type: 'university' | 'course' | 'admission_policy' | null;

  @Column({ type: 'uuid', nullable: true })
  entity_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_fetched_at: Date | null;

  /** Last fetch where the content hash actually moved — the real staleness signal. */
  @Column({ type: 'timestamptz', nullable: true })
  last_changed_at: Date | null;

  /** sha256 of the cleaned text, so an unchanged page costs no LLM call. */
  @Column({ type: 'varchar', nullable: true })
  content_hash: string | null;

  @Column({ type: 'int', nullable: true })
  http_status: number | null;

  @Column({ type: 'varchar', default: 'never_fetched' })
  fetch_status: FetchStatus;

  @Column({ type: 'boolean', default: true })
  robots_allowed: boolean;

  /** Set when a human confirmed this page really is the right source. */
  @Column({ type: 'uuid', nullable: true })
  verified_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  verified_at: Date | null;

  @Column({ type: 'text', default: '' })
  notes: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
