import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from './course.entity';

@Entity('course_intake')
export class CourseIntake {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  course_id: string;

  @ManyToOne(() => Course, (c) => c.course_intakes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  /** e.g. "Feb", "Jul". */
  @Column()
  term: string;

  @Column({ type: 'date' })
  intake_date: string;

  @Column({ type: 'date' })
  application_deadline: string;
}
