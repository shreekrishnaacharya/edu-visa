import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from './course.entity';
import { numericTransformer } from '../../common/database/numeric.transformer';

@Entity('scholarship')
export class Scholarship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  course_id: string;

  @ManyToOne(() => Course, (c) => c.scholarships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @Column()
  name: string;

  /** % of tuition. */
  @Column({ type: 'numeric', default: 0, transformer: numericTransformer })
  pct: number;

  @Column({ type: 'text', default: '' })
  criteria: string;

  /** canonical GPA 0-100 threshold. */
  @Column({ type: 'numeric', default: 0, transformer: numericTransformer })
  min_gpa: number;
}
