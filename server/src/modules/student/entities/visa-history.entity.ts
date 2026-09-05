import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { encryptedString } from '../../../common/database/encrypted.transformer';
import { Student } from './student.entity';

export type VisaOutcome = 'granted' | 'refused' | 'withdrawn';

/**
 * The whole visa-history table is sensitive (PRODUCT_PLAN §8): free-text fields
 * are encrypted at rest and reads are gated behind their own permission
 * (see VisaHistoryController + the `visa:read` policy).
 */
@Entity('visa_history')
export class VisaHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  student_id: string;

  @ManyToOne(() => Student, (s) => s.visa_history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'text', transformer: encryptedString })
  country: string;

  @Column({ type: 'text', transformer: encryptedString })
  visa_type: string;

  @Column({ type: 'varchar', default: 'granted' })
  outcome: VisaOutcome;

  @Column({ type: 'date', nullable: true })
  decision_date: string | null;

  @Column({ type: 'text', nullable: true, transformer: encryptedString })
  refusal_reason: string | null;
}
