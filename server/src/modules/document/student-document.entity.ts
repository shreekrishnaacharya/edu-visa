import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AttachmentRef } from './attachment-ref';

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

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
