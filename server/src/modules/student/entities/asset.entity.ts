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

export type AssetKind =
  | 'bank savings'
  | 'fixed deposit'
  | 'education loan'
  | 'property'
  | 'sponsor'
  | 'other';

@Entity('asset')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  student_id: string;

  @ManyToOne(() => Student, (s) => s.assets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar', default: 'other' })
  kind: AssetKind;

  @Column({ type: 'text', transformer: encryptedNumber })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'NPR' })
  currency: Currency;

  @Column({ default: true })
  liquid: boolean;
}
