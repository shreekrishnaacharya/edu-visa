import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DocChunk } from './doc-chunk.entity';

export type DocType =
  | 'visa_guidance'
  | 'entry_requirement'
  | 'scholarship_terms'
  | 'cost_of_living'
  | 'institution_policy'
  | 'registry'
  | 'visa_statistics';

/**
 * A source document (a fetched page) — RAG Tier 2, PRODUCT_PLAN §6.2 /
 * plan appendix A. `doc_chunk` rows hold the actual embedded, retrievable text.
 */
@Entity('doc')
export class Doc {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  source_url: string;

  @Column({ default: '' })
  title: string;

  @Column({ type: 'varchar' })
  doc_type: DocType;

  @Column({ type: 'varchar', length: 2, default: 'AU' })
  @Index()
  country: string;

  @Column({ type: 'varchar', nullable: true })
  institution: string | null;

  @Column({ default: '' })
  publisher: string;

  /** When the source itself says the info took effect / was published. */
  @Column({ type: 'date', nullable: true })
  effective_date: string | null;

  /** Re-verify after this date — surfaced as a staleness flag in reports. */
  @Column({ type: 'date', nullable: true })
  review_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  fetched_at: Date;

  @OneToMany(() => DocChunk, (c) => c.doc, { cascade: true })
  chunks: DocChunk[];
}
