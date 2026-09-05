import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LongTermGoal } from '../../../common/enums';
import { Student } from './student.entity';

@Entity('career_goal')
export class CareerGoal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  student_id: string;

  @OneToOne(() => Student, (s) => s.career_goal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ default: '' })
  target_occupation: string;

  @Column({ default: '' })
  target_industry: string;

  @Column({ default: '' })
  intended_field: string;

  @Column({ type: 'text', default: '' })
  reason: string;

  @Column({ default: false })
  change_field: boolean;

  @Column({ type: 'varchar', default: 'employment' })
  long_term: LongTermGoal;
}
