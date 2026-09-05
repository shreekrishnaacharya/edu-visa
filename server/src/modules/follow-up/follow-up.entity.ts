import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AttachmentRef } from '../document/attachment-ref';

export type FollowUpKind = 'note' | 'call' | 'email' | 'meeting' | 'document';

/** A counsellor's follow-up / activity entry against a student. */
@Entity('follow_up')
export class FollowUp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  student_id: string;

  @Column({ type: 'varchar', default: 'note' })
  kind: FollowUpKind;

  @Column({ type: 'text', default: '' })
  body: string;

  @Column({ default: '' })
  author: string;

  @Column({ type: 'jsonb', default: '[]' })
  attachments: AttachmentRef[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
