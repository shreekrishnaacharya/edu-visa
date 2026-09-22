import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { University } from './university.entity';
import { AttachmentRef } from '../document/attachment-ref';
import { DocType } from '../knowledge/doc.entity';

export type ExtractionStatus = 'pending' | 'extracting' | 'extracted' | 'failed';
export type PolicyDraftStatus = 'pending' | 'drafting' | 'drafted' | 'failed' | 'not_applicable';

/**
 * An uploaded source document for one university (admission checklist, entry
 * requirement PDF, financial policy, etc). Pipeline: upload -> vision extract
 * -> save extracted text here -> ingest into the RAG `doc`/`doc_chunk` tables
 * (`doc_id` below points at the result). Keeping the file + extracted text
 * persisted (not just firing straight into ingestion) is what makes
 * re-upload / re-vision / re-ingest each independently possible: the vision
 * pass is the expensive, fallible step, so its output survives and can be
 * corrected or re-embedded without repeating it.
 */
@Entity('university_document')
export class UniversityDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  university_id: string;

  @ManyToOne(() => University, (u) => u.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'university_id' })
  university: University;

  @Column()
  title: string;

  @Column({ type: 'varchar', default: 'entry_requirement' })
  doc_type: DocType;

  @Column({ type: 'jsonb' })
  file: AttachmentRef;

  @Column({ type: 'text', nullable: true })
  extracted_text: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  extraction_status: ExtractionStatus;

  @Column({ type: 'text', nullable: true })
  extraction_error: string | null;

  /** The RAG `doc` row this was last ingested into, once ingested. */
  @Column({ type: 'uuid', nullable: true })
  doc_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_ingested_at: Date | null;

  @Column({ default: '' })
  uploaded_by: string;

  /**
   * Whether this document's extracted text was also structured into a real
   * `admission_policy` row (only attempted when `doc_type === 'entry_requirement'`
   * — PRODUCT_PLAN phase 7). 'not_applicable' for every other doc_type.
   */
  @Column({ type: 'varchar', default: 'pending' })
  policy_draft_status: PolicyDraftStatus;

  /** The admission_policy.key this document drafted/updated, once drafted. */
  @Column({ type: 'varchar', nullable: true })
  drafted_policy_key: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
