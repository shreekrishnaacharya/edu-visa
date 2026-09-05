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

@Entity('liability')
export class Liability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  student_id: string;

  @ManyToOne(() => Student, (s) => s.liabilities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ default: '' })
  kind: string;

  @Column({ type: 'text', transformer: encryptedNumber })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'NPR' })
  currency: Currency;

  @Column({ type: 'text', default: null, nullable: true, transformer: encryptedNumber })
  monthly_repayment: number;
}
