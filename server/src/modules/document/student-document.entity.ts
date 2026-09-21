import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AttachmentRef } from './attachment-ref';

export type DocExtractionStatus = 'pending' | 'extracting' | 'extracted' | 'failed';

@Entity('student_document')
export class StudentDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  student_id: string;

  /** e.g. "Bank statement", "Financial document" — free text with presets. */
  @Column()
  doc_type: string;

  @Column({ type: 'text', default: '' })
  remark: string;

  @Column({ type: 'jsonb' })
  file: AttachmentRef;

  @Column({ default: '' })
  uploaded_by: string;

  /** Vision-extracted structured fields — see document-extraction-schemas.ts. Never auto-applied to Side A records; a counsellor reviews and applies them manually. */
  @Column({ type: 'jsonb', nullable: true })
  extracted_data: Record<string, string> | null;

  @Column({ type: 'varchar', default: 'pending' })
  extraction_status: DocExtractionStatus;

  @Column({ type: 'text', nullable: true })
  extraction_error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
