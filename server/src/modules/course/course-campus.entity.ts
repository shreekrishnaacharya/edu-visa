import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Course } from './course.entity';
import { UniversityCampus } from '../university/university-campus.entity';

/**
 * A course is taught at this campus.
 *
 * Distinct from `university_campus`, which only says the provider operates
 * there. CQU runs 79 in-scope courses across 14 campuses, but only 47 of them in
 * Melbourne — so availability has to be per course, not per provider, or the
 * matcher tells a Melbourne student that every CQU course is on offer there.
 */
@Entity('course_campus')
@Unique('UQ_course_campus', ['course_id', 'campus_id'])
@Index(['course_id'])
@Index(['campus_id'])
export class CourseCampus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  course_id: string;

  @ManyToOne(() => Course, (c) => c.campuses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @Column({ type: 'uuid' })
  campus_id: string;

  @ManyToOne(() => UniversityCampus, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campus_id' })
  campus: UniversityCampus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
