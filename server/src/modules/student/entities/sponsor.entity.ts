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
}
