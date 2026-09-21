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

@Entity('sponsor')
export class Sponsor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  student_id: string;

  @ManyToOne(() => Student, (s) => s.sponsors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ default: '' })
  relationship: string;

  @Column({ default: '' })
  occupation: string;

  @Column({ type: 'text', transformer: encryptedNumber })
  annual_income: number;

  @Column({ type: 'varchar', length: 3, default: 'NPR' })
  currency: Currency;

  @Column({ default: false })
  evidence: boolean;

  /**
   * The bank/financial institution funds are held with or come through — not
   * an account number, just the institution name (e.g. "Nabil Bank"). Several
   * real admission policies exclude specific banks (`AdmissionPolicy.excluded_banks`);
   * previously that could only be surfaced as an unverifiable note.
   */
  @Column({ default: '' })
  bank_name: string;
}
