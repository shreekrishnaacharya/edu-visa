import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PassportStatus } from '../../../common/enums';
import { Student } from './student.entity';

@Entity('dependant')
export class Dependant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  student_id: string;

  @ManyToOne(() => Student, (s) => s.dependants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar', default: 'other' })
  relationship: 'spouse' | 'child' | 'parent' | 'other';

  @Column({ default: '' })
  full_name: string;

  @Column({ type: 'date', nullable: true })
  date_of_birth: string | null;

  /** Travelling with the student — adds to the visa financial-capacity requirement. */
  @Column({ default: false })
  accompanying: boolean;

  @Column({ type: 'varchar', default: 'none' })
  passport_status: PassportStatus;
}
