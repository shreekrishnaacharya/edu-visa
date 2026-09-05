import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Currency } from '../../../common/enums';
import { encryptedNumber } from '../../../common/database/encrypted.transformer';
import { Student } from './student.entity';

export type IncomeKind =
  | 'father'
  | 'mother'
  | 'spouse'
  | 'self'
  | 'business'
  | 'rental'
  | 'other';

@Entity('income_source')
export class IncomeSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  student_id: string;

  @ManyToOne(() => Student, (s) => s.income_sources, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar', default: 'other' })
  kind: IncomeKind;

  /** PII — encrypted at rest (PRODUCT_PLAN §8). Stored as text. */
  @Column({ type: 'text', transformer: encryptedNumber })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'NPR' })
  currency: Currency;

  @Column({ default: false })
  evidence: boolean;
}
